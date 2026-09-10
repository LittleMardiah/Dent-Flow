import { Request, Response, NextFunction } from 'express';

import { DoctorQueueService } from '../services/doctorQueue.service';
import { broadcastQueueUpdated } from '../websocket';
import { logger } from '../utils/logger';
import { getErrorMessage, getErrorStack } from '../utils/error.util';
import { pool } from '../config/database';

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
    // req.user.userId = users.id (dari JWT). queues.doctor_id menyimpan doctors.id,
    // jadi resolve dulu ke doctor record id (konsisten dengan queue-today).
    const doctorUserId = req.user?.userId;

    if (!doctorUserId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const doctorRecordId = await resolveDoctorRecordId(doctorUserId);
    const result = await doctorQueueService.checkInPatient(queueId, doctorRecordId);

    const queueBranchId = result.queue?.branch_id ?? result.queue?.branchId;
    if (queueBranchId) {
      broadcastQueueUpdated({
        branchId: queueBranchId,
        doctorId: result.queue?.doctor_id ?? result.queue?.doctorId ?? doctorRecordId,
        action: 'check-in',
      });
    }

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

/**
 * Resolve doctor record id from user_id or doctor record id.
 */
async function resolveDoctorRecordId(doctorParam: string): Promise<string> {
  const result = await pool.query(
    'SELECT id FROM doctors WHERE user_id = $1 OR id = $1 LIMIT 1',
    [doctorParam]
  );
  if (result.rows.length === 0) {
    throw new Error('DOCTOR_NOT_FOUND');
  }
  return result.rows[0].id;
}

/**
 * GET /doctors/:id/queue-today
 * Today's active queue for a doctor (web doctor queue board).
 * Response: { success, data: { data, currentPatient, nextPatients, waitingCount } }
 */
export const getDoctorQueueToday = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctorParam = String(req.params.id);
    const branchId = req.user?.branchId;

    if (!branchId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const realDoctorId = await resolveDoctorRecordId(doctorParam);

    const result = await pool.query(
      `SELECT q.id, q.booking_id, q.queue_number, q.status, q.created_at as check_in_time,
              COALESCE(b.patient_id, b.temp_patient_id) as patient_id,
              COALESCE(p.full_name, tp.full_name) as patient_name,
              b.is_walk_in,
              EXTRACT(EPOCH FROM (NOW() - q.created_at)) / 60 AS wait_minutes
       FROM queues q
       JOIN bookings b ON q.booking_id = b.id
       LEFT JOIN patients p ON b.patient_id = p.id
       LEFT JOIN temporary_patients tp ON b.temp_patient_id = tp.id
       WHERE q.doctor_id = $1
         AND q.branch_id = $2
         AND q.deleted_at IS NULL
         AND DATE(q.created_at) = CURRENT_DATE
         AND q.status IN ('WAITING', 'BEING_CALLED', 'IN_SERVICE')
       ORDER BY q.queue_number ASC`,
      [realDoctorId, branchId]
    );

    const data = result.rows.map((row) => ({
      id: row.id,
      bookingId: row.booking_id,
      queueNumber: row.queue_number,
      patientId: row.patient_id,
      patientName: row.patient_name,
      checkInTime: row.check_in_time,
      status: row.status,
      isWalkIn: !!row.is_walk_in,
      waitTimeMinutes: Math.round(parseFloat(row.wait_minutes)) || 0,
    }));

    const currentPatient =
      data.find((p) => p.status === 'IN_SERVICE') ||
      data.find((p) => p.status === 'BEING_CALLED') ||
      null;

    const nextPatients = data.filter((p) => p.status === 'WAITING').slice(0, 3);
    const waitingCount = data.filter((p) => p.status === 'WAITING').length;

    res.status(200).json({
      success: true,
      data: {
        data,
        currentPatient,
        nextPatients,
        waitingCount,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack });
    if (err.message === 'DOCTOR_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Dokter tidak ditemukan' });
    }
    next(error);
  }
};

/**
 * POST /doctors/:id/ready-next
 * Call the next waiting patient for a doctor.
 * Response: { success, data: { data } }
 */
export const readyNextDoctor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctorParam = String(req.params.id);
    const branchId = req.user?.branchId;

    if (!branchId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const realDoctorId = await resolveDoctorRecordId(doctorParam);
    const queue = await doctorQueueService.callNextPatient(realDoctorId, branchId);

    broadcastQueueUpdated({
      branchId,
      doctorId: realDoctorId,
      action: 'call-next',
    });

    res.status(200).json({
      success: true,
      data: { data: queue },
      message: 'Pasien berhasil dipanggil',
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) });
    if (err.message === 'DOCTOR_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Dokter tidak ditemukan' });
    }
    next(error);
  }
};
