import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { getErrorMessage, getErrorStack } from '../utils/error.util';

const getEffectiveBranch = (req: Request): string => {
  const effective = (req as any).branchId || req.user?.branchId;
  return String(effective || '');
};

const mapPatientRow = (row: any) => ({
  id: row.id,
  userId: row.user_id,
  fullName: row.full_name,
  phone: row.phone || '',
  email: row.email || '',
  branchId: row.branch_id,
  totalBookings: parseInt(row.total_bookings) || 0,
  lastVisit: row.last_visit || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/**
 * GET /api/patients?branchId=&search=&page=&limit=
 * List pasien di dalam branch yang diizinkan.
 * Response: { success, data: { data, total, page, totalPages } }
 */
export const listPatients = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = getEffectiveBranch(req);
    if (!branchId) {
      return res.status(400).json({ success: false, message: 'Branch tidak terdeteksi' });
    }

    const search = String(req.query.search || '').trim();
    const page = parseInt(String(req.query.page || '1')) || 1;
    const limit = Math.min(parseInt(String(req.query.limit || '20')) || 20, 100);
    const offset = (page - 1) * limit;

    const params: any[] = [branchId];
    let whereSql = 'p.branch_id = $1 AND p.deleted_at IS NULL';

    if (search) {
      params.push(`%${search}%`);
      whereSql += ` AND (p.full_name ILIKE $${params.length} OR p.phone ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) as total
       FROM patients p JOIN users u ON u.id = p.user_id
       WHERE ${whereSql}`,
      params
    );
    const total = parseInt(countResult.rows[0].total) || 0;

    const listResult = await pool.query(
      `SELECT p.id, p.user_id, p.full_name, p.phone, p.branch_id, p.created_at, p.updated_at,
              u.email,
              (SELECT COUNT(*) FROM bookings b WHERE b.patient_id = p.id) as total_bookings,
              (SELECT MAX(e.completed_at) FROM encounters e WHERE e.patient_id = p.id) as last_visit
       FROM patients p
       JOIN users u ON u.id = p.user_id
       WHERE ${whereSql}
       ORDER BY p.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.status(200).json({
      success: true,
      data: {
        data: listResult.rows.map(mapPatientRow),
        total,
        page,
        totalPages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (error: unknown) {
    logger.error({ error: getErrorMessage(error), stack: getErrorStack(error), path: req.path }, 'listPatients failed');
    next(error);
  }
};

/**
 * GET /api/patients/:id
 * Detail pasien + bookings + encounters + invoices.
 */
export const getPatientDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = getEffectiveBranch(req);
    const patientId = String(req.params.id);

    const patientResult = await pool.query(
      `SELECT p.id, p.user_id, p.full_name, p.phone, p.branch_id, p.created_at, p.updated_at,
              u.email,
              (SELECT COUNT(*) FROM bookings b WHERE b.patient_id = p.id) as total_bookings,
              (SELECT MAX(e.completed_at) FROM encounters e WHERE e.patient_id = p.id) as last_visit
       FROM patients p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = $1 AND p.branch_id = $2 AND p.deleted_at IS NULL`,
      [patientId, branchId]
    );

    if (patientResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pasien tidak ditemukan' });
    }

    const bookingsResult = await pool.query(
      `SELECT b.id, b.booking_date::text as booking_date, b.booking_time::text as booking_time,
              b.status, d.full_name as doctor_name
       FROM bookings b
       LEFT JOIN doctors d ON d.id = b.doctor_id
       WHERE b.patient_id = $1 AND b.branch_id = $2
       ORDER BY b.booking_date DESC, b.booking_time DESC`,
      [patientId, branchId]
    );

    const encountersResult = await pool.query(
      `SELECT e.id, e.created_at, e.diagnosis, d.full_name as doctor_name
       FROM encounters e
       LEFT JOIN doctors d ON d.id = e.doctor_id
       WHERE e.patient_id = $1 AND e.branch_id = $2
       ORDER BY e.created_at DESC`,
      [patientId, branchId]
    );

    const invoicesResult = await pool.query(
      `SELECT i.id, i.invoice_number, i.amount_due, i.status
       FROM invoices i
       WHERE i.patient_id = $1 AND i.branch_id = $2
       ORDER BY i.created_at DESC`,
      [patientId, branchId]
    );

    const patient = mapPatientRow(patientResult.rows[0]);

    res.status(200).json({
      success: true,
      data: {
        ...patient,
        bookings: bookingsResult.rows.map((b) => ({
          id: b.id,
          bookingDate: b.booking_date ? `${b.booking_date} ${b.booking_time || ''}`.trim() : '',
          doctorName: b.doctor_name || '',
          status: b.status,
        })),
        encounters: encountersResult.rows.map((e) => ({
          id: e.id,
          createdAt: e.created_at,
          doctorName: e.doctor_name || '',
          diagnosis: e.diagnosis || '',
        })),
        invoices: invoicesResult.rows.map((i) => ({
          id: i.id,
          invoiceNumber: i.invoice_number || '',
          totalAmount: Number(i.amount_due) || 0,
          status: i.status,
        })),
      },
    });
  } catch (error: unknown) {
    logger.error({ error: getErrorMessage(error), stack: getErrorStack(error), path: req.path }, 'getPatientDetail failed');
    next(error);
  }
};

/**
 * PUT /api/patients/:id
 * Update pasien (full_name, phone, email).
 */
export const updatePatient = async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const branchId = getEffectiveBranch(req);
    const patientId = String(req.params.id);
    const { fullName, phone, email } = req.body || {};

    if (!fullName || typeof fullName !== 'string' || !String(fullName).trim()) {
      return res.status(400).json({ success: false, message: 'Nama lengkap wajib diisi' });
    }

    await client.query('BEGIN');

    const patientResult = await client.query(
      `SELECT p.id, p.user_id FROM patients p
       WHERE p.id = $1 AND p.branch_id = $2 AND p.deleted_at IS NULL`,
      [patientId, branchId]
    );
    if (patientResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Pasien tidak ditemukan' });
    }
    const userId = patientResult.rows[0].user_id;

    if (email && typeof email === 'string') {
      const dup = await client.query(
        'SELECT id FROM users WHERE email = $1 AND id <> $2',
        [email, userId]
      );
      if (dup.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Email sudah digunakan oleh pengguna lain' });
      }
    }

    const updateResult = await client.query(
      `UPDATE patients
       SET full_name = $1,
           phone = COALESCE($2, phone),
           updated_at = NOW()
       WHERE id = $3 AND branch_id = $4
       RETURNING id, user_id, full_name, phone, branch_id, created_at, updated_at`,
      [String(fullName).trim(), phone || null, patientId, branchId]
    );

    if (email && typeof email === 'string') {
      await client.query('UPDATE users SET email = $1 WHERE id = $2', [email, userId]);
    }

    await client.query('COMMIT');

    const emailResult = await client.query('SELECT email FROM users WHERE id = $1', [userId]);
    const row = updateResult.rows[0];
    res.status(200).json({
      success: true,
      data: {
        id: row.id,
        userId: row.user_id,
        fullName: row.full_name,
        phone: row.phone || '',
        email: emailResult.rows[0]?.email || '',
        branchId: row.branch_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    logger.error({ error: getErrorMessage(error), stack: getErrorStack(error), path: req.path }, 'updatePatient failed');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * DELETE /api/patients/:id
 * Soft delete pasien: set deleted_at + nonaktifkan akun user.
 */
export const softDeletePatient = async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const branchId = getEffectiveBranch(req);
    const patientId = String(req.params.id);

    await client.query('BEGIN');

    const deleteResult = await client.query(
      `UPDATE patients
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND branch_id = $2 AND deleted_at IS NULL
       RETURNING id, user_id`,
      [patientId, branchId]
    );

    if (deleteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Pasien tidak ditemukan' });
    }

    const userId = deleteResult.rows[0].user_id;
    await client.query(
      'UPDATE users SET is_active = false WHERE id = $1',
      [userId]
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      data: { id: patientId },
      message: 'Pasien berhasil dihapus',
    });
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    logger.error({ error: getErrorMessage(error), stack: getErrorStack(error), path: req.path }, 'softDeletePatient failed');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * GET /api/patients/branches
 * Daftar branch yang boleh diakses oleh user (branch sendiri + yang di-grant).
 */
export const listAccessibleBranches = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const result = await pool.query(
      `SELECT DISTINCT b.id, b.name
       FROM branches b
       WHERE b.is_active = true
         AND (
           b.id = $1
           OR b.id IN (SELECT branch_id FROM user_branch_access WHERE user_id = $2)
         )
       ORDER BY b.name`,
      [user.branchId, user.userId]
    );

    res.status(200).json({ success: true, data: result.rows });
  } catch (error: unknown) {
    logger.error({ error: getErrorMessage(error), stack: getErrorStack(error), path: req.path }, 'listAccessibleBranches failed');
    next(error);
  }
};

/**
 * GET /api/patients/:id/audit-trail
 * Riwayat audit pasien.
 */
export const getPatientAuditTrail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = getEffectiveBranch(req);
    const patientId = String(req.params.id);

    // Pastikan pasien ada di branch user
    const check = await pool.query(
      'SELECT 1 FROM patients WHERE id = $1 AND branch_id = $2 AND deleted_at IS NULL',
      [patientId, branchId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pasien tidak ditemukan' });
    }

    const result = await pool.query(
      `SELECT al.id, al.event_type, al.description, al.entity_type, al.created_at,
              u.username as actor
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE al.entity_id = $1 AND al.branch_id = $2
       ORDER BY al.created_at DESC`,
      [patientId, branchId]
    );

    res.status(200).json({
      success: true,
      data: result.rows.map((row) => ({
        id: row.id,
        eventType: row.event_type,
        description: row.description || '',
        createdAt: row.created_at,
        actorName: row.actor || 'System',
      })),
    });
  } catch (error: unknown) {
    logger.error({ error: getErrorMessage(error), stack: getErrorStack(error), path: req.path }, 'getPatientAuditTrail failed');
    next(error);
  }
};

/**
 * POST /api/patients/merge
 * Gabungkan pasien duplikat ke pasien utama.
 * Body: { primaryId, duplicateIds }
 */
export const mergePatients = async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const branchId = getEffectiveBranch(req);
    const { primaryId, duplicateIds } = req.body || {};

    if (!primaryId || !Array.isArray(duplicateIds) || duplicateIds.length === 0) {
      return res.status(400).json({ success: false, message: 'primaryId dan duplicateIds wajib diisi' });
    }

    await client.query('BEGIN');

    const primaryCheck = await client.query(
      'SELECT 1 FROM patients WHERE id = $1 AND branch_id = $2 AND deleted_at IS NULL',
      [primaryId, branchId]
    );
    if (primaryCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Pasien utama tidak ditemukan' });
    }

    let mergedCount = 0;
    for (const dupId of duplicateIds) {
      const dupCheck = await client.query(
        'SELECT 1 FROM patients WHERE id = $1 AND branch_id = $2 AND deleted_at IS NULL',
        [dupId, branchId]
      );
      if (dupCheck.rows.length === 0) continue;

      await client.query('UPDATE bookings SET patient_id = $1 WHERE patient_id = $2', [primaryId, dupId]);
      await client.query('UPDATE encounters SET patient_id = $1 WHERE patient_id = $2', [primaryId, dupId]);
      await client.query('UPDATE invoices SET patient_id = $1 WHERE patient_id = $2', [primaryId, dupId]);
      await client.query(
        'UPDATE patients SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1',
        [dupId]
      );
      mergedCount++;
    }

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      data: { primaryId, mergedCount },
      message: `${mergedCount} pasien digabungkan`,
    });
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    logger.error({ error: getErrorMessage(error), stack: getErrorStack(error), path: req.path }, 'mergePatients failed');
    next(error);
  } finally {
    client.release();
  }
};