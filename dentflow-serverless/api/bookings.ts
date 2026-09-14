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