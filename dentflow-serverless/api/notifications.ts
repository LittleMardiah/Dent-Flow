import type { VercelRequest, VercelResponse } from '@vercel/node';
import express, { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { getSupabase } from '../lib/supabase';
import { extractBearerToken, verifyJwt, requireRole, AuthUser } from '../lib/auth';

const ALLOWED_ROLES = ['ADMIN_BRANCH'];

// ============================================================
// Consolidated /api/admin/bookings — Task 2.4.1 (N1 N2, FIRST WRITE)
// - Approach B: vercel.json rewrites /api/admin/bookings/:path* -> /api/notifications?path=$1
// - Approach C: Express router di-mount prefix '/api/admin/bookings'
//   (Vercel kirim FULL URL ke lambda, terbukti di task 2.3.2c)
// Scope serverless saat ini: 2 endpoint WRITE (admin only):
//   POST /api/admin/bookings/:id/send-reminder
//   POST /api/admin/bookings/:id/send-confirmation
// Parity Express: dentflow-backend/src/routes/notification.routes.ts
//                 dentflow-backend/src/handlers/notification.handler.ts
//                 dentflow-backend/src/services/notification.service.ts
// ============================================================

// Response shape = parity Express notification.handler:
//   success: { success: true, message }
//   error  : { success: false, error, message }
const fail = (res: Response, message: string, status = 400, code = 'ERROR') =>
  res.status(status).json({ success: false, error: code, message });
const serverError = (res: Response) =>
  res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR', message: 'Server error' });

interface AuthedRequest extends Request {
  user: AuthUser;
}

const router: Router = express.Router();
const webhookReplayRouter: Router = express.Router();

// ---------- Auth + env guard (level router, parity notification.routes.ts) ----------
// Semua route require ADMIN_BRANCH.
router.use((req: Request, res: Response, next: NextFunction) => {
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

// POST-only guard (parity: metode selain POST => 405 METHOD_NOT_ALLOWED).
const postOnly =
  (handler: (req: AuthedRequest, res: Response) => unknown) =>
  (req: Request, res: Response) => {
    if (req.method !== 'POST') {
      return fail(res, 'Method not allowed', 405, 'METHOD_NOT_ALLOWED');
    }
    return handler(req as AuthedRequest, res);
  };

// ---------- Factory: send notification (N1 reminder / N2 confirmation) ----------
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
      if (eb) return serverError(res);
      if (!booking) {
        return res.status(404).json({
          success: false,
          error: 'BOOKING_NOT_FOUND',
          message: 'Booking not found',
        });
      }

      // Parity NotificationService content template.
      const content =
        type === 'CONFIRMATION'
          ? `Booking Anda telah dikonfirmasi. Kode booking: ${bookingId}. Terima kasih!`
          : `Pengingat: Anda memiliki janji temu hari ini. Kode booking: ${bookingId}`;

      const { error: e1 } = await supabase.from('notifications').insert({
        booking_id: bookingId,
        patient_id: booking.patient_id,
        type,
        status: 'SENT',
        sent_at: new Date().toISOString(),
        content,
      });
      if (e1) return serverError(res);

      return res.status(200).json({
        success: true,
        message: `${action} sent for booking ${bookingId}`,
      });
    } catch (err: unknown) {
      return serverError(res);
    }
  };

// ---------- POST /api/admin/bookings/:id/send-reminder ----------
router.all('/:id/send-reminder', postOnly(notificationSender('REMINDER', 'Reminder')));

// ---------- POST /api/admin/bookings/:id/send-confirmation ----------
router.all('/:id/send-confirmation', postOnly(notificationSender('CONFIRMATION', 'Confirmation')));

// ---------- 404 fallback domain notifications ----------
router.use((req: Request, res: Response) => {
  return fail(res, 'Route tidak ditemukan di domain notifications.', 404, 'NOT_FOUND');
});

// ---------- POST /webhooks/:id/replay (S3 admin replay) ----------
// Mounted separately under /api/admin/webhooks (Opsi B: sub-router terpisah).
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

// ============================================================
// Vercel handler: mount router di prefix '/api/admin/bookings'
// ============================================================
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api/admin/bookings', router);
app.use('/api/admin/webhooks', webhookReplayRouter);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel kirim FULL URL ke lambda (terbukti di 2.3.2c), jadi Express mount
  // prefix '/api/admin/bookings' match semua sub-path. Safeguard: kalau runtime
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
        r.url = `/api/admin/bookings/${suffix}`;
      }
    }
  }
  return app(r, res as any);
}