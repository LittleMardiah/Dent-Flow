import { Request, Response, NextFunction } from 'express';
import { PatientHistoryService } from '../services/patientHistory.service';
import { logger } from '../utils/logger';

const patientHistoryService = new PatientHistoryService();

/**
 * GET /patients/:id/history?branchId=...
 * Get patient history (encounters, invoices, bookings)
 * Accessible by: patient themselves, doctor, or admin
 */
export const getPatientHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = String(req.params.id);
    const branchId = Array.isArray(req.query.branchId) 
      ? req.query.branchId[0] 
      : req.query.branchId;

    if (!branchId) {
      return res.status(400).json({ 
        success: false, 
        message: 'branchId query parameter is required' 
      });
    }

    // Authorization check: only patient themselves, doctor, or admin can access
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const userBranch = req.user?.branchId;

    // If user is a patient, they can only access their own history
    if (userRole === 'PATIENT' && userId !== patientId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Anda tidak memiliki akses ke riwayat pasien lain' 
      });
    }

    // If user is admin or doctor, they must be in the same branch
    if ((userRole === 'ADMIN_BRANCH' || userRole === 'DOCTOR') && userBranch !== branchId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Anda tidak memiliki akses ke cabang ini' 
      });
    }

    const history = await patientHistoryService.getPatientHistory(patientId, branchId as string);
    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack });
    next(error);
  }
};

/**
 * GET /patients/:id/medical-records?branchId=...
 * Get medical records (full encounter details including diagnosis)
 * Doctor-only endpoint
 */
export const getMedicalRecords = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = String(req.params.id);
    const branchId = Array.isArray(req.query.branchId) 
      ? req.query.branchId[0] 
      : req.query.branchId;

    if (!branchId) {
      return res.status(400).json({ 
        success: false, 
        message: 'branchId query parameter is required' 
      });
    }

    // Only doctors can access medical records
    if (req.user?.role !== 'DOCTOR') {
      return res.status(403).json({ 
        success: false, 
        message: 'Hanya dokter yang dapat mengakses rekam medis lengkap' 
      });
    }

    // Doctor must be in the same branch
    if (req.user?.branchId !== branchId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Anda tidak memiliki akses ke cabang ini' 
      });
    }

    const records = await patientHistoryService.getMedicalRecords(patientId, branchId as string);
    res.status(200).json({
      success: true,
      data: records,
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack });
    next(error);
  }
};
