import { Request, Response } from 'express';

import { logger } from '../utils/logger';
import { getErrorMessage, getErrorStack } from '../utils/error.util';
import { pool } from '../config/database';


/**
 * GET /api/admin/queues?branchId=...&doctorId=...
 * List today's queue for a branch (admin queue board).
 * Response: { success, data: QueuePatient[], total, nowServing }
 */
export const getAdminQueues = async (req: Request, res: Response) => {
  try {
    const branchId = (req.query.branchId as string) || '';
    const doctorId = (req.query.doctorId as string) || undefined;

    if (!branchId) {
      return res.status(400).json({ success: false, message: 'branchId is required' });
    }

    let query = `
      SELECT q.id, q.queue_number, q.status, q.created_at as check_in_time,
             q.doctor_id,
             b.patient_id,
             p.full_name as patient_name,
             d.full_name as doctor_name,
             d.specialization as service_type
      FROM queues q
      JOIN bookings b ON q.booking_id = b.id
      JOIN patients p ON b.patient_id = p.id
      JOIN doctors d ON q.doctor_id = d.id
      WHERE q.branch_id = $1
        AND q.deleted_at IS NULL
        AND DATE(q.created_at) = CURRENT_DATE
    `;
    const params: string[] = [branchId];
    if (doctorId) {
      params.push(doctorId);
      query += ` AND q.doctor_id = $2`;
    }
    query += ` ORDER BY q.queue_number ASC`;

    const result = await pool.query(query, params);

    const data = result.rows.map((row) => ({
      id: row.id,
      queueNumber: row.queue_number,
      patientName: row.patient_name,
      patientId: row.patient_id,
      doctorId: row.doctor_id,
      doctorName: row.doctor_name,
      serviceType: row.service_type,
      checkInTime: row.check_in_time,
      status: row.status,
    }));

    const nowServing =
      data.find((p) => p.status === 'IN_SERVICE') ||
      data.find((p) => p.status === 'BEING_CALLED') ||
      null;

    res.status(200).json({
      success: true,
      data,
      total: data.length,
      nowServing,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const stack = getErrorStack(error);
    logger.error({ error: message, stack }, 'Admin queue list error');
    res.status(500).json({ success: false, message: message || 'Internal server error' });
  }
};