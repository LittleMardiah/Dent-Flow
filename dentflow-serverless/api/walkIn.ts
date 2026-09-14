import type { VercelRequest, VercelResponse } from '@vercel/node';
import express, { Request, Response } from 'express';
import { Router } from 'express';
import { getSupabase } from '../lib/supabase';
import { extractBearerToken, verifyJwt, requireRole, enforceTenant, AuthUser } from '../lib/auth';

// ============================================================
// Consolidated /walk-in — Task 2.4.1 (W1, FIRST WRITE)
// - Approach B: vercel.json rewrites /walk-in/:path* -> /api/walkIn?path=$1
// - Approach C: Express router di-mount prefix '/walk-in'
//   (Vercel kirim FULL URL ke lambda, terbukti di task 2.3.2c)
// Scope serverless saat ini: 1 endpoint WRITE (public, no auth):
//   POST /walk-in/create-profile    (create temporary profile)
// Parity Express: dentflow-backend/src/routes/walkIn.routes.ts
//                 dentflow-backend/src/handlers/walkIn.handler.ts
//                 dentflow-backend/src/services/walkIn.service.ts
// ============================================================

// Response shape = parity Express walkIn.handler:
//   success: { success: true, data, message }
//   error  : { success: false, message }
const fail = (res: Response, message: string, status = 400, code = 'ERROR') =>
  res.status(status).json({ success: false, message, error: code, timestamp: new Date().toISOString() });

interface AuthedRequest extends Request {
  user: AuthUser;
}

function nowTimeWIB(): string {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(11, 19);
}

const router: Router = express.Router();

// POST-only guard (parity: metode selain POST => 405 METHOD_NOT_ALLOWED).
const postOnly =
  (handler: (req: Request, res: Response) => unknown) =>
  (req: Request, res: Response) => {
    if (req.method !== 'POST') {
      return fail(res, 'Method not allowed', 405);
    }
    return handler(req, res);
  };

// ---------- POST /walk-in/create-profile ----------
// Public endpoint (rate-limited di Express via walkInRateLimiter) — tanpa auth.
// Rate limit di-skip di serverless (Vercel handling).
router.all('/create-profile', postOnly(async (req, res) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fail(res, 'ENV_MISSING: SUPABASE_* belum di-set.', 500);
  }

  // Parity Express walkIn.handler createTemporaryProfile.
  const body = (req.body || {}) as { fullName?: string; phone?: string; age?: string | number; branchId?: string };
  const { fullName, phone, age, branchId } = body;

  if (!fullName || !phone || !branchId) {
    return res.status(400).json({
      success: false,
      message: 'fullName, phone, and branchId are required',
    });
  }

  try {
    const supabase = getSupabase();

    // Parity Express walkIn.service.createTemporaryProfile:
    // INSERT INTO temporary_patients (branch_id, full_name, phone, age) RETURNING *
    const { data, error } = await supabase
      .from('temporary_patients')
      .insert({
        branch_id: branchId,
        full_name: fullName,
        phone,
        age: age ? parseInt(String(age), 10) : null,
      })
      .select('id, full_name, phone, branch_id')
      .maybeSingle();

    if (error || !data) {
      return fail(res, 'Failed to create temporary profile', 500);
    }

    return res.status(201).json({
      success: true,
      data: {
        tempPatientId: data.id,
        fullName: data.full_name,
        phone: data.phone,
        branchId: data.branch_id,
      },
      message: 'Profil temporer berhasil dibuat',
    });
  } catch (err: unknown) {
    return fail(res, 'Failed to create temporary profile', 500);
  }
}));

// ---------- POST /walk-in/book-appointment (W2) ----------
// Parity Express walkIn.handler.bookWalkInAppointment + walkIn.service.bookAppointment.
// Auth: ADMIN_BRANCH only (inline JWT verify — router-level auth middleware tidak
// bisa dipakai karena W1 /create-profile public/no-auth).
router.all('/book-appointment', postOnly(async (req, res) => {
  // Env guard parity checkIn.ts
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fail(res, 'ENV_MISSING: SUPABASE_* belum di-set.', 500, 'ENV_MISSING');
  }
  if (!process.env.JWT_SECRET) {
    return fail(res, 'ENV_MISSING: JWT_SECRET belum di-set.', 500, 'ENV_MISSING');
  }

  // Auth: ADMIN_BRANCH only (parity roleMiddleware(['ADMIN_BRANCH']))
  const authHeader = req.headers['authorization'];
  const token = extractBearerToken(typeof authHeader === 'string' ? authHeader : undefined);
  if (!token) return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');

  let user: AuthUser;
  try {
    user = verifyJwt(token);
    requireRole(user, ['ADMIN_BRANCH']);
    (req as AuthedRequest).user = user;
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 403) return fail(res, e.message || 'Forbidden', 403, 'FORBIDDEN');
    return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');
  }

  const body = (req.body || {}) as {
    tempPatientId?: string;
    doctorId?: string;
    branchId?: string;
    sessionSlotId?: string;
    bookingDate?: string;
  };

  if (!body.tempPatientId || !body.doctorId || !body.branchId || !body.bookingDate) {
    return fail(res, 'tempPatientId, doctorId, branchId, bookingDate wajib diisi', 400, 'VALIDATION_ERROR');
  }

  try {
    const supabase = getSupabase();
    let branchId = user.branchId;
    try {
      branchId = await enforceTenant(supabase, user, body.branchId);
    } catch (tenantErr: unknown) {
      const te = tenantErr as { statusCode?: number; message?: string };
      if (te.statusCode === 403) return fail(res, te.message || 'Forbidden', 403, 'FORBIDDEN');
      throw tenantErr;
    }

    // Resolve doctor (id = doctors.id per pre-audit)
    const { data: doctor, error: dErr } = await supabase
      .from('doctors')
      .select('id, branch_id')
      .eq('id', body.doctorId)
      .eq('branch_id', branchId)
      .maybeSingle();
    if (dErr) return fail(res, `DB error: ${dErr.message}`, 500, 'DB_ERROR');
    if (!doctor) return fail(res, 'Dokter tidak ditemukan', 404, 'DOCTOR_NOT_FOUND');

    // Verify temp_patient exists + branch scope
    const { data: temp, error: tErr } = await supabase
      .from('temporary_patients')
      .select('id')
      .eq('id', body.tempPatientId)
      .eq('branch_id', branchId)
      .maybeSingle();
    if (tErr) return fail(res, `DB error: ${tErr.message}`, 500, 'DB_ERROR');
    if (!temp) return fail(res, 'Profil temporer tidak ditemukan', 404, 'TEMP_PATIENT_NOT_FOUND');

    // Get next queue number via RPC
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_next_queue_number', {
      p_branch_id: branchId,
      p_doctor_id: body.doctorId,
      p_date: body.bookingDate,
    });
    if (rpcErr) return fail(res, `RPC error: ${rpcErr.message}`, 500, 'RPC_ERROR');
    const queueNumber = typeof rpcData === 'number' ? rpcData : Number(rpcData);

    // Generate booking code + check_in_code (parity checkIn.ts C2 pattern)
    const bookingCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // CRITICAL: booking_time NOT NULL (fix3 lesson). Pakai nowTimeWIB pattern.
    const bookingTime = nowTimeWIB();

    // INSERT booking
    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .insert({
        branch_id: branchId,
        patient_id: null,
        temp_patient_id: body.tempPatientId,
        doctor_id: body.doctorId,
        booking_date: body.bookingDate,
        booking_time: bookingTime,
        status: 'PAYMENT_CONFIRMED',  // parity Express walkIn.service.ts:143 (constraint migration 015)
        booking_code: bookingCode,
        check_in_code: bookingCode,
        is_walk_in: true,
        queue_number: queueNumber,
        dp_amount: 0,
      })
      .select('id')
      .maybeSingle();
    if (bErr) return fail(res, `DB error: ${bErr.message}`, 500, 'BOOKING_INSERT_ERROR');
    if (!booking) return fail(res, 'Gagal membuat booking', 500, 'BOOKING_INSERT_ERROR');

    // INSERT queue (WAITING)
    const { error: qErr } = await supabase.from('queues').insert({
      booking_id: booking.id,
      branch_id: branchId,
      doctor_id: body.doctorId,
      queue_number: queueNumber,
      status: 'WAITING',
    });
    if (qErr) return fail(res, `DB error: ${qErr.message}`, 500, 'QUEUE_INSERT_ERROR');

    // Audit WALK_IN_ADDED (parity Express W2)
    await supabase.from('audit_logs').insert({
      branch_id: branchId,
      user_id: user.userId,
      event_type: 'WALK_IN_ADDED',
      entity_type: 'BOOKING',
      entity_id: booking.id,
      new_values: { tempPatientId: body.tempPatientId, doctorId: body.doctorId, queueNumber },
      description: `Walk-in booking ditambahkan, queue number ${queueNumber}`,
    });

    return res.status(201).json({
      success: true,
      data: { bookingId: booking.id, queueNumber },
      message: 'Booking walk-in berhasil dibuat',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- 404 fallback domain walk-in ----------
router.use((req: Request, res: Response) => {
  return fail(res, 'Route tidak ditemukan di domain walk-in.', 404);
});

// ============================================================
// Vercel handler: mount router di prefix '/walk-in'
// ============================================================
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/walk-in', router);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel kirim FULL URL ke lambda (terbukti di 2.3.2c), jadi Express mount
  // prefix '/walk-in' match semua sub-path. Safeguard: kalau runtime strip
  // URL jadi destination saja (/api/walkIn) dan suffix masuk ?path=, rekonstruksi.
  const r = req as any;
  const captured = r.query && r.query.path ? r.query.path : undefined;
  if (captured) {
    const suffix = Array.isArray(captured) ? captured[0] : String(captured);
    const url = String(r.url || '');
    if (suffix && !url.includes(`/${suffix}`)) {
      r.url = `/walk-in/${suffix}`;
    }
  }
  return app(r, res as any);
}