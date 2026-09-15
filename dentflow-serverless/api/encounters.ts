import type { VercelRequest, VercelResponse } from '@vercel/node';
import express, { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { getSupabase } from '../lib/supabase';
import { extractBearerToken, verifyJwt, requireRole, AuthUser } from '../lib/auth';

// ============================================================
// Consolidated /api/encounters — READ ONLY (Batch 3)
// - Approach B: vercel.json rewrites /api/encounters/:path* -> /api/encounters?path=$1
// - Approach C: Express router di-mount prefix '/api/encounters'
//   (Vercel kirim FULL URL ke lambda, terbukti di task 2.3.2c)
// Scope serverless saat ini: 2 endpoint GET:
//   GET /api/encounters         (list + filter)
//   GET /api/encounters/:id     (detail)
// Parity Express: dentflow-backend/src/handlers/encounter.handler.ts
//                 (listEncounters, getEncounter)
// Write endpoint (POST/PUT/complete) SKIP -> Batch 4.
// ============================================================

// GET /:id di Express TIDAK pasang roleMiddleware (semua role authenticated boleh),
// sedangkan GET / dibatasi DOCTOR + ADMIN_BRANCH. Supaya satu router melayani dua
// level, ALLOWED_ROLES router = gabungan, lalu GET / restriksi ulang per-route.
const ALLOWED_ROLES = ['DOCTOR', 'ADMIN_BRANCH', 'PATIENT'];

// Response helpers. Catatan parity: handler Express encounter TIDAK mengirim field
// `timestamp` pada respons sukses; shape sukses ditulis manual ({ success, data,
// pagination? }) supaya persis. Error memakai helper fail (parity lib/response).
const fail = (res: Response, message: string, status = 400, code = 'ERROR') =>
  res.status(status).json({ success: false, error: code, message, timestamp: new Date().toISOString() });

const ok = (res: Response, data: unknown, message = 'OK', status = 200) =>
  res.status(status).json({ success: true, data, message, timestamp: new Date().toISOString() });

interface AuthedRequest extends Request {
  user: AuthUser;
}

const router: Router = express.Router();

// ---------- Auth + env guard (level router, parity 4 file lama) ----------
router.use((req: Request, res: Response, next: NextFunction) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fail(res, 'ENV_MISSING: SUPABASE_* belum di-set.', 500, 'ENV_MISSING');
  }
  if (!process.env.JWT_SECRET) {
    return fail(res, 'ENV_MISSING: JWT_SECRET belum di-set.', 500, 'ENV_MISSING');
  }

  const authHeader = req.headers['authorization'];
  const token = extractBearerToken(typeof authHeader === 'string' ? authHeader : undefined);
  if (!token) return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');

  try {
    const user = verifyJwt(token);
    requireRole(user, ALLOWED_ROLES);
    (req as AuthedRequest).user = user;
    next();
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 403) return fail(res, e.message || 'Forbidden', 403, 'FORBIDDEN');
    return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');
  }
});

// GET-only guard (parity: metode selain GET => 405 METHOD_NOT_ALLOWED).
const getOnly =
  (handler: (req: AuthedRequest, res: Response) => unknown) =>
  (req: Request, res: Response) => {
    if (req.method !== 'GET') {
      return fail(res, 'Method not allowed', 405, 'METHOD_NOT_ALLOWED');
    }
    return handler(req as AuthedRequest, res);
  };

// POST-only guard (parity: non-POST => 405 METHOD_NOT_ALLOWED).
const postOnly =
  (handler: (req: AuthedRequest, res: Response) => unknown) =>
  (req: Request, res: Response) => {
    if (req.method !== 'POST') {
      return fail(res, 'Method not allowed', 405, 'METHOD_NOT_ALLOWED');
    }
    return handler(req as AuthedRequest, res);
  };

// PUT-only guard (parity: non-PUT => 405 METHOD_NOT_ALLOWED).
const putOnly =
  (handler: (req: AuthedRequest, res: Response) => unknown) =>
  (req: Request, res: Response) => {
    if (req.method !== 'PUT') {
      return fail(res, 'Method not allowed', 405, 'METHOD_NOT_ALLOWED');
    }
    return handler(req as AuthedRequest, res);
  };

// ---------- POST /api/encounters (E1 startEncounter) ----------
// Parity: encounter.handler.startEncounter + service.startEncounter.
// Idempotent: duplicate booking_id → UPDATE EMR (bukan 409).
router.post('/', postOnly(async (req, res) => {
  const user = req.user;
  if (!['DOCTOR', 'ADMIN_BRANCH'].includes(user.role)) {
    return fail(res, 'Forbidden', 403, 'FORBIDDEN');
  }

  const body = (req.body || {}) as Record<string, unknown>;

  if (!body.bookingId || typeof body.bookingId !== 'string') {
    return fail(res, 'bookingId wajib diisi', 400, 'VALIDATION_ERROR');
  }

  // Parity StartEncounterSchema: complaint & treatment optionalNonEmpty,
  // diagnosis/prescription/notes optional string.
  const fields = ['complaint', 'treatment'] as const;
  for (const f of fields) {
    const v = body[f];
    if (v !== undefined && v !== null) {
      if (typeof v !== 'string' || !v.trim()) {
        return fail(res, `${f === 'complaint' ? 'Keluhan' : 'Tindakan'} wajib diisi`, 400, 'VALIDATION_ERROR');
      }
    }
  }

  try {
    const supabase = getSupabase();

    // Baca booking + scope branch
    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .select('id, branch_id, doctor_id, patient_id, status')
      .eq('id', body.bookingId as string)
      .eq('branch_id', user.branchId)
      .maybeSingle();
    if (bErr) return fail(res, `Database error: ${bErr.message}`, 500, 'DB_ERROR');
    if (!booking) return fail(res, 'Booking tidak ditemukan', 404, 'BOOKING_NOT_FOUND');

    // Status harus CHECKED_IN atau PAYMENT_CONFIRMED (parity service)
    if (!['CHECKED_IN', 'PAYMENT_CONFIRMED'].includes(booking.status)) {
      return fail(res, 'Booking belum siap untuk pemeriksaan', 409, 'INVALID_BOOKING_STATUS');
    }

    // Idempotent: cek existing encounter by booking_id
    const { data: existing, error: eErr } = await supabase
      .from('encounters')
      .select('id')
      .eq('booking_id', booking.id)
      .maybeSingle();
    if (eErr) return fail(res, `Database error: ${eErr.message}`, 500, 'DB_ERROR');

    const emrData = {
      complaint: (typeof body.complaint === 'string' && body.complaint.trim()) || null,
      treatment: (typeof body.treatment === 'string' && body.treatment.trim()) || null,
      diagnosis: (typeof body.diagnosis === 'string' && body.diagnosis.trim()) || null,
      prescription: (typeof body.prescription === 'string' && body.prescription.trim()) || null,
      notes: (typeof body.notes === 'string' && body.notes.trim()) || null,
    };

    if (existing) {
      // IDEMPOTENT: duplicate → UPDATE EMR (bukan 409) — parity service
      const { error: updErr } = await supabase
        .from('encounters')
        .update({
          complaint: emrData.complaint,
          treatment: emrData.treatment,
          diagnosis: emrData.diagnosis,
          prescription: emrData.prescription,
          notes: emrData.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (updErr) return fail(res, `Database error: ${updErr.message}`, 500, 'DB_ERROR');

      await supabase.from('audit_logs').insert({
        branch_id: booking.branch_id,
        user_id: user.userId,
        event_type: 'EMR_UPDATED',
        entity_type: 'ENCOUNTER',
        entity_id: existing.id,
        description: `Encounter updated for booking ${booking.id}`,
      });

      return ok(res, { id: existing.id, bookingId: booking.id }, 'Pemeriksaan berhasil dimulai');
    }

    // INSERT encounter baru
    const { data: created, error: insErr } = await supabase
      .from('encounters')
      .insert({
        branch_id: booking.branch_id,
        booking_id: booking.id,
        doctor_id: booking.doctor_id,
        patient_id: booking.patient_id,
        complaint: emrData.complaint,
        treatment: emrData.treatment,
        diagnosis: emrData.diagnosis,
        prescription: emrData.prescription,
        notes: emrData.notes,
      })
      .select('id')
      .maybeSingle();

    if (insErr) {
      // Race condition: UNIQUE(booking_id) violation → treat as idempotent
      if (String(insErr.message || '').includes('duplicate key')) {
        const { data: refetch } = await supabase
          .from('encounters')
          .select('id')
          .eq('booking_id', booking.id)
          .maybeSingle();
        return ok(res, { id: refetch?.id, bookingId: booking.id }, 'Pemeriksaan berhasil dimulai');
      }
      return fail(res, `Database error: ${insErr.message}`, 500, 'DB_ERROR');
    }
    if (!created) return fail(res, 'Gagal membuat encounter', 500, 'DB_ERROR');

    await supabase.from('audit_logs').insert({
      branch_id: booking.branch_id,
      user_id: user.userId,
      event_type: 'ENCOUNTER_STARTED',
      entity_type: 'ENCOUNTER',
      entity_id: created.id,
      description: `Encounter started for booking ${booking.id}`,
    });

    return res.status(201).json({
      success: true,
      data: { id: created.id, bookingId: booking.id },
      message: 'Pemeriksaan berhasil dimulai',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- GET /api/encounters (list + filter) ----------
router.all('/', getOnly(async (req, res) => {
  const user = req.user;

  // Parity route: roleMiddleware(['DOCTOR', 'ADMIN_BRANCH']) di Express.
  if (!['DOCTOR', 'ADMIN_BRANCH'].includes(user.role)) {
    return fail(res, 'Forbidden: role tidak diizinkan untuk endpoint ini.', 403, 'FORBIDDEN');
  }

  const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 1), 100);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    const supabase = getSupabase();

    // List selalu branch-scope ke user.branchId (parity WHERE e.branch_id = user.branchId).
    let query = supabase
      .from('encounters')
      .select(
        `id, started_at, created_at, treatment, status, patients:patient_id ( full_name )`,
        { count: 'exact' }
      )
      .eq('branch_id', user.branchId);

    // DOCTOR: hanya encounter miliknya sendiri. Dokter di-resolve via doctors.user_id
    // (parity Express yang query: SELECT id FROM doctors WHERE user_id = $1).
    if (user.role === 'DOCTOR') {
      const { data: doctorRow, error: doctorErr } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', user.userId)
        .maybeSingle();
      if (doctorErr) return fail(res, `Database error: ${doctorErr.message}`, 500, 'DB_ERROR');
      if (!doctorRow) return fail(res, 'Data dokter tidak ditemukan', 404, 'DOCTOR_NOT_FOUND');
      query = query.eq('doctor_id', doctorRow.id);
    } else if (typeof req.query.doctor_id === 'string' && req.query.doctor_id) {
      const doctorId = String(req.query.doctor_id);
      query = query.eq('doctor_id', doctorId);
    }

    if (typeof req.query.status === 'string' && req.query.status) {
      query = query.eq('status', String(req.query.status).toUpperCase());
    }

    // Parity Express: COALESCE(e.started_at, e.created_at)::date. started_at selalu
    // terisi (DEFAULT CURRENT_TIMESTAMP), jadi filter cukup di started_at.
    // date_from => '>= YYYY-MM-DDT00:00:00'; date_to => '<= YYYY-MM-DDT23:59:59.999'
    // (ekuivalen dgn ::date pada express).
    if (typeof req.query.date_from === 'string' && req.query.date_from) {
      query = query.gte('started_at', `${req.query.date_from}T00:00:00+00:00`);
    }
    if (typeof req.query.date_to === 'string' && req.query.date_to) {
      query = query.lte('started_at', `${req.query.date_to}T23:59:59.999+00:00`);
    }

    query = query.order('started_at', { ascending: false }).range(from, to);

    const { data, error: dbErr, count } = await query;
    if (dbErr) return fail(res, `Database error: ${dbErr.message}`, 500, 'DB_ERROR');

    const total = count || 0;
    const items = (data || []).map((row: any) => ({
      id: row.id,
      encounterDate: row.started_at || row.created_at || null,
      patientName: row.patients?.full_name || '',
      treatment: row.treatment || '',
      status: row.status,
    }));

    res.status(200).json({
      success: true,
      data: items,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- PUT /api/encounters/:id (E2 updateEncounter) ----------
// Parity: encounter.handler.updateEncounter + service.updateEncounter.
// OWNERSHIP: DOCTOR wajib match encounter.doctor_id (deviasi positif vs Express).
router.put('/:id', putOnly(async (req, res) => {
  const user = req.user;
  if (!['DOCTOR', 'ADMIN_BRANCH'].includes(user.role)) {
    return fail(res, 'Forbidden', 403, 'FORBIDDEN');
  }

  const encounterId = req.params.id as string;
  if (!encounterId) return fail(res, 'Parameter id wajib diisi', 400, 'VALIDATION_ERROR');

  const body = (req.body || {}) as Record<string, unknown>;
  const fields = ['complaint', 'treatment', 'diagnosis', 'prescription', 'notes'];
  const hasField = fields.some(f => body[f] !== undefined);
  if (!hasField) {
    return fail(res, 'Tidak ada field yang diupdate', 400, 'NO_FIELDS_TO_UPDATE');
  }

  try {
    const supabase = getSupabase();

    // Baca encounter (branch scope)
    const { data: enc, error: eErr } = await supabase
      .from('encounters')
      .select('id, branch_id, booking_id, doctor_id, status')
      .eq('id', encounterId)
      .eq('branch_id', user.branchId)
      .maybeSingle();
    if (eErr) return fail(res, `Database error: ${eErr.message}`, 500, 'DB_ERROR');
    if (!enc) return fail(res, 'Pemeriksaan tidak ditemukan', 404, 'ENCOUNTER_NOT_FOUND');

    // Status harus ONGOING (parity service)
    if (enc.status !== 'ONGOING') {
      return fail(res, 'Pemeriksaan sudah selesai atau dibatalkan', 409, 'ENCOUNTER_NOT_ONGOING');
    }

    // OWNERSHIP: DOCTOR harus match encounter.doctor_id (deviasi positif)
    if (user.role === 'DOCTOR') {
      const { data: doc, error: dErr } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', user.userId)
        .maybeSingle();
      if (dErr) return fail(res, `Database error: ${dErr.message}`, 500, 'DB_ERROR');
      if (!doc || doc.id !== enc.doctor_id) {
        return fail(res, 'Anda tidak memiliki akses ke pemeriksaan ini', 403, 'ACCESS_DENIED');
      }
    }

    // Dynamic UPDATE
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of fields) {
      const v = body[f];
      if (v !== undefined) updates[f] = v;
    }

    const { error: updErr } = await supabase
      .from('encounters')
      .update(updates)
      .eq('id', encounterId);
    if (updErr) return fail(res, `Database error: ${updErr.message}`, 500, 'DB_ERROR');

    await supabase.from('audit_logs').insert({
      branch_id: enc.branch_id,
      user_id: user.userId,
      event_type: 'EMR_UPDATED',
      entity_type: 'ENCOUNTER',
      entity_id: encounterId,
      description: 'EMR updated',
    });

    return ok(res, { id: encounterId }, 'Pemeriksaan berhasil diperbarui');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- GET /api/encounters/:id (detail) ----------
router.all('/:id', getOnly(async (req, res) => {
  const user = req.user;
  const encounterId = req.params.id;
  if (!encounterId) return fail(res, 'Parameter id pemeriksaan wajib diisi', 400, 'VALIDATION_ERROR');

  try {
    const supabase = getSupabase();

    // Parity Express getEncounterById: SELECT e.* WHERE e.id = $1.
    const { data: encounter, error: dbErr } = await supabase
      .from('encounters')
      .select('*')
      .eq('id', encounterId)
      .maybeSingle();

    if (dbErr) return fail(res, `Database error: ${dbErr.message}`, 500, 'DB_ERROR');
    if (!encounter) return fail(res, 'Pemeriksaan tidak ditemukan', 404, 'ENCOUNTER_NOT_FOUND');

    // PATIENT: hanya encounter milik pasien terkait (parity Express via patients.user_id).
    if (user.role === 'PATIENT') {
      const { data: patientRow } = await supabase
        .from('patients')
        .select('id')
        .eq('user_id', user.userId)
        .maybeSingle();
      if (!patientRow || patientRow.id !== encounter.patient_id) {
        return fail(res, 'Anda tidak memiliki akses ke pemeriksaan ini', 403, 'ACCESS_DENIED');
      }
    }

    // DOCTOR: hanya encounter miliknya sendiri. Express salah bandingkan doctor_id
    // (doctors.id) dengan userId (users.id) — deviasi: resolve dokter via doctors.user_id
    // (pola yang sama dgn listEncounters) supaya DOCTOR tetap bisa akses detail.
    if (user.role === 'DOCTOR') {
      const { data: doctorRow } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', user.userId)
        .maybeSingle();
      if (!doctorRow || doctorRow.id !== encounter.doctor_id) {
        return fail(res, 'Anda tidak memiliki akses ke pemeriksaan ini', 403, 'ACCESS_DENIED');
      }
    }

    res.status(200).json({
      success: true,
      data: {
        id: encounter.id,
        bookingId: encounter.booking_id,
        doctorId: encounter.doctor_id,
        patientId: encounter.patient_id,
        branchId: encounter.branch_id,
        complaint: encounter.complaint,
        treatment: encounter.treatment,
        diagnosis: encounter.diagnosis,
        prescription: encounter.prescription,
        notes: encounter.notes,
        status: encounter.status,
        startedAt: encounter.started_at,
        completedAt: encounter.completed_at,
        createdAt: encounter.created_at,
        updatedAt: encounter.updated_at,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- 404 fallback domain encounters ----------
router.use((req: Request, res: Response) => {
  return fail(res, 'Route tidak ditemukan di domain encounters.', 404, 'NOT_FOUND');
});

// ============================================================
// Vercel handler: mount router di prefix '/api/encounters'
// ============================================================
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api/encounters', router);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel kirim FULL URL ke lambda (terbukti di 2.3.2c), jadi Express mount
  // prefix '/api/encounters' match semua sub-path. Safeguard: kalau runtime strip
  // URL jadi destination saja (/api/encounters) dan suffix masuk ?path=, rekonstruksi.
  const r = req as any;
  const captured = r.query && r.query.path ? r.query.path : undefined;
  if (captured) {
    const suffix = Array.isArray(captured) ? captured[0] : String(captured);
    const url = String(r.url || '');
    if (suffix && !url.includes(`/${suffix}`)) {
      r.url = `/api/encounters/${suffix}`;
    }
  }
  return app(r, res as any);
}