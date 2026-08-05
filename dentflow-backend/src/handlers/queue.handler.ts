import { Request, Response, NextFunction } from 'express';
import { queueService } from '../services/queue.service';
import { doctorQueueService } from '../services/doctorQueue.service';
import { logger } from '../utils/logger';
import { getErrorMessage, getErrorStack } from '../utils/error.util';

export const getQueueStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branch_id, doctor_id } = req.query;
    
    if (!branch_id) {
      return res.status(400).json({
        success: false,
        message: 'branch_id wajib diisi',
      });
    }

    const result = await queueService.getQueueStatus(
      branch_id as string,
      doctor_id as string | undefined
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const stack = getErrorStack(error);
    logger.error({ error: message, stack }, 'Get queue status error');
    next(error);
  }
};

export const callNextPatient = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctorId = req.user?.userId;
    const { branch_id } = req.body;

    if (!doctorId || !branch_id) {
      return res.status(400).json({
        success: false,
        message: 'doctorId dan branch_id wajib diisi',
      });
    }

    const result = await doctorQueueService.callNextPatient(doctorId, branch_id);

    res.status(200).json({
      success: true,
      data: result,
      message: `Pasien nomor ${result.queueNumber} dipanggil`,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const stack = getErrorStack(error);
    logger.error({ error: message, stack }, 'Call next patient error');

    if (message === 'NO_PATIENT_WAITING') {
      return res.status(404).json({
        success: false,
        message: 'Tidak ada pasien dalam antrian',
      });
    }
    if (message === 'DOCTOR_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Dokter tidak ditemukan',
      });
    }
    next(error);
  }
};

export const completePatient = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { queue_id } = req.params;
    const doctorId = req.user?.userId;

    if (!doctorId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const result = await doctorQueueService.completePatient(queue_id, doctorId);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Pasien selesai dilayani',
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const stack = getErrorStack(error);
    logger.error({ error: message, stack }, 'Complete patient error');

    if (message === 'QUEUE_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Antrian tidak ditemukan',
      });
    }
    if (message === 'QUEUE_NOT_OWNED') {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses ke antrian ini',
      });
    }
    next(error);
  }
};
