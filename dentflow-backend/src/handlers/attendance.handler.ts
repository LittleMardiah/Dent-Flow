import { Request, Response, NextFunction } from 'express';
import { AttendanceReportService } from '../services/attendanceReport.service';
import { logger } from '../utils/logger';

const attendanceService = new AttendanceReportService();

/**
 * GET /api/patients/:id/attendance
 * Get attendance statistics for a patient
 * Access: patient themselves, doctor, or admin
 */
export const getPatientAttendance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = String(req.params.id);
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Authorization: patient can view own, doctor/admin can view any
    if (userRole === 'PATIENT' && userId !== patientId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Anda hanya dapat melihat statistik kehadiran sendiri' 
      });
    }

    const attendance = await attendanceService.getPatientAttendanceRate(patientId);
    
    // Get trend data (last 3 months)
    const trend = await attendanceService.getPatientTrend(patientId);

    res.status(200).json({
      success: true,
      data: {
        ...attendance,
        trend,
      },
    });
  } catch (error: unknown) {
    logger.error({ error: (error as Error).message, stack: (error as Error).stack }, 'Error getting patient attendance');
    next(error);
  }
};

/**
 * GET /api/reports/no-show-summary?branchId=...&limit=...
 * Admin endpoint: top chronic no-shows
 */
export const getNoShowSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = Array.isArray(req.query.branchId) 
      ? req.query.branchId[0] 
      : req.query.branchId;
    
    // FIX: cast to string using String()
    const limit = parseInt(String(req.query.limit || '20'), 10);

    if (!branchId) {
      return res.status(400).json({ 
        success: false, 
        message: 'branchId query parameter is required' 
      });
    }

    // Admin only
    if (req.user?.role !== 'ADMIN_BRANCH') {
      return res.status(403).json({ 
        success: false, 
        message: 'Hanya admin yang dapat mengakses laporan ini' 
      });
    }

    // Admin must be in the same branch
    if (req.user?.branchId !== branchId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Anda tidak memiliki akses ke cabang ini' 
      });
    }

    const summary = await attendanceService.getNoShowSummary(branchId as string, limit);
    res.status(200).json({
      success: true,
      data: summary,
      count: summary.length,
    });
  } catch (error: unknown) {
    logger.error({ error: (error as Error).message, stack: (error as Error).stack }, 'Error getting no-show summary');
    next(error);
  }
};
