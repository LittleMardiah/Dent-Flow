import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { logger } from '../utils/logger';

/**
 * Query profil dokter berdasarkan users.id (dari JWT req.user.userId).
 * encounters.doctor_id merujuk ke doctors.id (FK fk_encounters_doctor),
 * sedangkan profil login dokter diambil lewat join doctors.user_id = users.id.
 */
const PROFILE_QUERY = `
  SELECT d.id, d.user_id, d.full_name, d.specialization, d.license_number,
         d.branch_id, d.created_at, d.updated_at,
         u.email, u.phone,
         b.name AS branch_name
  FROM doctors d
  JOIN users u ON u.id = d.user_id
  LEFT JOIN branches b ON b.id = d.branch_id
`;

const mapDoctorProfile = (row: any) => ({
  id: row.id,
  userId: row.user_id,
  fullName: row.full_name,
  email: row.email || '',
  phone: row.phone || '',
  specialization: row.specialization || '',
  licenseNumber: row.license_number || '',
  branchId: row.branch_id,
  branchName: row.branch_name || '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const fetchDoctorProfile = async (userId: string) => {
  const result = await pool.query(`${PROFILE_QUERY} WHERE d.user_id = $1`, [userId]);
  return result.rows[0] ? mapDoctorProfile(result.rows[0]) : null;
};

/**
 * GET /api/doctors/me
 * Profil dokter yang sedang login.
 */
export const getDoctorProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const profile = await fetchDoctorProfile(userId);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profil dokter tidak ditemukan',
        error: 'DOCTOR_PROFILE_NOT_FOUND',
      });
    }

    res.status(200).json({ success: true, data: profile });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'getDoctorProfile failed');
    next(error);
  }
};

/**
 * PUT /api/doctors/me
 * Update phone & email dokter (kolom di tabel users).
 */
export const updateDoctorProfile = async (req: Request, res: Response, next: NextFunction) => {
  const client = await pool.connect();
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { phone, email } = req.body || {};
    if (phone === undefined && email === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Minimal satu field (phone / email) harus diisi',
      });
    }

    const profile = await fetchDoctorProfile(userId);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profil dokter tidak ditemukan',
        error: 'DOCTOR_PROFILE_NOT_FOUND',
      });
    }

    await client.query('BEGIN');

    if (email !== undefined) {
      if (typeof email !== 'string' || !String(email).trim()) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Format email tidak valid' });
      }
      const dup = await client.query(
        'SELECT id FROM users WHERE email = $1 AND id <> $2',
        [String(email).trim(), userId]
      );
      if (dup.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Email sudah digunakan oleh pengguna lain',
        });
      }
    }

    await client.query(
      `UPDATE users
       SET email = COALESCE($1, email),
           phone = COALESCE($2, phone),
           updated_at = NOW()
       WHERE id = $3`,
      [email !== undefined ? String(email).trim() : null, phone !== undefined ? String(phone) : null, userId]
    );

    await client.query('COMMIT');

    const updated = await fetchDoctorProfile(userId);
    res.status(200).json({
      success: true,
      data: updated,
      message: 'Profil dokter berhasil diperbarui',
    });
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'updateDoctorProfile failed');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * GET /api/doctors/:id/patients
 * Daftar pasien yang pernah di-handle dokter ini (berbasis encounters).
 * Catatan: :id adalah doctors.id (record doctors). encounters.doctor_id
 * merujuk ke doctors.id, bukan users.id (lihat FK fk_encounters_doctor).
 */
export const getDoctorPatients = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doctorId = String(req.params.id);
    const branchId = (req as any).branchId || req.user?.branchId;
    if (!branchId) {
      return res.status(400).json({ success: false, message: 'Branch tidak terdeteksi' });
    }

    const doctorCheck = await pool.query(
      'SELECT id FROM doctors WHERE id = $1 AND branch_id = $2',
      [doctorId, branchId]
    );
    if (doctorCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Dokter tidak ditemukan di branch ini',
        error: 'DOCTOR_NOT_FOUND',
      });
    }

    const result = await pool.query(
      `SELECT DISTINCT p.id, p.full_name, p.phone, u.email,
              COUNT(e.id)::int AS total_visits,
              MAX(COALESCE(e.started_at, e.created_at)) AS last_visit
       FROM encounters e
       JOIN patients p ON p.id = e.patient_id
       JOIN users u ON u.id = p.user_id
       WHERE e.doctor_id = $1
         AND p.deleted_at IS NULL
       GROUP BY p.id, p.full_name, p.phone, u.email
       ORDER BY last_visit DESC`,
      [doctorId]
    );

    const data = result.rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      phone: row.phone || '',
      email: row.email || '',
      totalVisits: row.total_visits || 0,
      lastVisit: row.last_visit || null,
    }));

    res.status(200).json({ success: true, data });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'getDoctorPatients failed');
    next(error);
  }
};