import type { VercelRequest, VercelResponse } from '@vercel/node';
import express, { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { getSupabase } from '../lib/supabase';
import { extractBearerToken, verifyJwt, requireRole, enforceTenant, AuthUser } from '../lib/auth';

const ALLOWED_ROLES = ['ADMIN_BRANCH'];

const ok = (res: Response, data: unknown, message = 'OK', status = 200) =>
  res.status(status).json({ success: true, data, message, timestamp: new Date().toISOString() });
const fail = (res: Response, message: string, status = 400) =>
  res.status(status).json({ success: false, message, timestamp: new Date().toISOString() });

interface AuthedRequest extends Request {
  user: AuthUser;
}

const router: Router = express.Router();

// ---------- Auth + env guard (level router, parity admin.routes.ts) ----------
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

function todayWIB(): string {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().split('T')[0];
}

// ---------- POST / (C1) — relative to mount '/api/admin/check-in' ----------
router.post('/', async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user;
  const body = (req.body || {}) as { check_in_code?: string; branch_id?: string };

  const code = (body.check_in_code || '').trim();
  if (!code) return fail(res, 'Kode booking wajib diisi', 400);

  try {
    const supabase = getSupabase();

    let branchId = user.branchId;
    try {
      branchId = await enforceTenant(supabase, user, body.branch_id);
    } catch (tenantErr: unknown) {
      const e = tenantErr as { statusCode?: number; message?: string };
      if (e.statusCode === 403) return fail(res, e.message || 'Forbidden', 403);
      throw tenantErr;
    }

    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .select('id, branch_id, doctor_id, patient_id, status, checked_in_at, queue_number')
      .ilike('check_in_code', code)
      .eq('branch_id', branchId)
      .maybeSingle();

    if (bErr) return fail(res, 'Internal server error', 500);
    if (!booking) return fail(res, 'Kode booking tidak ditemukan', 404);

    if (booking.status !== 'PAYMENT_CONFIRMED' && booking.status !== 'CHECKED_IN') {
      return fail(res, `Booking sudah berstatus ${booking.status}`, 400);
    }

    if (booking.checked_in_at) {
      return ok(res, {
        queue_number: booking.queue_number,
        already_checked_in: true,
      }, `Anda sudah check-in sebelumnya. Nomor antrian: ${booking.queue_number}`);
    }

    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_next_queue_number', {
      p_branch_id: branchId,
      p_doctor_id: booking.doctor_id,
      p_date: todayWIB(),
    });
    if (rpcErr) return fail(res, 'Internal server error', 500);
    const queueNumber = typeof rpcData === 'number' ? rpcData : Number(rpcData);

    const { error: qErr } = await supabase.from('queues').insert({
      booking_id: booking.id,
      branch_id: branchId,
      doctor_id: booking.doctor_id,
      queue_number: queueNumber,
      status: 'WAITING',
    });
    if (qErr) return fail(res, 'Internal server error', 500);

    const { error: uErr } = await supabase
      .from('bookings')
      .update({
        status: 'CHECKED_IN',
        checked_in_at: new Date().toISOString(),
        queue_number: queueNumber,
      })
      .eq('id', booking.id);
    if (uErr) return fail(res, 'Internal server error', 500);

    await supabase.from('audit_logs').insert({
      branch_id: branchId,
      user_id: user.userId,
      event_type: 'BOOKING_CHECKED_IN',
      entity_type: 'BOOKING',
      entity_id: booking.id,
      new_values: { queue_number: queueNumber, check_in_code: code },
      description: `Admin check-in pasien dengan kode ${code}, queue number ${queueNumber}`,
    });

    return ok(res, {
      queue_number: queueNumber,
      booking_id: booking.id,
      patient_id: booking.patient_id,
      doctor_id: booking.doctor_id,
    }, `Check-in berhasil. Nomor antrian: ${queueNumber}`);
  } catch (err: unknown) {
    return fail(res, 'Internal server error', 500);
  }
});

// ---------- POST /walk-in (C2) — relative to mount '/api/admin/check-in' ----------
router.post('/walk-in', async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user;
  const body = (req.body || {}) as {
    pasien_name?: string;
    pasien_phone?: string;
    doctor_id?: string;
    branch_id?: string;
    notes?: string;
    sessionSlotId?: string;
  };

  if (!body.pasien_name || !body.doctor_id || !body.branch_id) {
    return fail(res, 'pasien_name, doctor_id, branch_id wajib diisi', 400);
  }

  try {
    const supabase = getSupabase();

    let branchId = user.branchId;
    try {
      branchId = await enforceTenant(supabase, user, body.branch_id);
    } catch (tenantErr: unknown) {
      const e = tenantErr as { statusCode?: number; message?: string };
      if (e.statusCode === 403) return fail(res, e.message || 'Forbidden', 403);
      throw tenantErr;
    }

    const { data: doctor, error: dErr } = await supabase
      .from('doctors')
      .select('id, branch_id, full_name')
      .eq('id', body.doctor_id)
      .eq('branch_id', branchId)
      .maybeSingle();
    if (dErr) return fail(res, 'Internal server error', 500);
    if (!doctor) return fail(res, 'Dokter tidak ditemukan', 404);

    let tempPatientId: string | null = null;
    if (body.pasien_phone && body.pasien_phone.trim()) {
      const { data: existing } = await supabase
        .from('temporary_patients')
        .select('id')
        .eq('phone', body.pasien_phone)
        .eq('branch_id', branchId)
        .maybeSingle();
      if (existing) {
        tempPatientId = existing.id;
      }
    }
    if (!tempPatientId) {
      const { data: inserted, error: insErr } = await supabase
        .from('temporary_patients')
        .insert({
          branch_id: branchId,
          full_name: body.pasien_name,
          phone: body.pasien_phone || null,
        })
        .select('id')
        .maybeSingle();
      if (insErr) return fail(res, 'Internal server error', 500);
      tempPatientId = inserted?.id || null;
    }
    if (!tempPatientId) return fail(res, 'Gagal membuat temporary patient', 500);

    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_next_queue_number', {
      p_branch_id: branchId,
      p_doctor_id: body.doctor_id,
      p_date: todayWIB(),
    });
    if (rpcErr) return fail(res, 'Internal server error', 500);
    const queueNumber = typeof rpcData === 'number' ? rpcData : Number(rpcData);

    const bookingCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data: booking, error: bErr } = await supabase
      .from('bookings')
      .insert({
        branch_id: branchId,
        patient_id: null,
        temp_patient_id: tempPatientId,
        doctor_id: body.doctor_id,
        booking_date: todayWIB(),
        status: 'CHECKED_IN',
        booking_code: bookingCode,
        is_walk_in: true,
        queue_number: queueNumber,
        checked_in_at: new Date().toISOString(),
        dp_amount: 0,
      })
      .select('id, patient_id')
      .maybeSingle();
    if (bErr) return fail(res, 'Internal server error', 500);
    if (!booking) return fail(res, 'Gagal membuat booking', 500);

    const { error: qErr } = await supabase.from('queues').insert({
      booking_id: booking.id,
      branch_id: branchId,
      doctor_id: body.doctor_id,
      queue_number: queueNumber,
      status: 'WAITING',
    });
    if (qErr) return fail(res, 'Internal server error', 500);

    return res.status(201).json({
      success: true,
      data: {
        queue_number: queueNumber,
        temp_patient_id: tempPatientId,
        booking_id: booking.id,
        patient_id: null,
      },
      message: 'Walk-in berhasil ditambahkan',
    });
  } catch (err: unknown) {
    return fail(res, 'Internal server error', 500);
  }
});

// ---------- 404 fallback ----------
router.use((req: Request, res: Response) => {
  return fail(res, 'Route tidak ditemukan di domain checkIn.', 404);
});

// ============================================================
// Vercel handler: mount router di prefix '/api/admin/check-in'
// ============================================================
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api/admin/check-in', router);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const r = req as any;
  const captured = r.query && r.query.path ? r.query.path : undefined;
  if (captured) {
    const suffix = Array.isArray(captured) ? captured[0] : String(captured);
    const url = String(r.url || '');
    if (suffix && !url.includes(`/${suffix}`)) {
      r.url = `/api/admin/check-in/${suffix}`;
    }
  }
  return app(r, res as any);
}
