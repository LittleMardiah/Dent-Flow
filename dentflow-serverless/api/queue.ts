import type { VercelRequest, VercelResponse } from '@vercel/node';
import express, { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import { getSupabase } from '../lib/supabase';
import { extractBearerToken, verifyJwt, enforceTenant, AuthUser } from '../lib/auth';

// ============================================================
// Consolidated /api/queue — Task 2.4.8c (D4 queue check-in)
//                      + Task 2.6 FASE B2 (GET /status TV display)
// Auth: per-route via requireAuth(minRoles)
// Routes:
//   POST /api/queue/:id/check-in  → DOCTOR only
//   GET  /api/queue/status        → PATIENT, DOCTOR, ADMIN_BRANCH
// ============================================================

const fail = (res: Response, message: string, status = 400, code = 'ERROR') =>
  res.status(status).json({ success: false, message, error: code, timestamp: new Date().toISOString() });

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

// 404 fallback
router.use((req: Request, res: Response) => {
  return fail(res, 'Route tidak ditemukan di domain queue.', 404, 'NOT_FOUND');
});

// Vercel handler
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api/queue', router);
app.use('/queue', router);

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