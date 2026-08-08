import { Request, Response } from 'express';
import { checkinService } from '../services/checkin.service';
import { WalkInService } from '../services/walkIn.service';
import { logger } from '../utils/logger';
import { getErrorMessage, getErrorStack } from '../utils/error.util';

// Create instance of WalkInService
const walkInService = new WalkInService();

export const checkInPatient = async (req: Request, res: Response) => {
  try {
    const { check_in_code, branch_id } = req.body;
    const adminId = req.user?.userId;

    if (!check_in_code || !branch_id) {
      return res.status(400).json({
        success: false,
        message: 'check_in_code dan branch_id wajib diisi',
      });
    }

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Admin tidak terautentikasi',
      });
    }

    const result = await checkinService.checkinPatient(
      check_in_code,
      branch_id,
      adminId
    );

    if (result.alreadyCheckedIn) {
      return res.status(200).json({
        success: true,
        data: {
          queue_number: result.queueNumber,
          already_checked_in: true,
        },
        message: `Pasien sudah check-in sebelumnya. Nomor antrian: ${result.queueNumber}`,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        queue_number: result.queueNumber,
        booking_id: result.bookingId,
        patient_id: result.patientId,
        doctor_id: result.doctorId,
      },
      message: `Check-in berhasil. Nomor antrian: ${result.queueNumber}`,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const stack = getErrorStack(error);
    
    logger.error({ error: message, stack }, 'Check-in error');

    let status = 400;
    let responseMessage = 'Check-in gagal';

    switch (message) {
      case 'KODE_TIDAK_VALID':
        responseMessage = 'Kode booking tidak ditemukan';
        break;
      case 'BRANCH_TIDAK_SESUAI':
        responseMessage = 'Cabang tidak sesuai dengan booking';
        break;
      case 'STATUS_TIDAK_VALID':
        responseMessage = 'Booking tidak dalam status yang valid untuk check-in';
        break;
      case 'PAYMENT_BELUM_KONFIRMASI':
        responseMessage = 'Pembayaran belum dikonfirmasi';
        break;
      case 'SUDAH_CHECK_IN':
        responseMessage = 'Booking sudah check-in';
        break;
      case 'SESI_BELUM_DIMULAI':
        responseMessage = 'Sesi belum dimulai';
        break;
      case 'SESI_SUDAH_BERAKHIR':
        responseMessage = 'Sesi sudah berakhir';
        break;
      default:
        status = 500;
        responseMessage = 'Terjadi kesalahan server';
    }

    return res.status(status).json({
      success: false,
      message: responseMessage,
      error: message,
    });
  }
};

export const addWalkIn = async (req: Request, res: Response) => {
  try {
    const { name, phone, doctor_id, branch_id } = req.body;
    const adminId = req.user?.userId;

    if (!name || !doctor_id || !branch_id) {
      return res.status(400).json({
        success: false,
        message: 'name, doctor_id, dan branch_id wajib diisi',
      });
    }

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Admin tidak terautentikasi',
      });
    }

    // STEP 1: Create temporary patient profile (gunakan properti yang benar)
    const tempPatient = await walkInService.createTemporaryProfile({
      branchId: branch_id,      // <-- branchId, bukan branch_id
      fullName: name,           // <-- fullName, bukan full_name
      phone: phone || null,
    });

    if (!tempPatient || !tempPatient.id) {
      throw new Error('GAGAL_BUAT_TEMP_PASIEN');
    }

    // STEP 2: Get today's date for booking
    const bookingDate = new Date();

    // STEP 3: Find an available session slot for the doctor today
    let sessionSlotId = '';
    try {
      const schedulesResult = await walkInService['pool'].query(
        `SELECT id FROM doctor_schedules 
         WHERE doctor_id = $1 
           AND branch_id = $2 
           AND day_of_week = EXTRACT(DOW FROM CURRENT_DATE)
           AND is_active = true
         LIMIT 1`,
        [doctor_id, branch_id]
      );
      if (schedulesResult.rows.length > 0) {
        sessionSlotId = schedulesResult.rows[0].id;
      } else {
        const fallbackResult = await walkInService['pool'].query(
          `SELECT id FROM doctor_schedules 
           WHERE doctor_id = $1 
             AND branch_id = $2 
             AND is_active = true
           LIMIT 1`,
          [doctor_id, branch_id]
        );
        if (fallbackResult.rows.length > 0) {
          sessionSlotId = fallbackResult.rows[0].id;
        } else {
          throw new Error('DOKTER_TIDAK_MEMILIKI_JADWAL');
        }
      }
    } catch (scheduleError) {
      logger.error({ 
        error: getErrorMessage(scheduleError), 
        doctor_id, 
        branch_id 
      }, 'Error fetching doctor schedule');
      throw new Error('GAGAL_AMBIL_JADWAL_DOKTER');
    }

    // STEP 4: Book appointment (5 parameter terpisah)
    const result = await walkInService.bookAppointment(
      tempPatient.id,
      doctor_id,
      branch_id,
      sessionSlotId,
      bookingDate
    );

    return res.status(201).json({
      success: true,
      data: {
        queue_number: result.queueNumber,
        booking_id: result.bookingId,
        temp_patient_id: tempPatient.id,
      },
      message: `Walk-in berhasil. Nomor antrian: ${result.queueNumber}`,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const stack = getErrorStack(error);
    logger.error({ error: message, stack }, 'Walk-in error');

    let status = 500;
    let responseMessage = 'Terjadi kesalahan saat menambahkan walk-in';

    switch (message) {
      case 'DOKTER_TIDAK_MEMILIKI_JADWAL':
        status = 400;
        responseMessage = 'Dokter tidak memiliki jadwal aktif';
        break;
      case 'GAGAL_BUAT_TEMP_PASIEN':
        status = 500;
        responseMessage = 'Gagal membuat profil pasien sementara';
        break;
      case 'GAGAL_AMBIL_JADWAL_DOKTER':
        status = 500;
        responseMessage = 'Gagal mengambil jadwal dokter';
        break;
      default:
        status = 500;
        responseMessage = 'Terjadi kesalahan server';
    }

    return res.status(status).json({
      success: false,
      message: responseMessage,
      error: message,
    });
  }
};