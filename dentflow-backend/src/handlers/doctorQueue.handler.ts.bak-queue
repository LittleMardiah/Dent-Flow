import { Request, Response, NextFunction } from 'express';
import { DoctorQueueService } from '../services/doctorQueue.service';
import { logger } from '../utils/logger';

const doctorQueueService = new DoctorQueueService();

/**
 * GET /doctors/:id/queue?branchId=...
 * Get queue for a specific doctor
 */
export const getDoctorQueue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctorId = String(req.params.id);
    const branchId = Array.isArray(req.query.branchId) 
      ? req.query.branchId[0] 
      : req.query.branchId;

    if (!branchId) {
      return res.status(400).json({ 
        success: false, 
        message: 'branchId query parameter is required' 
      });
    }

    const queue = await doctorQueueService.getQueueForDoctor(doctorId, branchId as string);
    res.status(200).json({
      success: true,
      data: queue,
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack });
    next(error);
  }
};

/**
 * POST /queue/:id/check-in
 * Doctor starts service for a patient (check-in)
 */
export const checkInPatient = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queueId = String(req.params.id);
    // req.user memiliki userId dari auth middleware (bukan id)
    const doctorId = req.user?.userId;

    if (!doctorId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const result = await doctorQueueService.checkInPatient(queueId, doctorId);
    res.status(200).json({
      success: true,
      data: {
        queue: result.queue,
        encounter: result.encounter,
      },
      message: 'Pasien berhasil di-check-in, encounter dibuat.',
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack });
    if (err.message === 'QUEUE_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Queue tidak ditemukan' });
    }
    if (err.message === 'QUEUE_NOT_OWNED_BY_DOCTOR') {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke queue ini' });
    }
    if (err.message === 'QUEUE_NOT_WAITING') {
      return res.status(409).json({ success: false, message: 'Queue sudah diproses atau tidak dalam status WAITING' });
    }
    next(error);
  }
};

/**
 * GET /doctors/:id/queue/stats?branchId=...
 * Get queue statistics for a doctor
 */
export const getQueueStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctorId = String(req.params.id);
    const branchId = Array.isArray(req.query.branchId) 
      ? req.query.branchId[0] 
      : req.query.branchId;

    if (!branchId) {
      return res.status(400).json({ 
        success: false, 
        message: 'branchId query parameter is required' 
      });
    }

    const stats = await doctorQueueService.getQueueStats(doctorId, branchId as string);
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack });
    next(error);
  }
};
