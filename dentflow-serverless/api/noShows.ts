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
// Vercel handler: mount router di prefix '/api/no-shows'
// ============================================================
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api/no-shows', router);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel kirim FULL URL ke lambda (terbukti di 2.3.2c), jadi Express mount
  // prefix '/api/no-shows' match semua sub-path. Safeguard: kalau runtime strip
  // URL jadi destination saja (/api/noShows) dan suffix masuk ?path=, rekonstruksi.
  const r = req as any;
  const captured = r.query && r.query.path ? r.query.path : undefined;
  if (captured) {
    const suffix = Array.isArray(captured) ? captured[0] : String(captured);
    const url = String(r.url || '');
    if (suffix && !url.includes(`/${suffix}`)) {
      r.url = `/api/no-shows/${suffix}`;
    }
  }
  return app(r, res as any);
}