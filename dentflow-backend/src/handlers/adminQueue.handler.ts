import { Request, Response } from 'express';

import { logger } from '../utils/logger';
import { getErrorMessage, getErrorStack } from '../utils/error.util';
import { pool } from '../config/database';


interface AdminQueueRow {
  id: string;
  queueNumber: number;
  patientId: string | null;
  patientName: string;
  doctorId: string;
  doctorName: string;
  serviceType: string;
  checkInTime: Date;
  status: string;
  isWalkIn: boolean;
}

const fetchAdminQueueRows = async (
  branchId: string,
  doctorId?: string
): Promise<AdminQueueRow[]> => {
  let query = `
      SELECT q.id, q.queue_number, q.status, q.created_at as check_in_time,
             q.doctor_id,
             COALESCE(b.patient_id, b.temp_patient_id) as patient_id,
             COALESCE(p.full_name, tp.full_name, 'Pasien Walk-in') as patient_name,
             d.full_name as doctor_name,
             d.specialization as service_type,
             b.is_walk_in
      FROM queues q
      JOIN bookings b ON q.booking_id = b.id
      LEFT JOIN patients p ON b.patient_id = p.id
      LEFT JOIN temporary_patients tp ON b.temp_patient_id = tp.id
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

  return result.rows.map((row) => ({
    id: row.id,
    queueNumber: Number(row.queue_number),
    patientId: row.patient_id,
    patientName: row.patient_name,
    doctorId: row.doctor_id,
    doctorName: row.doctor_name,
    serviceType: row.service_type,
    checkInTime: row.check_in_time,
    status: row.status,
    isWalkIn: !!row.is_walk_in,
  }));
};

const escapeCsvValue = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const formatCheckInTime = (value: Date): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

/**
 * GET /api/admin/queues?branchId=...&doctorId=...
 * List today's queue for a branch (admin queue board).
 * Response: { success, data: QueuePatient[], total, nowServing }
 */
export const getAdminQueues = async (req: Request, res: Response) => {
  try {
    const userBranchId = req.user?.branchId;
    const branchId = (userBranchId as string) || (req.query.branchId as string) || '';
    const doctorId = (req.query.doctorId as string) || undefined;

    if (!branchId) {
      return res.status(400).json({ success: false, message: 'branchId is required' });
    }

    const data = await fetchAdminQueueRows(branchId, doctorId);

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

/**
 * GET /api/admin/queues/export?branchId=...&doctorId=...
 * Export today's queue for a branch as CSV (no pagination).
 */
export const exportAdminQueues = async (req: Request, res: Response) => {
  try {
    const userBranchId = req.user?.branchId;
    const branchId = (userBranchId as string) || (req.query.branchId as string) || '';
    const doctorId = (req.query.doctorId as string) || undefined;

    if (!branchId) {
      return res.status(400).json({ success: false, message: 'branchId is required' });
    }

    const rows = await fetchAdminQueueRows(branchId, doctorId);

    const header = ['No', 'Nama Pasien', 'Tipe', 'Dokter', 'Status', 'Waktu Check-in'];
    const lines = [header.map(escapeCsvValue).join(',')];

    rows.forEach((row, index) => {
      lines.push(
        [
          index + 1,
          row.patientName,
          row.isWalkIn ? 'Walk-in' : 'Online',
          row.doctorName,
          row.status,
          formatCheckInTime(row.checkInTime),
        ]
          .map(escapeCsvValue)
          .join(',')
      );
    });

    const csv = lines.join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="queue-export.csv"');
    return res.status(200).send(csv);
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const stack = getErrorStack(error);
    logger.error({ error: message, stack }, 'Admin queue export error');
    return res.status(500).json({ success: false, message: message || 'Internal server error' });
  }
};
