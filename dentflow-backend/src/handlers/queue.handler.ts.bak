import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { logger } from '../utils/logger';

export const getQueueStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = req.query.branchId as string;
    const doctorId = req.query.doctorId as string;
    if (!branchId) {
      return res.status(400).json({ success: false, message: 'branchId required' });
    }
    // Query queue dari database
    const result = await pool.query(
      `SELECT queue_number, status FROM queues WHERE branch_id = $1 AND doctor_id = $2 ORDER BY queue_number`,
      [branchId, doctorId]
    );
    res.status(200).json({
      success: true,
      data: {
        branchId,
        doctorId,
        waiting_queue: result.rows.filter(r => r.status === 'WAITING').map(r => r.queue_number),
        now_serving: result.rows.find(r => r.status === 'BEING_CALLED')?.queue_number || null,
        total_waiting: result.rows.filter(r => r.status === 'WAITING').length,
      },
    });
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, 'Get queue status error');
    next(error);
  }
};
