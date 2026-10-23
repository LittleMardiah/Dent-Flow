import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { EncounterService } from '../services/encounter.service';
import { logger } from '../utils/logger';
import { pool } from '../config/database';
import { BUCKET, getPresignedUrl, uploadFile } from '../lib/storage';

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
              e.patient_id,
              COALESCE(e.started_at, e.created_at) AS created_at,
              e.complaint,
              e.diagnosis,
              e.treatment,
              e.status,
              p.full_name AS patient_name
       FROM encounters e
       JOIN patients p ON p.id = e.patient_id
       WHERE ${whereSql}
       ORDER BY COALESCE(e.started_at, e.created_at) DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    const data = listResult.rows.map((row) => ({
      id: row.id,
      patientId: row.patient_id,
      patientName: row.patient_name || '',
      complaint: row.complaint || '',
      diagnosis: row.diagnosis || null,
      treatment: row.treatment || '',
      status: row.status,
      createdAt: row.created_at || null,
    }));

    res.status(200).json({
      success: true,
      data: {
        data,
        total,
        page,
        totalPages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Error listing encounters');
    next(error);
  }
};


const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
]);

const DOCUMENT_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
};

const MAX_DOCUMENT_SIZE_BYTES = 5 * 1024 * 1024;

const findEncounterForBranch = async (encounterId: string, branchId: string) => {
  const result = await pool.query(
    'SELECT id, patient_id FROM encounters WHERE id = $1 AND branch_id = $2',
    [encounterId, branchId]
  );
  return result.rows[0];
};

/**
 * POST /api/encounters/:id/documents
 * Upload an EMR document to object storage (doctor only).
 */
export const uploadEncounterDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const encounterId = String(req.params.id);
    const userId = req.user?.userId;
    const branchId = req.user?.branchId;

    if (!userId || !branchId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'File wajib diupload dengan field "file"' });
    }
    if (file.size <= 0) {
      return res.status(400).json({ success: false, message: 'File kosong tidak diizinkan' });
    }
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      return res.status(400).json({ success: false, message: 'Ukuran file maksimal 5MB' });
    }
    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Tipe file tidak diizinkan (hanya JPEG, PNG, PDF)',
      });
    }

    const encounter = await findEncounterForBranch(encounterId, branchId);
    if (!encounter) {
      return res.status(404).json({ success: false, message: 'Pemeriksaan tidak ditemukan' });
    }

    const extension = DOCUMENT_EXTENSION_BY_MIME[file.mimetype];
    const objectName = `emr/${encounterId}/${randomUUID()}${extension}`;

    await uploadFile(file.buffer, objectName, file.mimetype);

    const insertResult = await pool.query(
      `INSERT INTO encounter_documents (
         id, encounter_id, patient_id, bucket, path, original_name, mime, size_bytes, uploaded_by
       ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, path`,
      [
        encounterId,
        encounter.patient_id,
        BUCKET,
        objectName,
        file.originalname,
        file.mimetype,
        file.size,
        userId,
      ]
    );

    const document = insertResult.rows[0];
    const url = await getPresignedUrl(document.path);

    return res.status(201).json({
      success: true,
      data: { id: document.id, url },
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Error uploading encounter document');
    next(error);
  }
};

/**
 * GET /api/encounters/:id/documents
 * List EMR documents for an encounter with presigned download URLs.
 */
export const listEncounterDocuments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const encounterId = String(req.params.id);
    const branchId = req.user?.branchId;

    if (!branchId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const encounter = await findEncounterForBranch(encounterId, branchId);
    if (!encounter) {
      return res.status(404).json({ success: false, message: 'Pemeriksaan tidak ditemukan' });
    }

    const result = await pool.query(
      `SELECT id, path, original_name, mime, size_bytes, created_at
       FROM encounter_documents
       WHERE encounter_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [encounterId]
    );

    const data = await Promise.all(
      result.rows.map(async (row) => ({
        id: row.id,
        originalName: row.original_name,
        mime: row.mime,
        sizeBytes: Number(row.size_bytes),
        createdAt: row.created_at,
        url: await getPresignedUrl(row.path),
      }))
    );

    return res.status(200).json({ success: true, data });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Error listing encounter documents');
    next(error);
  }
};
