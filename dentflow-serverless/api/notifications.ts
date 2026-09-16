import type { VercelRequest, VercelResponse } from '@vercel/node';
import express, { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { getSupabase } from '../lib/supabase';
import { extractBearerToken, verifyJwt, requireRole, AuthUser } from '../lib/auth';

const ALLOWED_ROLES = ['ADMIN_BRANCH'];

// ============================================================
// Consolidated /api/admin/webhooks — Task 2.4.1 (N1 N2, FIRST WRITE) + TD-2.4.9
// - Approach B: vercel.json rewrites /api/admin/webhooks/:path* -> /api/notifications?path=webhooks/$1
// - Approach C: Express router di-mount prefix '/api/admin/webhooks'
//   (Vercel kirim FULL URL ke lambda, terbukti di task 2.3.2c)
// Scope serverless saat ini: 1 endpoint WRITE (admin only):
//   POST /api/admin/webhooks/:id/replay   (S3 admin webhook replay)
// TD-2.4.9: N1 (send-reminder) + N2 (send-confirmation) DIPINDAH ke bookings.ts
// (admin bookings domain terkonsolidasi, vercel.json /api/admin/bookings/:path*
//  sekarang rewrite ke /api/bookings). JANGAN break N1/N2 — handler sudah pindah.
// Parity Express: dentflow-backend/src/routes/adminWebhook.routes.ts
// ============================================================

// Error shape (parity notification.handler): { success: false, error, message }.
const fail = (res: Response, message: string, status = 400, code = 'ERROR') =>
  res.status(status).json({ success: false, error: code, message });

interface AuthedRequest extends Request {
  user: AuthUser;
}

const webhookReplayRouter: Router = express.Router();

// ---------- Auth + env guard (level router, parity adminWebhook.routes.ts) ----------
// Semua route require ADMIN_BRANCH.
webhookReplayRouter.use((req: Request, res: Response, next: NextFunction) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fail(res, 'ENV_MISSING: SUPABASE_* belum di-set.', 500, 'ENV_MISSING');
  }
  if (!process.env.JWT_SECRET) {
    return fail(res, 'ENV_MISSING: JWT_SECRET belum di-set.', 500, 'ENV_MISSING');
  }
  const authHeader = req.headers['authorization'];
  const token = extractBearerToken(typeof authHeader === 'string' ? authHeader : undefined);
  if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' });
  try {
    const user = verifyJwt(token);
    requireRole(user, ALLOWED_ROLES);
    (req as AuthedRequest).user = user;
    next();
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 403) return res.status(403).json({ success: false, error: e.message || 'Forbidden' });
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
});

// ---------- POST /api/admin/webhooks/:id/replay (S3 admin replay) ----------
webhookReplayRouter.post('/:id/replay', async (req: Request, res: Response) => {
  const webhookId = req.params.id;
  if (!webhookId) return res.status(400).json({ success: false, message: 'webhook id required', error: 'VALIDATION_ERROR', timestamp: new Date().toISOString() });

  try {
    const supabase = getSupabase();
    const { data: wh, error } = await supabase.from('payment_webhooks').select('webhook_id, status').eq('webhook_id', webhookId).maybeSingle();
    if (error) return res.status(500).json({ success: false, message: `DB error: ${error.message}`, error: 'DB_ERROR', timestamp: new Date().toISOString() });
    if (!wh) return res.status(404).json({ success: false, message: 'Webhook not found', error: 'WEBHOOK_NOT_FOUND', timestamp: new Date().toISOString() });
    if (wh.status === 'PROCESSED') return res.status(409).json({ success: false, message: 'Webhook already processed', error: 'ALREADY_PROCESSED', timestamp: new Date().toISOString() });

    await supabase.from('payment_webhooks').update({ status: 'PROCESSED', processed_at: new Date().toISOString() }).eq('webhook_id', webhookId);
    await supabase.from('payment_webhook_errors').delete().eq('webhook_id', webhookId);
    return res.status(200).json({ success: true, message: 'Webhook replayed', timestamp: new Date().toISOString() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return res.status(500).json({ success: false, message, error: 'INTERNAL_ERROR', timestamp: new Date().toISOString() });
  }
});

// ---------- 404 fallback domain admin webhooks ----------
webhookReplayRouter.use((req: Request, res: Response) => {
  return fail(res, 'Route tidak ditemukan di domain admin webhooks.', 404, 'NOT_FOUND');
});

// ============================================================
// Vercel handler: mount router di prefix '/api/admin/webhooks'
// ============================================================
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api/admin/webhooks', webhookReplayRouter);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel kirim FULL URL ke lambda (terbukti di 2.3.2c), jadi Express mount
  // prefix '/api/admin/webhooks' match semua sub-path. Safeguard: kalau runtime
  // strip URL jadi destination saja (/api/notifications) dan suffix masuk ?path=,
  // rekonstruksi.
  const r = req as any;
  const captured = r.query && r.query.path ? r.query.path : undefined;
  if (captured) {
    const suffix = Array.isArray(captured) ? captured[0] : String(captured);
    const url = String(r.url || '');
    if (suffix && !url.includes(`/${suffix}`)) {
      if (suffix.startsWith('webhooks/')) {
        r.url = `/api/admin/webhooks/${suffix.slice('webhooks/'.length)}`;
      } else {
        r.url = `/api/admin/webhooks/${suffix}`;
      }
    }
  }
  return app(r, res as any);
}