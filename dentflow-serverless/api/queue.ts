import type { VercelRequest, VercelResponse } from '@vercel/node';
import express, { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { getSupabase } from '../lib/supabase';
import { extractBearerToken, verifyJwt, enforceTenant, AuthUser } from '../lib/auth';

// ============================================================
// Consolidated /api/queue — Task 2.4.8c (D4 queue check-in)
//                      + Task 2.6 FASE B2 (GET /status TV display)
//                      + Task queue-actions FASE B (call-next/complete)
// Auth: per-route via requireAuth(minRoles)
// Routes:
//   GET  /api/queue/status        → PATIENT, DOCTOR, ADMIN_BRANCH
//   POST /api/queue/:id/check-in  → DOCTOR only
//   POST /api/queue/:id/call-next → ADMIN_BRANCH only (admin queue board)
//   POST /api/queue/:id/complete  → ADMIN_BRANCH only (admin queue board)
// ============================================================

const fail = (res: Response, message: string, status = 400, code = 'ERROR') =>
  res.status(status).json({ success: false, message, error: code, timestamp: new Date().toISOString() });

// Row map camelCase (D4) — reuse pola queue.ts existing (queueNumber/checkInTime).
const mapQueueRow = (row: any) => ({
  id: row.id,
  queueNumber: Number(row.queue_number),
  status: row.status,
  calledAt: row.called_at || null,
  completedAt: row.completed_at || null,
  checkInTime: row.created_at || null,
  bookingId: row.booking_id,
  branchId: row.branch_id,
  doctorId: row.doctor_id,
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// D5: SELECT queue dulu (soft-delete filter + tenant scope). Null/branch mismatch → 404.
const fetchQueueOwned = async (supabase: ReturnType<typeof getSupabase>, queueId: string, branchId: string) => {
  const { data, error } = await supabase
    .from('queues')
    .select('id, branch_id, doctor_id, status, queue_number')
    .eq('id', queueId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) return { error };
  if (!data || data.branch_id !== branchId) {
    const notFound = new Error('QUEUE_NOT_FOUND');
    (notFound as any).silent = true;
    return { error: notFound as any };
  }
  return { data };
};

interface AuthedRequest extends Request {
  user: AuthUser;
}

const router: Router = express.Router();

// Auth helper per-route: extract bearer, verify JWT, set req.user, cek role.
const requireAuth = (minRoles: string[]) => (req: Request, res: Response, next: NextFunction) => {
  const auth = req.headers['authorization'];
  const token = extractBearerToken(typeof auth === 'string' ? auth : undefined);
  if (!token) return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');

  try {
    const user = verifyJwt(token);
    if (!user || !minRoles.includes(user.role)) {
      return fail(res, 'Forbidden: role tidak diizinkan untuk endpoint ini', 403, 'FORBIDDEN');
    }
    (req as AuthedRequest).user = user;
    next();
  } catch {
    return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');
  }
};

// ---------- GET /status (B2) — TV display, parity getTvDisplay ----------
router.get('/status', requireAuth(['PATIENT', 'DOCTOR', 'ADMIN_BRANCH']), async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user;
  const branchIdQuery = req.query.branch_id;
  const doctorIdQuery = req.query.doctor_id;

  const branch_id = typeof branchIdQuery === 'string' ? branchIdQuery : undefined;
  if (!branch_id) {
    return res.status(400).json({ success: false, message: 'branch_id wajib diisi' });
  }
  const doctor_id = typeof doctorIdQuery === 'string' ? doctorIdQuery : undefined;

  try {
    const supabase = getSupabase();

    // Tenant scope: enforceTenant (fix Express F5 bug camelCase branchId query)
    let finalBranchId: string;
    try {
      finalBranchId = await enforceTenant(supabase, user, branch_id);
    } catch (tenantErr: unknown) {
      const e = tenantErr as { statusCode?: number; message?: string };
      if (e.statusCode === 403) return fail(res, e.message || 'Forbidden', 403);
      throw tenantErr;
    }

    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_branch_queue_status', {
      p_branch_id: finalBranchId,
      p_doctor_id: doctor_id || null,
    });

    if (rpcErr) {
      return fail(res, `RPC error: ${String(rpcErr.message || '')}`, 500, 'RPC_ERROR');
    }

    // Derive JS (parity getTvDisplay)
    const rows: any[] = Array.isArray(rpcData) ? (rpcData as any[]) : [];
    const mapped = rows.map((row) => ({
      id: row.id,
      queueNumber: Number(row.queue_number),
      status: row.status,
      checkInTime: row.check_in_time,
      patientId: row.patient_id,
      patientName: row.patient_name,
      isWalkIn: !!row.is_walk_in,
      waitMinutes: row.wait_minutes ?? 0,
    }));

    const nowServing =
      mapped.find((r) => r.status === 'IN_SERVICE') ||
      mapped.find((r) => r.status === 'BEING_CALLED') ||
      null;
    const nextPatients = mapped.filter((r) => r.status === 'WAITING').slice(0, 3);
    const waitingQueue = mapped.filter((r) => r.status === 'WAITING');
    const totalWaiting = waitingQueue.length;
    const currentNumber = nowServing?.queueNumber ?? 0;
    const updatedAt = new Date().toISOString();

    // Response explicit (parity Express queue.handler.ts getQueueStatus) — NO timestamp.
    return res.status(200).json({
      success: true,
      data: {
        branchId: finalBranchId,
        doctorId: doctor_id || null,
        nowServing,
        nextPatients,
        totalWaiting,
        waitingQueue,
        waiting_queue: waitingQueue,
        currentNumber,
        updatedAt,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
});

// ---------- POST /:id/check-in (D4) ----------
router.post('/:id/check-in', requireAuth(['DOCTOR']), async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user;
  const queueId = req.params.id as string;
  if (!queueId) return fail(res, 'Parameter queue id wajib diisi', 400, 'VALIDATION_ERROR');

  try {
    const supabase = getSupabase();
    const { data: rpcData, error: rpcErr } = await supabase.rpc('doctor_checkin_patient', {
      p_queue_id: queueId,
      p_user_id: user.userId,
    });

    if (rpcErr) {
      const msg = String(rpcErr.message || '');
      if (msg.includes('QUEUE_NOT_FOUND')) return fail(res, 'Antrian tidak ditemukan', 404, 'QUEUE_NOT_FOUND');
      if (msg.includes('QUEUE_NOT_WAITING')) return fail(res, 'Antrian tidak dalam status menunggu', 409, 'QUEUE_NOT_WAITING');
      if (msg.includes('BOOKING_WALKIN_NOT_CONVERTED')) return fail(res, 'Booking walk-in belum dikonversi menjadi pasien. Jalankan convert-to-patient dulu.', 409, 'BOOKING_WALKIN_NOT_CONVERTED');
      if (msg.includes('DOCTOR_NOT_FOUND')) return fail(res, 'Dokter tidak ditemukan', 404, 'DOCTOR_NOT_FOUND');
      return fail(res, `RPC error: ${msg}`, 500, 'RPC_ERROR');
    }

    const payload = typeof rpcData === 'string' ? JSON.parse(rpcData) : rpcData;
    if (!payload || !payload.queue || !payload.encounter) {
      return fail(res, 'RPC returned invalid payload', 500, 'RPC_ERROR');
    }

    // Response NESTED (parity Express: data.queue, data.encounter)
    return res.status(200).json({
      success: true,
      data: {
        queue: payload.queue,
        encounter: payload.encounter,
      },
      message: 'Pasien berhasil di-check-in, encounter dibuat.',
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
});

// ---------- POST /:id/call-next (queue-actions FASE B, ADMIN_BRANCH only) ----------
router.post('/:id/call-next', requireAuth(['ADMIN_BRANCH']), async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user;
  const queueId = req.params.id as string;
  if (!queueId || !UUID_RE.test(queueId)) {
    return fail(res, 'Parameter queue id wajib uuid valid', 400, 'VALIDATION_ERROR');
  }

  try {
    const supabase = getSupabase();

    const owned = await fetchQueueOwned(supabase, queueId, user.branchId);
    if (owned.error) {
      if (owned.error.message === 'QUEUE_NOT_FOUND') return fail(res, 'Antrian tidak ditemukan', 404, 'QUEUE_NOT_FOUND');
      return fail(res, `Database error: ${owned.error.message}`, 500, 'DB_ERROR');
    }

    // D2: guard status di WHERE (atomic). status != WAITING → 409 (bukan 404).
    const { data: row, error: upErr } = await supabase
      .from('queues')
      .update({ status: 'BEING_CALLED', called_at: new Date().toISOString() })
      .eq('id', queueId)
      .eq('status', 'WAITING')
      .is('deleted_at', null)
      .select()
      .maybeSingle();
    if (upErr) return fail(res, `Database error: ${upErr.message}`, 500, 'DB_ERROR');
    if (!row) {
      return fail(res, 'Antrian tidak dalam status menunggu', 409, 'QUEUE_NOT_WAITING');
    }

    // D6: audit QUEUE_CALLED (pola migration 039 / checkIn.ts) — non-blocking.
    await supabase.from('audit_logs').insert({
      branch_id: row.branch_id,
      user_id: user.userId,
      event_type: 'QUEUE_CALLED',
      entity_type: 'QUEUE',
      entity_id: row.id,
      new_values: { status: 'BEING_CALLED', queue_number: row.queue_number },
      description: `Queue ${row.queue_number} dipanggil`,
    });

    return res.status(200).json({
      success: true,
      data: mapQueueRow(row),
      message: `Pasien nomor ${row.queue_number} dipanggil`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
});

// ---------- POST /:id/complete (queue-actions FASE B, ADMIN_BRANCH only) ----------
router.post('/:id/complete', requireAuth(['ADMIN_BRANCH']), async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user;
  const queueId = req.params.id as string;
  if (!queueId || !UUID_RE.test(queueId)) {
    return fail(res, 'Parameter queue id wajib uuid valid', 400, 'VALIDATION_ERROR');
  }

  try {
    const supabase = getSupabase();

    const owned = await fetchQueueOwned(supabase, queueId, user.branchId);
    if (owned.error) {
      if (owned.error.message === 'QUEUE_NOT_FOUND') return fail(res, 'Antrian tidak ditemukan', 404, 'QUEUE_NOT_FOUND');
      return fail(res, `Database error: ${owned.error.message}`, 500, 'DB_ERROR');
    }

    // D2: flexible guard — WAITING/BEING_CALLED/IN_SERVICE (admin edge case).
    const { data: row, error: upErr } = await supabase
      .from('queues')
      .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
      .eq('id', queueId)
      .in('status', ['WAITING', 'BEING_CALLED', 'IN_SERVICE'])
      .is('deleted_at', null)
      .select()
      .maybeSingle();
    if (upErr) return fail(res, `Database error: ${upErr.message}`, 500, 'DB_ERROR');
    if (!row) {
      return fail(res, 'Antrian tidak dapat diselesaikan (status bukan WAITING/BEING_CALLED/IN_SERVICE)', 409, 'QUEUE_NOT_COMPLETABLE');
    }

    // D6: audit QUEUE_COMPLETED (parity migration 039) — non-blocking.
    await supabase.from('audit_logs').insert({
      branch_id: row.branch_id,
      user_id: user.userId,
      event_type: 'QUEUE_COMPLETED',
      entity_type: 'QUEUE',
      entity_id: row.id,
      new_values: { status: 'COMPLETED', queue_number: row.queue_number },
      description: `Queue ${row.queue_number} completed`,
    });

    return res.status(200).json({
      success: true,
      data: mapQueueRow(row),
      message: `Pasien nomor ${row.queue_number} selesai dilayani`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
});

// 404 fallback
router.use((req: Request, res: Response) => {
  return fail(res, 'Route tidak ditemukan di domain queue.', 404, 'NOT_FOUND');
});

// Vercel handler
// NOTE (D8 cabang baru): vercel.json rewrites /api/queues/:path* dan /queues/:path*
// (D3) mem-preserve URL asli (uji empiris: function menerima /api/queues/.. original),
// reconstruct branch tak sempat fire (suffix SUDAH ada di url). Maka mount prefix
// /api/queues + /queues langsung di router (pola sama bookings.ts multi-mount).
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api/queue', router);
app.use('/queue', router);
app.use('/api/queues', router);
app.use('/queues', router);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const r = req as any;
  const captured = r.query && r.query.path ? r.query.path : undefined;
  if (captured) {
    const suffix = Array.isArray(captured) ? captured[0] : String(captured);
    const url = String(r.url || '');
    if (suffix && !url.includes(`/${suffix}`)) {
      r.url = `/api/queue/${suffix}`;
    }
  }
  return app(r, res as any);
}