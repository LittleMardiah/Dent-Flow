import type { VercelRequest, VercelResponse } from '@vercel/node';
import express, { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { getSupabase } from '../lib/supabase';
import { extractBearerToken, verifyJwt, requireRole, AuthUser } from '../lib/auth';

const ALLOWED_ROLES = ['ADMIN_BRANCH', 'PATIENT', 'DOCTOR'];

// ============================================================
// Consolidated /api/doctors — B+C pattern (replikasi pilot 2.3.2d)
// - Approach B: vercel.json rewrites /api/doctors/:path* -> /api/doctors?path=$1
// - Approach C: Express router di-mount prefix '/api/doctors'
//   (Vercel kirim FULL URL ke lambda, terbukti di task 2.3.2c)
// Scope serverless saat ini: 2 endpoint GET:
//   GET /api/doctors                (list doctors)
//   GET /api/doctors/:id/patients   (list pasien dokter)
// Parity Express: dentflow-backend/src/handlers/doctorsList.handler.ts
//                 dentflow-backend/src/handlers/doctorProfile.handler.ts
// ============================================================

// Response helpers — shape IDENTIK dengan lib/response (success/error).
const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data, timestamp: new Date().toISOString() });
const fail = (res: Response, message: string, status = 400, code = 'ERROR') =>
  res.status(status).json({ success: false, error: code, message, timestamp: new Date().toISOString() });

interface AuthedRequest extends Request {
  user: AuthUser;
}

const router: Router = express.Router();

// ---------- Auth + env guard (level router, parity 2 file lama) ----------
router.use((req: Request, res: Response, next: NextFunction) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fail(res, 'ENV_MISSING: SUPABASE_* belum di-set.', 500, 'ENV_MISSING');
  }
  if (!process.env.JWT_SECRET) {
    return fail(res, 'ENV_MISSING: JWT_SECRET belum di-set.', 500, 'ENV_MISSING');
  }

  const authHeader = req.headers['authorization'];
  const token = extractBearerToken(typeof authHeader === 'string' ? authHeader : undefined);
  if (!token) return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');

  try {
    const user = verifyJwt(token);
    requireRole(user, ALLOWED_ROLES);
    (req as AuthedRequest).user = user;
    next();
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 403) return fail(res, e.message || 'Forbidden', 403, 'FORBIDDEN');
    return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');
  }
});

// GET-only guard (parity: metode selain GET => 405 METHOD_NOT_ALLOWED).
const getOnly =
  (handler: (req: AuthedRequest, res: Response) => unknown) =>
  (req: Request, res: Response) => {
    if (req.method !== 'GET') {
      return fail(res, 'Method not allowed', 405, 'METHOD_NOT_ALLOWED');
    }
    return handler(req as AuthedRequest, res);
  };

// ---------- GET /api/doctors (list) ----------
router.all('/', getOnly(async (req, res) => {
  const user = req.user;
  try {
    const supabase = getSupabase();

    // branchId: query param (admin/doctor) atau branch user sendiri (fallback).
    const rawBranch = req.query.branchId || req.query.branch_id;
    const branchId = typeof rawBranch === 'string' && rawBranch.length > 0
      ? rawBranch
      : user.branchId;

    const { data, error: dbError } = await supabase
      .from('doctors')
      .select(`
        id,
        user_id,
        branch_id,
        full_name,
        specialization,
        license_number,
        is_available,
        users:user_id ( email ),
        branches:branch_id ( name )
      `)
      .eq('branch_id', branchId)
      .order('full_name', { ascending: true });

    if (dbError) return fail(res, `Database error: ${dbError.message}`, 500, 'DB_ERROR');

    const doctors = (data || []).map((d: any) => ({
      id: d.id,
      userId: d.user_id,
      branchId: d.branch_id,
      branchName: d.branches?.name || null,
      fullName: d.full_name,
      specialization: d.specialization,
      licenseNumber: d.license_number,
      isAvailable: d.is_available,
      email: d.users?.email || null,
      queueCount: 0,
    }));

    return ok(res, { count: doctors.length, doctors });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- GET /api/doctors/:id/patients ----------
router.all('/:id/patients', getOnly(async (req, res) => {
  const user = req.user;

  // Parity role: hanya DOCTOR, ADMIN_BRANCH (file lama lewat requireRole).
  if (!['DOCTOR', 'ADMIN_BRANCH'].includes(user.role)) {
    return fail(res, 'Forbidden: role tidak diizinkan untuk endpoint ini.', 403, 'FORBIDDEN');
  }

  const doctorId = req.params.id;
  if (!doctorId) return fail(res, 'Parameter id dokter wajib diisi', 400, 'VALIDATION_ERROR');

  try {
    const supabase = getSupabase();

    // Parity dgn Express: dokter harus ada DI BRANCH USER (WHERE id=$1 AND branch_id=$2).
    // Mencegah cross-branch data leak.
    const { data: doctorRow, error: doctorErr } = await supabase
      .from('doctors')
      .select('id, branch_id')
      .eq('id', doctorId)
      .eq('branch_id', user.branchId)
      .maybeSingle();

    if (doctorErr) return fail(res, `Database error: ${doctorErr.message}`, 500, 'DB_ERROR');
    if (!doctorRow) return fail(res, 'Dokter tidak ditemukan di branch ini', 404, 'DOCTOR_NOT_FOUND');

    // Ambil semua encounters dokter ini, join patient + user (email).
    // Express: p.deleted_at IS NULL; last_visit = MAX(COALESCE(e.started_at, e.created_at)).
    const { data, error: dbError } = await supabase
      .from('encounters')
      .select(`
        started_at,
        created_at,
        patients:patient_id (
          id,
          user_id,
          full_name,
          phone,
          users:user_id (
            email
          )
        )
      `)
      .eq('doctor_id', doctorId)
      .is('patients.deleted_at', null);

    if (dbError) return fail(res, `Database error: ${dbError.message}`, 500, 'DB_ERROR');

    // Aggregate per patient: total visits + last visit.
    const agg = new Map<string, {
      id: string;
      userId: string;
      fullName: string;
      phone: string;
      email: string;
      totalVisits: number;
      lastVisit: string | null;
    }>();

    for (const row of (data || []) as any[]) {
      const p = row.patients;
      if (!p) continue;
      const last = row.started_at || row.created_at || null;
      const key = p.id;
      const existing = agg.get(key);
      if (existing) {
        existing.totalVisits += 1;
        if (last && (!existing.lastVisit || last > existing.lastVisit)) {
          existing.lastVisit = last;
        }
      } else {
        agg.set(key, {
          id: p.id,
          userId: p.user_id || '',
          fullName: p.full_name,
          phone: p.phone || '',
          email: p.users?.email || '',
          totalVisits: 1,
          lastVisit: last,
        });
      }
    }

    const patients = Array.from(agg.values()).sort((a, b) =>
      (b.lastVisit || '').localeCompare(a.lastVisit || '')
    );

    return ok(res, patients);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- 404 fallback domain doctors ----------
router.use((req: Request, res: Response) => {
  return fail(res, 'Route tidak ditemukan di domain doctors.', 404, 'NOT_FOUND');
});

// ============================================================
// Vercel handler: mount router di prefix '/api/doctors'
// ============================================================
const app = express();
app.use('/api/doctors', router);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel kirim FULL URL ke lambda (terbukti di 2.3.2c), jadi Express mount
  // prefix '/api/doctors' match semua sub-path. Safeguard: kalau runtime strip
  // URL jadi destination saja (/api/doctors) dan suffix masuk ?path=, rekonstruksi.
  const r = req as any;
  const captured = r.query && r.query.path ? r.query.path : undefined;
  if (captured) {
    const suffix = Array.isArray(captured) ? captured[0] : String(captured);
    const url = String(r.url || '');
    if (suffix && !url.includes(`/${suffix}`)) {
      r.url = `/api/doctors/${suffix}`;
    }
  }
  return app(r, res as any);
}