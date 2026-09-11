import { Request, Response, NextFunction } from 'express';
import { EncounterService } from '../services/encounter.service';
import { logger } from '../utils/logger';
import { pool } from '../config/database';

const encounterService = new EncounterService();

/**
 * POST /api/encounters
 * Start a new encounter (doctor only)
 */
export const startEncounter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bookingId, complaint, diagnosis, treatment, prescription, notes } = req.body;
    const doctorId = req.user?.userId;
    const branchId = req.user?.branchId;

    if (!doctorId || !branchId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'bookingId is required' });
    }

    const encounter = await encounterService.startEncounter(bookingId, doctorId, branchId, {
      complaint,
      diagnosis,
      treatment,
      prescription,
      notes,
    });
    res.status(201).json({
      success: true,
      data: encounter,
      message: 'Pemeriksaan berhasil dimulai',
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Error starting encounter');
    if (err.message === 'BOOKING_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Booking tidak ditemukan' });
    }
    if (err.message === 'BOOKING_NOT_READY_FOR_ENCOUNTER') {
      return res.status(409).json({ success: false, message: 'Booking belum siap untuk pemeriksaan' });
    }
    if (err.message === 'ENCOUNTER_ALREADY_EXISTS') {
      return res.status(409).json({ success: false, message: 'Pemeriksaan sudah dibuat untuk booking ini' });
    }
    next(error);
  }
};

/**
 * PUT /api/encounters/:id
 * Update encounter (doctor only)
 * NOTE: Service signature: updateEncounter(id, data, doctorId)
 */
export const updateEncounter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const encounterId = String(req.params.id);
    const doctorId = req.user?.userId;
    const { complaint, diagnosis, treatment, prescription, notes } = req.body;

    if (!doctorId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Correct order: (id, data, doctorId)
    const updated = await encounterService.updateEncounter(
      encounterId,
      {
        complaint,
        diagnosis,
        treatment,
        prescription,
        notes,
      },
      doctorId
    );

    res.status(200).json({
      success: true,
      data: updated,
      message: 'Pemeriksaan berhasil diperbarui',
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Error updating encounter');
    if (err.message === 'ENCOUNTER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Pemeriksaan tidak ditemukan' });
    }
    if (err.message === 'ENCOUNTER_NOT_ONGOING') {
      return res.status(409).json({ success: false, message: 'Pemeriksaan sudah selesai atau dibatalkan' });
    }
    if (err.message === 'NO_FIELDS_TO_UPDATE') {
      return res.status(400).json({ success: false, message: 'Tidak ada field yang diupdate' });
    }
    next(error);
  }
};

/**
 * POST /api/encounters/:id/complete
 * Complete encounter (doctor only) -> triggers invoice
 */
export const completeEncounter = async (req: Request, res: Response, next: NextFunction) => {
  console.log("🔍 [completeEncounter] START for encounterId:", req.params.id);
  try {
    const encounterId = String(req.params.id);
    const doctorId = req.user?.userId;

    if (!doctorId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const result = await encounterService.completeEncounter(encounterId, doctorId);
  console.log("🔍 [completeEncounter] AFTER service call, result:", result);
    res.status(200).json({
      success: true,
      data: {
        encounter: result.encounter,
        invoice: result.invoice,
      },
      message: 'Pemeriksaan selesai, invoice dibuat',
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Error completing encounter');
    if (err.message === 'ENCOUNTER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Pemeriksaan tidak ditemukan' });
    }
    if (err.message === 'ENCOUNTER_NOT_ONGOING') {
      return res.status(409).json({ success: false, message: 'Pemeriksaan sudah selesai atau dibatalkan' });
    }
    next(error);
  }
};

/**
 * GET /api/encounters/:id
 * Get encounter by ID (patient or doctor)
 */
export const getEncounter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const encounterId = String(req.params.id);
    const userId = req.user?.userId;
    const userRole = req.user?.role || ''; // default to empty string

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const encounter = await encounterService.getEncounterById(encounterId, userId, userRole);
    res.status(200).json({
      success: true,
      data: encounter,
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Error getting encounter');
    if (err.message === 'ENCOUNTER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Pemeriksaan tidak ditemukan' });
    }
    if (err.message === 'ACCESS_DENIED') {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke pemeriksaan ini' });
    }
    next(error);
  }
};

/**
 * GET /api/encounters
 * List encounters dengan filter:
 *   - doctor_id  : filter dokter (hanya untuk ADMIN_BRANCH; DOCTOR selalu dilihatkan miliknya sendiri)
 *   - date_from  : mulai dari tanggal (e.started_at / e.created_at)
 *   - date_to    : sampai tanggal
 *   - status     : ONGOING | COMPLETED | CANCELLED
 * Response: { data: [...], pagination: { total, page, limit, pages } }
 */
export const listEncounters = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = (req as any).branchId || req.user?.branchId;
    const userRole = req.user?.role || '';
    const userId = req.user?.userId;

    if (!branchId || !userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const page = Math.max(parseInt(String(req.query.page || '1')) || 1, 1);
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20')) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const conditions: string[] = ['e.branch_id = $1'];
    const params: any[] = [branchId];
    let idx = 2;

    if (userRole === 'DOCTOR') {
      // Dokter hanya melihat encounter miliknya sendiri (doctor record-nya)
      const doctorResult = await pool.query(
        'SELECT id FROM doctors WHERE user_id = $1',
        [userId]
      );
      if (doctorResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Data dokter tidak ditemukan' });
      }
      conditions.push(`e.doctor_id = $${idx++}`);
      params.push(doctorResult.rows[0].id);
    } else if (req.query.doctor_id) {
      const doctorId = String(req.query.doctor_id);
      conditions.push(`e.doctor_id = $${idx++}`);
      params.push(doctorId);
    }

    if (req.query.status && typeof req.query.status === 'string') {
      conditions.push(`e.status = $${idx++}`);
      params.push(req.query.status.toUpperCase());
    }
    if (req.query.date_from && typeof req.query.date_from === 'string') {
      // Filter berdasarkan tanggal kalender (::date) supaya independen timezone DB (timestamp tanpa time zone)
      conditions.push(`COALESCE(e.started_at, e.created_at)::date >= $${idx}::date`);
      params.push(req.query.date_from);
      idx++;
    }
    if (req.query.date_to && typeof req.query.date_to === 'string') {
      conditions.push(`COALESCE(e.started_at, e.created_at)::date <= $${idx}::date`);
      params.push(req.query.date_to);
      idx++;
    }

    const whereSql = conditions.join(' AND ');

    const totalResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM encounters e WHERE ${whereSql}`,
      params
    );
    const total = totalResult.rows[0]?.total || 0;

    const listResult = await pool.query(
      `SELECT e.id,
              COALESCE(e.started_at, e.created_at) AS encounter_date,
              e.treatment,
              e.status,
              p.full_name AS patient_name
       FROM encounters e
       JOIN patients p ON p.id = e.patient_id
       WHERE ${whereSql}
       ORDER BY encounter_date DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    const data = listResult.rows.map((row) => ({
      id: row.id,
      encounterDate: row.encounter_date || null,
      patientName: row.patient_name || '',
      treatment: row.treatment || '',
      status: row.status,
    }));

    res.status(200).json({
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Error listing encounters');
    next(error);
  }
};
