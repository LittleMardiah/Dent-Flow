import { Request, Response, NextFunction } from 'express';
import { WalkInService } from '../services/walkIn.service';
import { logger } from '../utils/logger';

const walkInService = new WalkInService();

/**
 * POST /walk-in/create-profile
 * Public endpoint: create temporary profile for walk-in patient
 */
export const createTemporaryProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fullName, phone, age, branchId } = req.body;

    if (!fullName || !phone || !branchId) {
      return res.status(400).json({
        success: false,
        message: 'fullName, phone, and branchId are required',
      });
    }

    const tempPatient = await walkInService.createTemporaryProfile({
      fullName,
      phone,
      age: age ? parseInt(age) : undefined,
      branchId,
    });

    res.status(201).json({
      success: true,
      data: {
        tempPatientId: tempPatient.id,
        fullName: tempPatient.fullName,
        phone: tempPatient.phone,
        branchId: tempPatient.branchId,
      },
      message: 'Profil temporer berhasil dibuat',
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Error creating temp profile');
    next(error);
  }
};

/**
 * POST /walk-in/book-appointment
 * Admin-only: book appointment for walk-in patient
 */
export const bookWalkInAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tempPatientId, doctorId, branchId, sessionSlotId, bookingDate } = req.body;

    if (!tempPatientId || !doctorId || !branchId || !bookingDate) {
      return res.status(400).json({
        success: false,
        message: 'tempPatientId, doctorId, branchId, and bookingDate are required',
      });
    }

    const result = await walkInService.bookAppointment(
      tempPatientId,
      doctorId,
      branchId,
      sessionSlotId || 'default',
      new Date(bookingDate)
    );

    res.status(201).json({
      success: true,
      data: {
        bookingId: result.bookingId,
        queueNumber: result.queueNumber,
      },
      message: 'Booking walk-in berhasil dibuat',
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Error booking walk-in appointment');
    if (err.message === 'TEMP_PATIENT_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Profil temporer tidak ditemukan' });
    }
    if (err.message === 'DOCTOR_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Dokter tidak ditemukan' });
    }
    next(error);
  }
};

/**
 * POST /walk-in/convert-to-patient
 * Public endpoint: convert temp profile to full patient account
 */
export const convertTemporaryToPatient = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tempPatientId, email, password } = req.body;

    if (!tempPatientId || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'tempPatientId, email, and password are required',
      });
    }

    const result = await walkInService.convertTemporaryToPatient(
      tempPatientId,
      email,
      password
    );

    res.status(200).json({
      success: true,
      data: {
        patientId: result.patientId,
        token: result.token,
        refreshToken: result.refreshToken,
      },
      message: 'Akun berhasil dibuat! Selamat datang di DentFlow.',
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Error converting temp patient');
    if (err.message === 'TEMP_PATIENT_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Profil temporer tidak ditemukan' });
    }
    if (err.message === 'TEMP_PATIENT_ALREADY_CONVERTED') {
      return res.status(409).json({ success: false, message: 'Profil temporer sudah dikonversi' });
    }
    if (err.message === 'EMAIL_ALREADY_EXISTS') {
      return res.status(409).json({ success: false, message: 'Email sudah terdaftar' });
    }
    next(error);
  }
};
