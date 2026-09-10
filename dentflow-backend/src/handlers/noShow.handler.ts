import { Request, Response, NextFunction } from 'express';

import { logger } from '../utils/logger';
import { auditService } from '../services/audit.service';
import { AuditEventType } from '../models/audit.model';
import { pool } from '../config/database';


/**
 * GET /api/admin/no-shows?branchId=...&date=...
 * Admin endpoint: list all no-shows for a branch
 */
export const getNoShows = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = Array.isArray(req.query.branchId) 
      ? req.query.branchId[0] 
      : req.query.branchId;
    const date = req.query.date 
      ? new Date(req.query.date as string) 
      : new Date();

    if (!branchId) {
      return res.status(400).json({ 
        success: false, 
        message: 'branchId query parameter is required' 
      });
    }

    const dateStr = date.toISOString().split('T')[0];

    const result = await pool.query(
      `
      SELECT 
        b.id as booking_id,
        b.patient_id,
        p.full_name as patient_name,
        p.phone as patient_phone,
        b.doctor_id,
        d.full_name as doctor_name,
        b.booking_date,
        b.session_start,
        b.session_end,
        b.no_show_at,
        b.status,
        b.branch_id
      FROM bookings b
      LEFT JOIN patients p ON b.patient_id = p.id
      LEFT JOIN doctors d ON b.doctor_id = d.id
      WHERE b.branch_id = $1
        AND b.status = 'NO_SHOW'
        AND b.no_show_at::date = $2::date
      ORDER BY b.no_show_at DESC
      `,
      [branchId, dateStr]
    );

    res.status(200).json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Error fetching no-shows');
    next(error);
  }
};

/**
 * PUT /api/admin/bookings/:id/mark-no-show
 * Manual marking (admin override)
 */
export const markNoShowManual = async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const bookingId = String(req.params.id);
    const adminId = req.user?.userId;

    if (!adminId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    await client.query('BEGIN');

    const bookingResult = await client.query(
      `SELECT * FROM bookings WHERE id = $1`,
      [bookingId]
    );
    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Booking tidak ditemukan' });
    }

    const booking = bookingResult.rows[0];

    if (booking.status === 'NO_SHOW') {
      await client.query('COMMIT');
      return res.status(200).json({
        success: true,
        message: 'Booking sudah ditandai NO_SHOW',
        data: { booking_id: bookingId, status: 'NO_SHOW' },
      });
    }

    if (['CANCELLED', 'COMPLETED'].includes(booking.status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: `Booking sudah berstatus ${booking.status}, tidak bisa diubah ke NO_SHOW`,
      });
    }

    await client.query(
      `UPDATE bookings 
       SET status = 'NO_SHOW', no_show_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [bookingId]
    );

    await auditService.logEvent({
      branchId: booking.branch_id,
      userId: adminId,
      eventType: AuditEventType.BOOKING_NO_SHOW_MARKED,
      entityType: 'BOOKING',
      entityId: bookingId,
      description: 'Pemesanan Tidak Datang (Manual oleh Admin)',
      newValues: { 
        status: 'NO_SHOW', 
        no_show_at: new Date().toISOString(),
        admin_id: adminId
      },
    });

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Booking berhasil ditandai NO_SHOW',
      data: { booking_id: bookingId, status: 'NO_SHOW' },
    });
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Error marking no-show manually');
    next(error);
  } finally {
    client.release();
  }
};
