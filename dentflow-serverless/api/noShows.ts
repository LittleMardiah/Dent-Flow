import type { VercelRequest, VercelResponse } from '@vercel/node';
import express, { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { getSupabase } from '../lib/supabase';
import { extractBearerToken, verifyJwt, requireRole, AuthUser } from '../lib/auth';

const ALLOWED_ROLES = ['ADMIN_BRANCH'];

// ============================================================
// Consolidated /api/no-shows — Task 2.4.2 (S1, SECOND WRITE)
// - Approach B: vercel.json rewrites /api/no-shows/:path* -> /api/noShows?path=$1
// - Approach C: Express router di-mount prefix '/api/no-shows'
//   (Vercel kirim FULL URL ke lambda, terbukti di task 2.3.2c)
// Scope serverless saat ini: 1 endpoint WRITE:
//   PUT /api/no-shows/admin/bookings/:id/mark-no-show   (mark NO_SHOW manual)
// Parity Express: dentflow-backend/src/routes/noShow.routes.ts
//                 dentflow-backend/src/handlers/noShow.handler.ts (markNoShowManual)
// Placement: OPSI B (file baru), bukan extend bookings.ts. Express mount
// noShow.routes.ts di router terpisah '/api/no-shows' (index.ts:63) dengan
// role ADMIN_BRANCH-only — domain terpisah dari '/api/patient/bookings'
// (PATIENT+ADMIN_BRANCH). Lihat task_2_4_2.log STEP 3.
// ============================================================
// ============================================================
// Sub-Task A FASE B (2026-09-17): notifications.ts di-merge ke file ini
// (1 endpoint webhook replay, multi-mount '/api/admin/webhooks'). Tujuan:
// 12 -> 11 function, bebaskan slot untuk inventory.ts (Sub-Task C).
// Contract response webhook BEDA dari no-shows ({success,error,message,
// timestamp}) — per-router, jangan digabung (D4).
// Reconstruct handler pakai BRANCHING per-prefix (D3).
// ============================================================

// Response shape = parity Express noShow.handler:
//   success: { success: true, message, data? }
//   error  : { success: false, message }
const fail = (res: Response, message: string, status = 400) =>
  res.status(status).json({ success: false, message });

interface AuthedRequest extends Request {
  user: AuthUser;
}

const router: Router = express.Router();

// ---------- Auth + env guard (level router, parity noShow.routes.ts auth+role) ----------
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

// ---------- PUT /api/no-shows/admin/bookings/:id/mark-no-show ----------
// Parity Express noShow.handler markNoShowManual + audit BOOOKING_NO_SHOW_MARKED.
router.all('/admin/bookings/:id/mark-no-show', putOnly(async (req, res) => {
  const user = req.user;
  const bookingId = req.params.id as string;
  const adminId = user?.userId;

  if (!adminId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const supabase = getSupabase();

    // Branch scope wajib: booking harus di branch admin (cegah cross-branch mark).
    // Express SELECT * WHERE id=$1; branch scope ditambah sesuai rule 2.4.2.
    const { data: booking, error: e1 } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .eq('branch_id', user.branchId)
      .maybeSingle();
    if (e1) return fail(res, 'Internal server error', 500);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking tidak ditemukan' });

    if (booking.status === 'NO_SHOW') {
      return res.status(200).json({
        success: true,
        message: 'Booking sudah ditandai NO_SHOW',
        data: { booking_id: bookingId, status: 'NO_SHOW' },
      });
    }

    if (['CANCELLED', 'COMPLETED'].includes(booking.status)) {
      return res.status(409).json({
        success: false,
        message: `Booking sudah berstatus ${booking.status}, tidak bisa diubah ke NO_SHOW`,
      });
    }

    // Parity Express: UPDATE bookings SET status='NO_SHOW', no_show_at=NOW(), updated_at=NOW().
    const now = new Date().toISOString();
    const { error: e2 } = await supabase
      .from('bookings')
      .update({ status: 'NO_SHOW', no_show_at: now, updated_at: now })
      .eq('id', bookingId);
    if (e2) return fail(res, 'Internal server error', 500);

    // Parity Express auditService.logEvent(BOOKING_NO_SHOW_MARKED).
    const { error: e3 } = await supabase
      .from('audit_logs')
      .insert({
        branch_id: booking.branch_id,
        user_id: adminId,
        event_type: 'BOOKING_NO_SHOW_MARKED',
        entity_type: 'BOOKING',
        entity_id: bookingId,
        description: 'Pemesanan Tidak Datang (Manual oleh Admin)',
        new_values: { status: 'NO_SHOW', no_show_at: now, admin_id: adminId },
      });
    if (e3) return fail(res, 'Internal server error', 500);

    return res.status(200).json({
      success: true,
      message: 'Booking berhasil ditandai NO_SHOW',
      data: { booking_id: bookingId, status: 'NO_SHOW' },
    });
  } catch (err: unknown) {
    return fail(res, 'Internal server error', 500);
  }
}));

// ---------- 404 fallback domain no-shows ----------
router.use((req: Request, res: Response) => {
  return fail(res, 'Route tidak ditemukan di domain no-shows.', 404);
});

// ============================================================
// Webhook replay domain (merged dari notifications.ts — Sub-Task A FASE B)
// - notifications.ts di-delete setelah merge. vercel.json destination
//   /api/admin/webhooks/:path* -> /api/noShows (bukan /api/notifications).
// - Multi-mount router terpisah, parity bookings.ts:825-828.
// - Auth + response contract BEDA dari domain no-shows
//   ({ success, error, message, timestamp }) — per-router, jangan digabung.
// Parity Express: dentflow-backend/src/routes/adminWebhook.routes.ts
// ============================================================

// Error shape (parity notification.handler): { success: false, error, message }.
// Dinamai replayFail (bukan fail) supaya tidak bentrok dengan fail() domain
// no-shows yang shape-nya { success: false, message }.
const replayFail = (res: Response, message: string, status = 400, code = 'ERROR') =>
  res.status(status).json({ success: false, error: code, message });

const webhookReplayRouter: Router = express.Router();

// ---------- Auth + env guard (level router, parity adminWebhook.routes.ts) ----------
// Semua route require ADMIN_BRANCH.
webhookReplayRouter.use((req: Request, res: Response, next: NextFunction) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return replayFail(res, 'ENV_MISSING: SUPABASE_* belum di-set.', 500, 'ENV_MISSING');
  }
  if (!process.env.JWT_SECRET) {
    return replayFail(res, 'ENV_MISSING: JWT_SECRET belum di-set.', 500, 'ENV_MISSING');
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
  return replayFail(res, 'Route tidak ditemukan di domain admin webhooks.', 404, 'NOT_FOUND');
});

// ============================================================
// Vercel handler: mount router di prefix '/api/no-shows'
// + '/api/admin/webhooks' (Sub-Task A FASE B, parity bookings.ts:825)
// ============================================================
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api/no-shows', router);
app.use('/api/admin/webhooks', webhookReplayRouter);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel kirim FULL URL ke lambda (terbukti di 2.3.2c), jadi Express mount
  // prefix match semua sub-path. Safeguard: kalau runtime strip URL jadi
  // destination saja (/api/noShows) dan suffix masuk ?path=, rekonstruksi
  // pakai BRANCHING per-prefix (D3):
  //   path=webhooks/<rest> -> /api/admin/webhooks/<rest>   (rewrite /api/admin/webhooks)
  //   path=<suffix>        -> /api/no-shows/<suffix>       (rewrite /api/no-shows)
  const r = req as any;
  const captured = r.query && r.query.path ? r.query.path : undefined;
  if (captured) {
    const suffix = Array.isArray(captured) ? captured[0] : String(captured);
    const url = String(r.url || '');
    if (suffix && !url.includes(`/${suffix}`)) {
      if (suffix.startsWith('webhooks/')) {
        r.url = `/api/admin/webhooks/${suffix.slice('webhooks/'.length)}`;
      } else {
        r.url = `/api/no-shows/${suffix}`;
      }
    }
  }
  return app(r, res as any);
}