import type { VercelRequest, VercelResponse } from '@vercel/node';
import express, { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { getSupabase } from '../lib/supabase';
import { extractBearerToken, verifyJwt, requireRole, enforceTenant, AuthUser } from '../lib/auth';

const ALLOWED_ROLES = ['PATIENT', 'ADMIN_BRANCH'];

// ============================================================
// Consolidated /api/bookings — Task 2.4.1 (B2, FIRST WRITE) + TD-2.4.9 (extend)
// - Approach B: vercel.json rewrites /api/patient/bookings/:path* -> /api/bookings?path=$1
//               vercel.json rewrites /api/admin/bookings/:path*  -> /api/bookings?path=admin/$1
// - Approach C: Express router di-mount prefix '/api/patient/bookings' + '/api/admin/bookings'
//   (Vercel kirim FULL URL ke lambda, terbukti di task 2.3.2c)
// Scope serverless saat ini:
//   PUT  /api/patient/bookings/:id/cancel          (cancel booking)
//   POST /api/patient/bookings                     (createScheduledBooking)
//   GET  /api/admin/bookings                       (list + filter status, TD-2.4.9)
//   POST /api/admin/bookings/:id/send-reminder     (N1, dipindah dari notifications.ts)
//   POST /api/admin/bookings/:id/send-confirmation  (N2, dipindah dari notifications.ts)
//   GET  /api/admin/audit-logs                      (list + filter + pagination, Step 2.3 FASE B)
//   GET  /api/admin/audit-logs/actions              (distinct event_type + count, Step 2.3 FASE B)
//   GET  /api/admin/queues                          (list queue hari ini, Step 2.5 FASE B)
//   DEFER: /api/audit-logs/export -> TD-2.4.25 (JANGAN implementasi, 404).
//   DEFER: /api/admin/queues/export -> TD-2.4.28 (JANGAN implementasi, 404).
// Parity Express: dentflow-backend/src/routes/booking.routes.ts
//                 dentflow-backend/src/routes/audit.routes.ts + audit.handler.ts
//                 dentflow-backend/src/handlers/booking.handler.ts (cancelBooking)
//                 dentflow-backend/src/handlers/notification.handler.ts (N1/N2)
// ============================================================

// Response shape = parity Express booking.handler:
//   success: { success: true, message }
//   error  : { success: false, message }
const fail = (res: Response, message: string, status = 400) =>
  res.status(status).json({ success: false, message });

// Admin helpers (TD-2.4.9): shape parity notifications.ts (admin booking domain,
// N1/N2 origin) — success: { success:true, data, timestamp }, error: { success:false, error, message, timestamp }.
const adminOk = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data, timestamp: new Date().toISOString() });
const adminFail = (res: Response, message: string, status = 400, code = 'ERROR') =>
  res.status(status).json({ success: false, error: code, message, timestamp: new Date().toISOString() });
const adminServerError = (res: Response) =>
  res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR', message: 'Server error' });

const ADMIN_ALLOWED_ROLES = ['ADMIN_BRANCH'];

// Valid status filter values (parity migration 015 status CHECK constraint).
const VALID_BOOKING_STATUSES = [
  'PENDING_PAYMENT',
  'PAYMENT_CONFIRMED',
  'CHECKED_IN',
  'COMPLETED',
  'NO_SHOW',
  'CANCELLED',
];

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
// Consolidated /api/admin/bookings — Task 2.4.9 (TD-2.4.9)
// - Approach B+C: vercel.json rewrites /api/admin/bookings/:path* ->
//   /api/bookings?path=admin/$1 (sebelumnya ke /api/notifications, N1/N2 dipindah
//   DARI notifications.ts ke sini supaya TIDAK break — task_2_4_2d root cause).
// - Express mount prefix '/api/admin/bookings' (Vercel kirim FULL URL, 2.3.2c).
// Scope serverless saat ini (ADMIN_BRANCH only, parity Express admin routes):
//   GET  /api/admin/bookings                 list + filter status + pagination
//   POST /api/admin/bookings/:id/send-reminder      (N1, moved dari notifications.ts)
//   POST /api/admin/bookings/:id/send-confirmation  (N2, moved dari notifications.ts)
// ============================================================
const adminRouter: Router = express.Router();

// ---------- Auth + env guard (level admin router, parity notification.routes.ts) ----------
// Semua route admin require ADMIN_BRANCH.
adminRouter.use((req: Request, res: Response, next: NextFunction) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return adminFail(res, 'ENV_MISSING: SUPABASE_* belum di-set.', 500, 'ENV_MISSING');
  }
  if (!process.env.JWT_SECRET) {
    return adminFail(res, 'ENV_MISSING: JWT_SECRET belum di-set.', 500, 'ENV_MISSING');
  }

  const authHeader = req.headers['authorization'];
  const token = extractBearerToken(typeof authHeader === 'string' ? authHeader : undefined);
  if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const user = verifyJwt(token);
    requireRole(user, ADMIN_ALLOWED_ROLES);
    (req as AuthedRequest).user = user;
    next();
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 403) return res.status(403).json({ success: false, error: e.message || 'Forbidden' });
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
});

// GET-only guard (parity: metode selain GET => 405 METHOD_NOT_ALLOWED).
const getOnly =
  (handler: (req: AuthedRequest, res: Response) => unknown) =>
  (req: Request, res: Response) => {
    if (req.method !== 'GET') {
      return adminFail(res, 'Method not allowed', 405, 'METHOD_NOT_ALLOWED');
    }
    return handler(req as AuthedRequest, res);
  };

// ---------- GET /api/admin/bookings (list + filter status + pagination) ----------
// Fix TD-2.4.9: frontend admin bisa discover BOOK_ID by status (S1 E2E blocker).
// Branch scope: bookings.branch_id = JWT user.branchId (parity Express authz).
// Join: patients.full_name + doctors.full_name (parity Express getPatientBookings LEFT JOIN).
// Response shape: serverless list convention { data: { data, total, page, totalPages } }.
adminRouter.all('/', getOnly(async (req, res) => {
  const user = req.user;
  if (!user?.branchId) {
    return adminFail(res, 'Unauthorized', 401, 'UNAUTHORIZED');
  }

  const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 1), 100);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const rawStatus = typeof req.query.status === 'string' ? String(req.query.status).trim().toUpperCase() : '';
  if (rawStatus && !VALID_BOOKING_STATUSES.includes(rawStatus)) {
    return adminFail(res, `Status tidak valid: ${rawStatus}`, 400, 'VALIDATION_ERROR');
  }

  try {
    const supabase = getSupabase();
    let query = supabase
      .from('bookings')
      .select(
        `id, booking_code, status, booking_date, session_start, session_end, created_at, doctor_id, patient_id, patients:patient_id ( full_name ), doctors:doctor_id ( full_name )`,
        { count: 'exact' }
      )
      .eq('branch_id', user.branchId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (rawStatus) {
      query = query.eq('status', rawStatus);
    }

    const { data, error: dbErr, count } = await query;
    if (dbErr) return adminFail(res, `Database error: ${dbErr.message}`, 500, 'DB_ERROR');

    const bookings = (data || []).map((row: any) => ({
      id: row.id,
      bookingCode: row.booking_code,
      status: row.status,
      bookingDate: row.booking_date,
      sessionStart: row.session_start,
      sessionEnd: row.session_end,
      createdAt: row.created_at,
      doctorId: row.doctor_id,
      patientId: row.patient_id,
      patientName: row.patients?.full_name || '',
      doctorName: row.doctors?.full_name || '',
    }));

    const total = count || 0;
    return adminOk(res, {
      data: bookings,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 0,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return adminFail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- Factory: send notification (N1 reminder / N2 confirmation) ----------
// MOVED dari notifications.ts (Task 2.4.9) supaya /api/admin/bookings domain
// terkonsolidasi di bookings.ts dan rewrite bisa pindah tanpa break N1/N2.
// Parity Express NotificationService: getPatientIdFromBooking + logNotification.
const notificationSender =
  (type: 'REMINDER' | 'CONFIRMATION', action: string) =>
  async (req: AuthedRequest, res: Response) => {
    const bookingId = req.params.id as string;
    const adminId = req.user?.userId;

    if (!adminId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    try {
      const supabase = getSupabase();

      // Parity getPatientIdFromBooking: SELECT patient_id FROM bookings WHERE id = $1
      const { data: booking, error: eb } = await supabase
        .from('bookings')
        .select('patient_id')
        .eq('id', bookingId)
        .maybeSingle();
      if (eb) return adminServerError(res);
      if (!booking) {
        return res.status(404).json({
          success: false,
          error: 'BOOKING_NOT_FOUND',
          message: 'Booking not found',
        });
      }

      // FIX (TD-2.4.9): notifications.patient_id FK -> users(id), sedangkan
      // bookings.patient_id = patients.id. Express sendReminderSMS/sendBookingConfirmation
      // insert bookings.patient_id langsung -> FK violation 23503 -> 500 (diag via
      // service role, task 2.4.9). Resolve patients.user_id dulu (parity pola
      // NotificationService.sendNoShowNotification) biar N1/N2 200.
      const { data: patientRec } = await supabase
        .from('patients')
        .select('user_id')
        .eq('id', booking.patient_id)
        .maybeSingle();
      const targetUserId = patientRec?.user_id;
      if (!targetUserId) return adminServerError(res);

      // Parity NotificationService content template.
      const content =
        type === 'CONFIRMATION'
          ? `Booking Anda telah dikonfirmasi. Kode booking: ${bookingId}. Terima kasih!`
          : `Pengingat: Anda memiliki janji temu hari ini. Kode booking: ${bookingId}`;

      const { error: e1 } = await supabase.from('notifications').insert({
        booking_id: bookingId,
        patient_id: targetUserId,
        type,
        status: 'SENT',
        sent_at: new Date().toISOString(),
        content,
      });
      if (e1) return adminServerError(res);

      return res.status(200).json({
        success: true,
        message: `${action} sent for booking ${bookingId}`,
      });
    } catch (err: unknown) {
      return adminServerError(res);
    }
  };

// ---------- POST /api/admin/bookings/:id/send-reminder (N1) ----------
adminRouter.all('/:id/send-reminder', postOnly(notificationSender('REMINDER', 'Reminder')));

// ---------- POST /api/admin/bookings/:id/send-confirmation (N2) ----------
adminRouter.all('/:id/send-confirmation', postOnly(notificationSender('CONFIRMATION', 'Confirmation')));

// ---------- 404 fallback domain admin bookings ----------
adminRouter.use((req: Request, res: Response) => {
  return adminFail(res, 'Route tidak ditemukan di domain admin bookings.', 404, 'NOT_FOUND');
});

// ============================================================
// /api/admin/audit-logs — Step 2.3 FASE B (serverless subset)
// - Approach B+C: vercel.json rewrites /api/audit-logs/:path* dan
//   /audit-logs/:path* -> /api/bookings?path=audit/$1 (marker 'audit/...').
// - Express mount prefix '/api/admin/audit-logs' (ADMIN_BRANCH only).
// Scope serverless saat ini (parity Express audit.routes.ts + audit.handler):
//   GET  /api/audit-logs          list + filter + pagination
//   GET  /api/audit-logs/actions  distinct event_type + count (desc)
//   DEFER /api/audit-logs/export  -> TD-2.4.25, JANGAN implementasi (404).
// ============================================================
const auditRouter: Router = express.Router();

// ---------- Auth + env guard (level audit router, parity audit.routes.ts) ----------
// Semua route audit require ADMIN_BRANCH.
auditRouter.use((req: Request, res: Response, next: NextFunction) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return adminFail(res, 'ENV_MISSING: SUPABASE_* belum di-set.', 500, 'ENV_MISSING');
  }
  if (!process.env.JWT_SECRET) {
    return adminFail(res, 'ENV_MISSING: JWT_SECRET belum di-set.', 500, 'ENV_MISSING');
  }

  const authHeader = req.headers['authorization'];
  const token = extractBearerToken(typeof authHeader === 'string' ? authHeader : undefined);
  if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const user = verifyJwt(token);
    requireRole(user, ADMIN_ALLOWED_ROLES);
    (req as AuthedRequest).user = user;
    next();
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 403) return res.status(403).json({ success: false, error: e.message || 'Forbidden' });
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
});

// Escape wildcard ILIKE (% _) biar search literal (Supabase/PostgREST pakai
// backslash default escape di pattern ILIKE).
const escapeLike = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

// ---------- GET /api/admin/audit-logs (list + filter + pagination) ----------
// Branch scope: audit_logs.branch_id = enforceTenant(user, branchId query) —
// default JWT user.branchId. Join users untuk username (LEFT JOIN, fallback 'System').
// Footgun #3 (pre-audit): field action DIISI dari event_type.
auditRouter.all('/', getOnly(async (req, res) => {
  const user = req.user;
  if (!user?.branchId) {
    return adminFail(res, 'Unauthorized', 401, 'UNAUTHORIZED');
  }

  const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 1), 100);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    const supabase = getSupabase();

    const rawBranch = req.query.branchId;
    const requestedBranchId = typeof rawBranch === 'string' && rawBranch.length > 0 ? rawBranch : undefined;
    let branchId: string;
    try {
      branchId = await enforceTenant(supabase, user, requestedBranchId);
    } catch (tenantErr: unknown) {
      const e = tenantErr as { statusCode?: number; message?: string };
      if (e.statusCode === 403) return adminFail(res, e.message || 'Forbidden', 403, 'FORBIDDEN');
      throw tenantErr;
    }

    let query = supabase
      .from('audit_logs')
      .select(
        `id, event_type, entity_type, entity_id, old_values, new_values, description, ip_address, created_at, users:user_id ( username )`,
        { count: 'exact' }
      )
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .range(from, to);

    const eventType = typeof req.query.eventType === 'string' ? String(req.query.eventType).trim() : '';
    if (eventType) query = query.eq('event_type', eventType);

    const entityType = typeof req.query.entityType === 'string' ? String(req.query.entityType).trim() : '';
    if (entityType) query = query.eq('entity_type', entityType);

    const entityId = typeof req.query.entityId === 'string' ? String(req.query.entityId).trim() : '';
    if (entityId) query = query.eq('entity_id', entityId);

    const search = typeof req.query.search === 'string' ? String(req.query.search).trim() : '';
    if (search) query = query.ilike('description', `%${escapeLike(search)}%`);

    const dateFrom = typeof req.query.dateFrom === 'string' ? String(req.query.dateFrom).trim() : '';
    if (dateFrom) query = query.gte('created_at', dateFrom);

    const dateTo = typeof req.query.dateTo === 'string' ? String(req.query.dateTo).trim() : '';
    if (dateTo) query = query.lte('created_at', dateTo);

    const { data, error: dbErr, count } = await query;
    if (dbErr) return adminFail(res, `Database error: ${dbErr.message}`, 500, 'DB_ERROR');

    const logs = (data || []).map((row: any) => ({
      id: row.id,
      eventType: row.event_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      action: row.event_type,
      description: row.description || '',
      changes: { old: row.old_values, new: row.new_values },
      userAgent: undefined,
      actor: { username: row.users?.username || 'System' },
      createdAt: row.created_at,
      ipAddress: row.ip_address,
    }));

    const total = count || 0;
    return adminOk(res, {
      data: logs,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 0,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return adminFail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- GET /api/admin/audit-logs/actions (distinct event_type + count) ----------
auditRouter.all('/actions', getOnly(async (req, res) => {
  const user = req.user;
  if (!user?.branchId) {
    return adminFail(res, 'Unauthorized', 401, 'UNAUTHORIZED');
  }

  try {
    const supabase = getSupabase();

    const rawBranch = req.query.branchId;
    const requestedBranchId = typeof rawBranch === 'string' && rawBranch.length > 0 ? rawBranch : undefined;
    let branchId: string;
    try {
      branchId = await enforceTenant(supabase, user, requestedBranchId);
    } catch (tenantErr: unknown) {
      const e = tenantErr as { statusCode?: number; message?: string };
      if (e.statusCode === 403) return adminFail(res, e.message || 'Forbidden', 403, 'FORBIDDEN');
      throw tenantErr;
    }

    const { data, error: dbErr } = await supabase
      .from('audit_logs')
      .select('event_type')
      .eq('branch_id', branchId);
    if (dbErr) return adminFail(res, `Database error: ${dbErr.message}`, 500, 'DB_ERROR');

    const counts = new Map<string, number>();
    for (const row of data || []) {
      const key = (row as { event_type?: string })?.event_type;
      if (!key) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const actions = Array.from(counts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count);

    return adminOk(res, actions);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return adminFail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- 404 fallback domain audit logs ----------
auditRouter.use((req: Request, res: Response) => {
  return adminFail(res, 'Route tidak ditemukan di domain audit logs.', 404, 'NOT_FOUND');
});

// ============================================================
// /api/admin/queues — Step 2.5 FASE B (serverless subset)
// - Approach B+C: vercel.json rewrites /api/admin/queues/:path* dan
//   /admin/queues/:path* -> /api/bookings?path=admin-queues/$1
//   (marker 'admin-queues/...').
// - Express mount prefix '/api/admin/queues' (ADMIN_BRANCH only).
// Parity Express: dentflow-backend/src/handlers/adminQueue.handler.ts
//                 dentflow-backend/src/routes/admin.routes.ts (GET /queues)
// LEVEL-KEPUTUSAN (deviasi di bawah, jangan diubah tanpa twg):
//   - Walk-in EXCLUDED (INNER JOIN patients, parity Express). JANGAN COALESCE.
//   - Branch scope: user.branchId (Express pakai query branchId — security fix).
//   - Response: { success, data (flat QueuePatient[]), total (data.length), nowServing } —
//     parity Express adminQueue.handler.ts:58-68. TANPA page/totalPages/timestamp.
//   - Filter: doctorId optional (parity). Status filter NONE (parity — semua status).
//     Date hardcoded DATE(created_at) = CURRENT_DATE (parity, UTC DB).
// ============================================================
const adminQueuesRouter: Router = express.Router();

// ---------- Auth + env guard (level admin queues router, parity admin.routes.ts) ----------
// Semua route admin queues require ADMIN_BRANCH.
adminQueuesRouter.use((req: Request, res: Response, next: NextFunction) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return adminFail(res, 'ENV_MISSING: SUPABASE_* belum di-set.', 500, 'ENV_MISSING');
  }
  if (!process.env.JWT_SECRET) {
    return adminFail(res, 'ENV_MISSING: JWT_SECRET belum di-set.', 500, 'ENV_MISSING');
  }

  const authHeader = req.headers['authorization'];
  const token = extractBearerToken(typeof authHeader === 'string' ? authHeader : undefined);
  if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const user = verifyJwt(token);
    requireRole(user, ADMIN_ALLOWED_ROLES);
    (req as AuthedRequest).user = user;
    next();
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 403) return res.status(403).json({ success: false, error: e.message || 'Forbidden' });
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
});

// ---------- GET /api/admin/queues (list queue hari ini) ----------
// Parity Express getAdminQueues: INNER JOIN bookings + patients + doctors —
// walk-in (patient_id = NULL) EXCLUDED, TANPA COALESCE (beda queue-today, intentional).
// Row mapping EXACT parity Express (Booklet pre-audit): id, queueNumber,
// patientName, patientId, doctorId, doctorName, serviceType, checkInTime, status.
adminQueuesRouter.all('/', getOnly(async (req, res) => {
  const user = req.user;
  if (!user?.branchId) {
    return adminFail(res, 'Unauthorized', 401, 'UNAUTHORIZED');
  }

  const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 1), 100);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // doctorId filter optional (parity Express: optional query param).
  const doctorId = typeof req.query.doctorId === 'string' ? String(req.query.doctorId).trim() : '';

  try {
    const supabase = getSupabase();

    // Parity DATE(q.created_at) = CURRENT_DATE (DB UTC). Range dihitung di JS,
    // setara dengan batas hari UTC local, WIB-independent (sama seperti Express).
    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dayEnd = new Date(dayStart.getTime() + 86400000);

    let query = supabase
      .from('queues')
      .select(
        `id, queue_number, status, created_at, doctor_id,
         bookings:booking_id!inner(patient_id, patients:patient_id!inner(full_name)),
         doctors:doctor_id!inner(full_name, specialization)`,
        { count: 'exact' }
      )
      .eq('branch_id', user.branchId)
      .is('deleted_at', null)
      .gte('created_at', dayStart.toISOString())
      .lt('created_at', dayEnd.toISOString())
      .order('queue_number', { ascending: true })
      .range(from, to);

    if (doctorId) {
      query = query.eq('doctor_id', doctorId);
    }

    const { data, error: dbErr, count } = await query;
    if (dbErr) return adminFail(res, `Database error: ${dbErr.message}`, 500, 'DB_ERROR');

    const queues = (data || []).map((row: any) => ({
      id: row.id,
      queueNumber: row.queue_number,
      patientName: row.bookings?.patients?.full_name || '',
      patientId: row.bookings?.patient_id,
      doctorId: row.doctor_id,
      doctorName: row.doctors?.full_name || '',
      serviceType: row.doctors?.specialization || '',
      checkInTime: row.created_at,
      status: row.status,
    }));

    const nowServing =
      queues.find((p: any) => p.status === 'IN_SERVICE') ||
      queues.find((p: any) => p.status === 'BEING_CALLED') ||
      null;

    return res.status(200).json({
      success: true,
      data: queues,
      total: queues.length,
      nowServing,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return adminFail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- 404 fallback domain admin queues ----------
adminQueuesRouter.use((req: Request, res: Response) => {
  return adminFail(res, 'Route tidak ditemukan di domain admin queues.', 404, 'NOT_FOUND');
});

// ============================================================
// /api/settings — Batch 6.2 FASE B2 (serverless subset)
// - Approach B+C: vercel.json rewrite /api/settings/:path* ->
//   /api/bookings?path=settings/$1 (marker 'settings/...').
// - Express mount prefix '/api/settings' (ADMIN_BRANCH only).
// Parity Express: dentflow-backend + frontend dentflow-web (settings page).
// Scope (parity dentflow-web/src/lib/api/settings.ts):
//   GET  /api/settings                 get settings (branch scope)
//   PUT  /api/settings                 update settings (merge-on-write)
//   POST /api/settings/verify-webhook  webhook URL reachability check
// Response shape: GET/PUT = adminOk(res, settings) (data wrapper); verify = res.json
// { success, message } explicit TANPA data wrapper (R6/R8).
// Audit: SYSTEM_CONFIG_UPDATE, entity_type='SETTINGS'. new_values hanya clinic +
// hours + notifications — payment EXCLUDED (R11: jangan tulis midtrans key ke audit).
// ============================================================
const settingsRouter: Router = express.Router();

// ---------- Auth + env guard (level settings router) ----------
// Semua route settings require ADMIN_BRANCH (pola auditRouter).
settingsRouter.use((req: Request, res: Response, next: NextFunction) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return adminFail(res, 'ENV_MISSING: SUPABASE_* belum di-set.', 500, 'ENV_MISSING');
  }
  if (!process.env.JWT_SECRET) {
    return adminFail(res, 'ENV_MISSING: JWT_SECRET belum di-set.', 500, 'ENV_MISSING');
  }

  const authHeader = req.headers['authorization'];
  const token = extractBearerToken(typeof authHeader === 'string' ? authHeader : undefined);
  if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });

  try {
    const user = verifyJwt(token);
    requireRole(user, ADMIN_ALLOWED_ROLES);
    (req as AuthedRequest).user = user;
    next();
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 403) return res.status(403).json({ success: false, error: e.message || 'Forbidden' });
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
});

// ---------- Default settings (parity frontend Settings interface) ----------
const defaultSettings = () => ({
  clinic: { branchName: '', address: '', phone: '', email: '' },
  hours: {
    openTime: '08:00',
    closeTime: '17:00',
    breakStart: '12:00',
    breakEnd: '13:00',
    daysOpen: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  },
  payment: { midtransClientKey: '', midtransServerKey: '', midtransWebhookUrl: '' },
  notifications: { emailReminders: true, smsGateway: false },
});

// ---------- GET /api/settings (get settings) ----------
// Branch scope: enforceTenant (query branchId, default JWT user.branchId).
// Fallback: merge row dengan defaultSettings() untuk field null. Kalau row
// branch_settings tidak ada (tidak seharusnya — seed 046), auto-fallback
// default + branches (tidak 404).
settingsRouter.get('/', getOnly(async (req, res) => {
  const user = req.user;
  if (!user?.branchId) {
    return adminFail(res, 'Unauthorized', 401, 'UNAUTHORIZED');
  }

  try {
    const supabase = getSupabase();

    const rawBranch = req.query.branchId;
    const requestedBranchId = typeof rawBranch === 'string' && rawBranch.length > 0 ? rawBranch : undefined;
    let finalBranchId: string;
    try {
      finalBranchId = await enforceTenant(supabase, user, requestedBranchId);
    } catch (tenantErr: unknown) {
      const e = tenantErr as { statusCode?: number; message?: string };
      if (e.statusCode === 403) return adminFail(res, e.message || 'Forbidden', 403, 'FORBIDDEN');
      throw tenantErr;
    }

    const { data: row, error: dbErr } = await supabase
      .from('branch_settings')
      .select('clinic, hours, payment, notifications')
      .eq('branch_id', finalBranchId)
      .maybeSingle();
    if (dbErr) return adminFail(res, `Database error: ${dbErr.message}`, 500, 'DB_ERROR');

    const def = defaultSettings();
    const settings = {
      clinic: { ...def.clinic, ...((row?.clinic as Record<string, unknown>) || {}) },
      hours: { ...def.hours, ...((row?.hours as Record<string, unknown>) || {}) },
      payment: { ...def.payment, ...((row?.payment as Record<string, unknown>) || {}) },
      notifications: { ...def.notifications, ...((row?.notifications as Record<string, unknown>) || {}) },
    };

    // clinic.branchName/address/phone: prefer branch_settings.clinic JSONB,
    // fallback Select branches (name, address, phone) kalau kosong.
    if (!(settings.clinic.branchName && settings.clinic.address && settings.clinic.phone)) {
      const { data: branch, error: bErr } = await supabase
        .from('branches')
        .select('name, address, phone')
        .eq('id', finalBranchId)
        .maybeSingle();
      if (!bErr && branch) {
        settings.clinic.branchName = settings.clinic.branchName || branch.name || '';
        settings.clinic.address = settings.clinic.address || branch.address || '';
        settings.clinic.phone = settings.clinic.phone || branch.phone || '';
      }
    }

    return adminOk(res, settings);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return adminFail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- PUT /api/settings (update settings, merge-on-write) ----------
// Body: { clinic, hours, payment, notifications } semua optional (D4/D12).
// Flow: read existing → merge per-field (tidak clobber) → upsert
// ({onConflict:'branch_id'}) → audit SYSTEM_CONFIG_UPDATE → adminOk(res, saved).
settingsRouter.put('/', putOnly(async (req, res) => {
  const user = req.user;
  if (!user?.branchId) {
    return adminFail(res, 'Unauthorized', 401, 'UNAUTHORIZED');
  }

  const body = (req.body || {}) as {
    clinic?: Record<string, unknown>;
    hours?: Record<string, unknown>;
    payment?: Record<string, unknown>;
    notifications?: Record<string, unknown>;
  };
  const sections: (keyof typeof body)[] = ['clinic', 'hours', 'payment', 'notifications'];
  const invalid = sections.filter(
    (s) => body[s] !== undefined && (typeof body[s] !== 'object' || body[s] === null || Array.isArray(body[s]))
  );
  if (invalid.length > 0) {
    return adminFail(res, `Bagian settings tidak valid: ${invalid.join(', ')}`, 400, 'VALIDATION_ERROR');
  }

  try {
    const supabase = getSupabase();

    const rawBranch = req.query.branchId;
    const requestedBranchId = typeof rawBranch === 'string' && rawBranch.length > 0 ? rawBranch : undefined;
    let finalBranchId: string;
    try {
      finalBranchId = await enforceTenant(supabase, user, requestedBranchId);
    } catch (tenantErr: unknown) {
      const e = tenantErr as { statusCode?: number; message?: string };
      if (e.statusCode === 403) return adminFail(res, e.message || 'Forbidden', 403, 'FORBIDDEN');
      throw tenantErr;
    }

    const { data: row, error: dbErr } = await supabase
      .from('branch_settings')
      .select('clinic, hours, payment, notifications')
      .eq('branch_id', finalBranchId)
      .maybeSingle();
    if (dbErr) return adminFail(res, `Database error: ${dbErr.message}`, 500, 'DB_ERROR');

    // Merge-on-write: defaults fill gap, existing = source of truth, partial overrides.
    const def = defaultSettings();
    const merged = {
      clinic: { ...def.clinic, ...((row?.clinic as Record<string, unknown>) || {}), ...(body.clinic || {}) },
      hours: { ...def.hours, ...((row?.hours as Record<string, unknown>) || {}), ...(body.hours || {}) },
      payment: { ...def.payment, ...((row?.payment as Record<string, unknown>) || {}), ...(body.payment || {}) },
      notifications: {
        ...def.notifications,
        ...((row?.notifications as Record<string, unknown>) || {}),
        ...(body.notifications || {}),
      },
    };

    const { data: updated, error: upErr } = await supabase
      .from('branch_settings')
      .upsert(
        {
          branch_id: finalBranchId,
          clinic: merged.clinic,
          hours: merged.hours,
          payment: merged.payment,
          notifications: merged.notifications,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'branch_id' }
      )
      .select('clinic, hours, payment, notifications')
      .maybeSingle();
    if (upErr) return adminFail(res, `Database error: ${upErr.message}`, 500, 'DB_ERROR');
    if (!updated) return adminFail(res, 'Gagal menyimpan settings', 500, 'DB_ERROR');

    const saved = {
      clinic: { ...def.clinic, ...((updated.clinic as Record<string, unknown>) || {}) },
      hours: { ...def.hours, ...((updated.hours as Record<string, unknown>) || {}) },
      payment: { ...def.payment, ...((updated.payment as Record<string, unknown>) || {}) },
      notifications: { ...def.notifications, ...((updated.notifications as Record<string, unknown>) || {}) },
    };

    // Audit SYSTEM_CONFIG_UPDATE (best-effort). Payment EXCLUDED — jangan
    // pernah tulis midtrans key plaintext ke audit (R11).
    const { error: auditErr } = await supabase.from('audit_logs').insert({
      branch_id: finalBranchId,
      user_id: user.userId,
      event_type: 'SYSTEM_CONFIG_UPDATE',
      entity_type: 'SETTINGS',
      entity_id: finalBranchId,
      new_values: {
        clinic: saved.clinic,
        hours: saved.hours,
        notifications: saved.notifications,
      },
      description: `Settings updated for branch ${finalBranchId}`,
    });
    if (auditErr) console.error('SYSTEM_CONFIG_UPDATE audit failed:', auditErr.message);

    return adminOk(res, saved);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return adminFail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- POST /api/settings/verify-webhook (reachability check) ----------
// Body: { url? } optional, fallback payment.midtransWebhookUrl existing.
// Validasi: format URL valid, protocol https, bukan localhost.
// Reachability: HEAD (fallback GET) timeout 5s, non-destructive — success
// = reachable (bukan validasi HMAC). Response EXPLICIT { success, message }
// TANPA data wrapper (R6/R8).
settingsRouter.all('/verify-webhook', postOnly(async (req, res) => {
  const user = req.user;
  if (!user?.branchId) {
    return res.json({ success: false, message: 'Unauthorized' });
  }

  const body = (req.body || {}) as { url?: string };

  try {
    const supabase = getSupabase();

    const rawBranch = req.query.branchId;
    const requestedBranchId = typeof rawBranch === 'string' && rawBranch.length > 0 ? rawBranch : undefined;
    let finalBranchId: string;
    try {
      finalBranchId = await enforceTenant(supabase, user, requestedBranchId);
    } catch (tenantErr: unknown) {
      const e = tenantErr as { statusCode?: number; message?: string };
      if (e.statusCode === 403) return res.json({ success: false, message: e.message || 'Forbidden' });
      throw tenantErr;
    }

    let url = typeof body.url === 'string' && body.url.trim() ? body.url.trim() : '';
    if (!url) {
      const { data: row } = await supabase
        .from('branch_settings')
        .select('payment')
        .eq('branch_id', finalBranchId)
        .maybeSingle();
      url = typeof (row as any)?.payment?.midtransWebhookUrl === 'string'
        ? (row as any).payment.midtransWebhookUrl
        : '';
    }

    // Format validation: URL valid, protocol https, bukan localhost.
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return res.json({ success: false, message: 'Format URL tidak valid' });
    }
    if (parsed.protocol !== 'https:') {
      return res.json({ success: false, message: 'Format URL tidak valid' });
    }
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.localhost')) {
      return res.json({ success: false, message: 'Format URL tidak valid' });
    }

    // Reachability: HEAD lalu fallback GET, timeout 5s, non-destructive.
    const check = async (method: 'HEAD' | 'GET') => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const resp = await fetch(url, {
          method,
          redirect: 'follow',
          signal: controller.signal,
          headers: { 'user-agent': 'DentFlow-Serverless-WebhookVerify/1.0' },
        });
        return { status: resp.status };
      } finally {
        clearTimeout(timer);
      }
    };

    let headResult: { status: number } | null = null;
    try {
      headResult = await check('HEAD');
    } catch {
      headResult = null;
    }
    if (headResult && (headResult.status === 200 || headResult.status === 204)) {
      return res.json({ success: true, message: `Webhook URL reachable (HTTP ${headResult.status})` });
    }

    try {
      const getResult = await check('GET');
      return res.json({ success: true, message: `Webhook URL reachable (HTTP ${getResult.status})` });
    } catch (getErr: unknown) {
      const reason =
        (getErr as Error & { name?: string })?.name === 'AbortError'
          ? 'timeout (5s)'
          : getErr instanceof Error
            ? getErr.message
            : 'network error';
      return res.json({ success: false, message: `Webhook URL tidak reachable: ${reason}` });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return res.json({ success: false, message: `Webhook URL tidak reachable: ${message}` });
  }
}));

// ---------- 404 fallback domain settings ----------
settingsRouter.use((req: Request, res: Response) => {
  return adminFail(res, 'Route tidak ditemukan di domain settings.', 404, 'NOT_FOUND');
});

// ============================================================
// Vercel handler: mount router di prefix '/api/patient/bookings'
// + '/api/admin/bookings' (TD-2.4.9) + '/api/admin/audit-logs'
// (Step 2.3 FASE B) + '/api/admin/queues' (Step 2.5 FASE B)
// + '/api/settings' (Batch 6.2 FASE B2)
// ============================================================
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api/patient/bookings', router);
app.use('/api/admin/bookings', adminRouter);
app.use('/api/admin/audit-logs', auditRouter);
app.use('/api/admin/queues', adminQueuesRouter);
app.use('/api/settings', settingsRouter);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel kirim FULL URL ke lambda (terbukti di 2.3.2c), jadi Express mount
  // prefix match semua sub-path. Safeguard: kalau runtime strip URL jadi
  // destination saja (/api/bookings) dan suffix masuk ?path=, rekonstruksi.
  // Admin rewrite memakai marker 'admin/...' (parity invoices.ts admin/$1),
  // audit rewrite memakai marker 'audit/...' (Step 2.3 FASE B).
  const r = req as any;
  const captured = r.query && r.query.path ? r.query.path : undefined;
  if (captured) {
    const suffix = Array.isArray(captured) ? captured[0] : String(captured);
    const url = String(r.url || '');
    if (suffix && !url.includes(`/${suffix}`)) {
      if (suffix.startsWith('admin-queues/')) {
        r.url = `/api/admin/queues/${suffix.slice('admin-queues/'.length)}`;
      } else if (suffix.startsWith('audit/')) {
        r.url = `/api/admin/audit-logs/${suffix.slice('audit/'.length)}`;
      } else if (suffix.startsWith('settings/')) {
        r.url = `/api/settings/${suffix.slice('settings/'.length)}`;
      } else if (suffix.startsWith('admin/')) {
        r.url = `/api/admin/bookings/${suffix.slice('admin/'.length)}`;
      } else {
        r.url = `/api/patient/bookings/${suffix}`;
      }
    }
  }
  return app(r, res as any);
}