import { Request, Response } from 'express';
import { checkinService } from '../services/checkin.service';
import { broadcastQueueUpdated } from '../websocket';
import { logger } from '../utils/logger';
import { getErrorMessage, getErrorStack } from '../utils/error.util';

export const adminCheckin = async (req: Request, res: Response) => {
  try {
    const { check_in_code, branch_id } = req.body;
    const adminId = req.user?.userId;

    console.log('🔍 [DEBUG] adminId:', adminId);
    console.log('🔍 [DEBUG] req.user:', JSON.stringify(req.user, null, 2));

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

    broadcastQueueUpdated({
      branchId: branch_id,
      doctorId: result.doctorId,
      action: 'check-in',
    });

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
    
    console.error('❌ [ERROR DETAIL]', {
      message,
      stack,
      detail: (error as any)?.detail,
      code: (error as any)?.code,
      table: (error as any)?.table,
      constraint: (error as any)?.constraint,
    });
    logger.error({ 
      error: message, 
      detail: (error as any)?.detail, 
      code: (error as any)?.code,
      constraint: (error as any)?.constraint 
    }, 'Admin check-in error');

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
