import { Request, Response, NextFunction } from 'express';

import { doctorQueueService } from '../services/doctorQueue.service';
import { QueueManagementService } from '../services/queueManagement.service';
import { broadcastQueueUpdated } from '../websocket';
import { logger } from '../utils/logger';
import { getErrorMessage, getErrorStack } from '../utils/error.util';

const queueManagementService = new QueueManagementService();

export const getQueueStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { branch_id, doctor_id } = req.query;
    
    if (!branch_id) {
      return res.status(400).json({
        success: false,
        message: 'branch_id wajib diisi',
      });
    }

    // doctor_id bisa undefined, service handle dengan optional parameter
    const result = await queueManagementService.getTvDisplay(
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

    // queue_id bisa string atau string[], cast ke string
    const result = await doctorQueueService.completePatient(queue_id as string, doctorId);

    if (result?.branch_id) {
      broadcastQueueUpdated({
        branchId: result.branch_id,
        doctorId: result.doctor_id,
        action: 'complete',
      });
    } else if (result?.branchId) {
      broadcastQueueUpdated({
        branchId: result.branchId,
        doctorId: result.doctorId,
        action: 'complete',
      });
    }

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