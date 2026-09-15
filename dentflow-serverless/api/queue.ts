import type { VercelRequest, VercelResponse } from '@vercel/node';
import express, { Request, Response } from 'express';
import { Router } from 'express';
import { getSupabase } from '../lib/supabase';
import { extractBearerToken, verifyJwt, AuthUser } from '../lib/auth';

// ============================================================
// Consolidated /api/queue — Task 2.4.8c (D4 queue check-in)
// Auth: DOCTOR only
// Route: POST /api/queue/:id/check-in
// ============================================================

const fail = (res: Response, message: string, status = 400, code = 'ERROR') =>
  res.status(status).json({ success: false, message, error: code, timestamp: new Date().toISOString() });

interface AuthedRequest extends Request {
  user: AuthUser;
}

const router: Router = express.Router();

// Auth middleware level router (semua route di sini butuh DOCTOR)
router.use((req: Request, res: Response, next) => {
  const auth = req.headers['authorization'];
  const token = extractBearerToken(typeof auth === 'string' ? auth : undefined);
  if (!token) return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');

  try {
    const user = verifyJwt(token);
    if (!user || user.role !== 'DOCTOR') {
      return fail(res, 'Forbidden: endpoint ini untuk dokter', 403, 'FORBIDDEN');
    }
    (req as AuthedRequest).user = user;
    next();
  } catch (e) {
    return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');
  }
});

// ---------- POST /:id/check-in (D4) ----------
router.post('/:id/check-in', async (req: Request, res: Response) => {
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