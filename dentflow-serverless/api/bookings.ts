import type { VercelRequest, VercelResponse } from '@vercel/node';
import express, { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { getSupabase } from '../lib/supabase';
import { extractBearerToken, verifyJwt, requireRole, AuthUser } from '../lib/auth';

const ALLOWED_ROLES = ['PATIENT', 'ADMIN_BRANCH'];

// ============================================================
// Consolidated /api/patient/bookings — Task 2.4.1 (B2, FIRST WRITE)
// - Approach B: vercel.json rewrites /api/patient/bookings/:path* -> /api/bookings?path=$1
// - Approach C: Express router di-mount prefix '/api/patient/bookings'
//   (Vercel kirim FULL URL ke lambda, terbukti di task 2.3.2c)
// Scope serverless saat ini: 1 endpoint WRITE:
//   PUT /api/patient/bookings/:id/cancel    (cancel booking)
// Parity Express: dentflow-backend/src/routes/booking.routes.ts
//                 dentflow-backend/src/handlers/booking.handler.ts (cancelBooking)
// ============================================================

// Response shape = parity Express booking.handler:
//   success: { success: true, message }
//   error  : { success: false, message }
const fail = (res: Response, message: string, status = 400) =>
  res.status(status).json({ success: false, message });

interface AuthedRequest extends Request {
  user: AuthUser;
}

const router: Router = express.Router();

// ---------- Auth + env guard (level router, parity booking.routes.ts authMiddleware) ----------
router.use((req: Request, res: Response, next: NextFunction) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fail(res, 'ENV_MISSING: SUPABASE_* belum di-set.', 500);
  }
  if (!process.env.JWT_SECRET) {
    return fail(res, 'ENV_MISSING: JWT_SECRET belum di-set.', 500);
  }

  const authHeader = req.headers['authorization'];
  const token = extractBearerToken(typeof authHeader === 'string' ? authHeader : undefined);
  if (!token) return fail(res, 'Unauthorized', 401);

  try {
    const user = verifyJwt(token);
    requireRole(user, ALLOWED_ROLES);
    (req as AuthedRequest).user = user;
    next();
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 403) return fail(res, e.message || 'Forbidden', 403);
    return fail(res, 'Unauthorized', 401);
  }
});

// PUT-only guard (parity: metode selain PUT => 405 METHOD_NOT_ALLOWED).
const putOnly =
  (handler: (req: AuthedRequest, res: Response) => unknown) =>
  (req: Request, res: Response) => {
    if (req.method !== 'PUT') {
      return fail(res, 'Method not allowed', 405);
    }
    return handler(req as AuthedRequest, res);
  };

// POST-only guard (parity: metode selain POST => 405 METHOD_NOT_ALLOWED).
const postOnly =
  (handler: (req: AuthedRequest, res: Response) => unknown) =>
  (req: Request, res: Response) => {
    if (req.method !== 'POST') {
      return fail(res, 'Method not allowed', 405);
    }
    return handler(req as AuthedRequest, res);
  };

// ---------- POST /api/patient/bookings (B1 createScheduledBooking) ----------
// Parity Express booking.handler.createScheduledBooking + service.
// Auth: PATIENT only.
// DEViation positive vs Express:
//   - Notif NOT in tx (TD-2.4.5 fix): skip, defer ke task notif terpisah.
//   - Sequential statement (Supabase, no nested tx).
// WAJIB SEBELUM /:id/cancel (route shadow lesson 2.4.2c).
router.post('/', postOnly(async (req, res) => {
  const user = req.user;
  if (user.role !== 'PATIENT') {
    return fail(res, 'Forbidden: endpoint ini untuk pasien', 403);
  }

  const body = (req.body || {}) as {
    doctorId?: string;
    bookingDate?: string;
    sessionSlotId?: string;
    notes?: string;
  };

  if (!body.doctorId || !body.bookingDate || !body.sessionSlotId) {
    return fail(res, 'doctorId, bookingDate, sessionSlotId wajib diisi', 400);
  }

  try {
    const supabase = getSupabase();

    // 1. Resolve patient_id dari JWT userId -> patients.user_id -> patients.id
    const { data: patient, error: pErr } = await supabase
      .from('patients')
      .select('id, branch_id')
      .eq('user_id', user.userId)
      .maybeSingle();
    if (pErr) return fail(res, `Database error: ${pErr.message}`, 500);
    if (!patient) return fail(res, 'Pasien tidak ditemukan', 404);

    // 2. Resolve doctor (doctors.id di body, branch scope)
    const { data: doctor, error: dErr } = await supabase
      .from('doctors')
      .select('id, branch_id, is_available')
      .eq('id', body.doctorId)
      .eq('branch_id', patient.branch_id)
      .maybeSingle();
    if (dErr) return fail(res, `Database error: ${dErr.message}`, 500);
    if (!doctor) return fail(res, 'Dokter tidak ditemukan', 404);
    if (!doctor.is_available) return fail(res, 'Dokter tidak tersedia', 400);

    // 3. Verify session slot (doctor_schedules WHERE id + branch + is_active)
    const { data: slot, error: sErr } = await supabase
      .from('doctor_schedules')
      .select('id, branch_id, session_start, session_end, max_patients_per_session, is_active')
      .eq('id', body.sessionSlotId)
      .eq('branch_id', patient.branch_id)
      .eq('is_active', true)
      .maybeSingle();
    if (sErr) return fail(res, `Database error: ${sErr.message}`, 500);
    if (!slot) return fail(res, 'Jadwal dokter tidak ditemukan', 400);

    // 4. Slot capacity check (parity Express slotAvailabilityService.checkSlotAvailability)
    // COUNT bookings WHERE doctor_id + session_start + booking_date, NOT IN (CANCELLED, NO_SHOW).
    // TOCTOU acceptable (parity Express).
    const maxCap = Number(slot.max_patients_per_session) || 4;
    const dateStr = body.bookingDate;
    const sessionStartTimestamp = `${dateStr} ${slot.session_start}`;
    const sessionEndTimestamp = `${dateStr} ${slot.session_end}`;
    const { count, error: cErr } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('doctor_id', body.doctorId)
      .eq('session_start', sessionStartTimestamp)
      .eq('booking_date', dateStr)
      .not('status', 'in', '(CANCELLED,NO_SHOW)');
    if (cErr) return fail(res, `Database error: ${cErr.message}`, 500);
    if ((count || 0) >= maxCap) {
      return fail(res, `Slot penuh. Maksimal ${maxCap} pasien per sesi.`, 409);
    }

    // 5. Generate booking code (6 char uppercase alphanumeric, parity Express)
    const bookingCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // 6. booking_time NOT NULL (task 2.4.3b-W2-FIX lesson). Pakai nowTimeWIB pattern.
    const now = new Date();
    const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const bookingTime = wib.toISOString().slice(11, 19);

    // 7. INSERT booking (status='PENDING_PAYMENT', dp_amount default 50000)
    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .insert({
        branch_id: patient.branch_id,
        patient_id: patient.id,
        doctor_id: body.doctorId,
        booking_date: dateStr,
        booking_time: bookingTime,
        session_start: sessionStartTimestamp,
        session_end: sessionEndTimestamp,
        status: 'PENDING_PAYMENT',
        booking_code: bookingCode,
        check_in_code: bookingCode,
        is_walk_in: false,
        patient_notes: body.notes || null,
      })
      .select('id, booking_code')
      .maybeSingle();
    if (bErr) return fail(res, `Database error: ${bErr.message}`, 500);
    if (!booking) return fail(res, 'Gagal membuat booking', 500);

    // 8. Audit BOOKING_CREATED (best-effort, jangan block response)
    const { error: auditErr } = await supabase.from('audit_logs').insert({
      branch_id: patient.branch_id,
      user_id: user.userId,
      event_type: 'BOOKING_CREATED',
      entity_type: 'BOOKING',
      entity_id: booking.id,
      new_values: { booking_code: bookingCode, doctor_id: body.doctorId },
      description: `Booking created for patient ${patient.id}`,
    });
    if (auditErr) console.error('BOOKING_CREATED audit failed:', auditErr.message);

    // 9. NOTIF POST-COMMIT: SKIP (TD-2.4.5 fix).
    // Express calls sendBookingConfirmation INSIDE tx — bug (notif fail rolls back booking).
    // Serverless: defer ke task notif terpisah.

    return res.status(201).json({
      success: true,
      data: {
        bookingId: booking.id,
        bookingCode: booking.booking_code,
      },
      message: 'Booking berhasil dibuat',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500);
  }
}));

// ---------- PUT /api/patient/bookings/:id/cancel ----------
// Parity Express booking.handler cancelBooking.
router.all('/:id/cancel', putOnly(async (req, res) => {
  const user = req.user;
  const bookingId = req.params.id as string;
  const userId = user?.userId;
  const userRole = user?.role;
  const userBranch = user?.branchId;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const supabase = getSupabase();

    // Parity Express: SELECT * FROM bookings WHERE id = $1
    const { data: booking, error: e1 } = await supabase
      .from('bookings')
      .select('id, patient_id, branch_id, status')
      .eq('id', bookingId)
      .maybeSingle();
    if (e1) return fail(res, 'Internal server error', 500);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking tidak ditemukan' });

    // Authorization (parity logic Express)
    if (userRole === 'PATIENT') {
      const { data: patientRecord, error: eP } = await supabase
        .from('patients')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      if (eP) return fail(res, 'Internal server error', 500);
      const patientId = patientRecord?.id;
      if (booking.patient_id !== patientId) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
      if (['CHECKED_IN', 'COMPLETED', 'NO_SHOW', 'CANCELLED'].includes(booking.status)) {
        return res.status(409).json({ success: false, message: 'Booking tidak dapat dibatalkan' });
      }
    } else if (userRole === 'ADMIN_BRANCH') {
      if (booking.branch_id !== userBranch) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
    } else {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Parity Express: UPDATE bookings SET status='CANCELLED', updated_at=NOW() WHERE id=$1
    const { error: e2 } = await supabase
      .from('bookings')
      .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
      .eq('id', bookingId);
    if (e2) return fail(res, 'Internal server error', 500);

    return res.status(200).json({ success: true, message: 'Booking berhasil dibatalkan' });
  } catch (err: unknown) {
    return fail(res, 'Internal server error', 500);
  }
}));

// ---------- 404 fallback domain bookings ----------
router.use((req: Request, res: Response) => {
  return fail(res, 'Route tidak ditemukan di domain bookings.', 404);
});

// ============================================================
// Vercel handler: mount router di prefix '/api/patient/bookings'
// ============================================================
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api/patient/bookings', router);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel kirim FULL URL ke lambda (terbukti di 2.3.2c), jadi Express mount
  // prefix '/api/patient/bookings' match semua sub-path. Safeguard: kalau runtime
  // strip URL jadi destination saja (/api/bookings) dan suffix masuk ?path=, rekonstruksi.
  const r = req as any;
  const captured = r.query && r.query.path ? r.query.path : undefined;
  if (captured) {
    const suffix = Array.isArray(captured) ? captured[0] : String(captured);
    const url = String(r.url || '');
    if (suffix && !url.includes(`/${suffix}`)) {
      r.url = `/api/patient/bookings/${suffix}`;
    }
  }
  return app(r, res as any);
}