import type { VercelRequest, VercelResponse } from '@vercel/node';
import express, { Request, Response } from 'express';
import { Router } from 'express';
import { getSupabase } from '../lib/supabase';

// ============================================================
// Consolidated /walk-in — Task 2.4.1 (W1, FIRST WRITE)
// - Approach B: vercel.json rewrites /walk-in/:path* -> /api/walkIn?path=$1
// - Approach C: Express router di-mount prefix '/walk-in'
//   (Vercel kirim FULL URL ke lambda, terbukti di task 2.3.2c)
// Scope serverless saat ini: 1 endpoint WRITE (public, no auth):
//   POST /walk-in/create-profile    (create temporary profile)
// Parity Express: dentflow-backend/src/routes/walkIn.routes.ts
//                 dentflow-backend/src/handlers/walkIn.handler.ts
//                 dentflow-backend/src/services/walkIn.service.ts
// ============================================================

// Response shape = parity Express walkIn.handler:
//   success: { success: true, data, message }
//   error  : { success: false, message }
const fail = (res: Response, message: string, status = 400) =>
  res.status(status).json({ success: false, message });

const router: Router = express.Router();

// POST-only guard (parity: metode selain POST => 405 METHOD_NOT_ALLOWED).
const postOnly =
  (handler: (req: Request, res: Response) => unknown) =>
  (req: Request, res: Response) => {
    if (req.method !== 'POST') {
      return fail(res, 'Method not allowed', 405);
    }
    return handler(req, res);
  };

// ---------- POST /walk-in/create-profile ----------
// Public endpoint (rate-limited di Express via walkInRateLimiter) — tanpa auth.
// Rate limit di-skip di serverless (Vercel handling).
router.all('/create-profile', postOnly(async (req, res) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return fail(res, 'ENV_MISSING: SUPABASE_* belum di-set.', 500);
  }

  // Parity Express walkIn.handler createTemporaryProfile.
  const body = (req.body || {}) as { fullName?: string; phone?: string; age?: string | number; branchId?: string };
  const { fullName, phone, age, branchId } = body;

  if (!fullName || !phone || !branchId) {
    return res.status(400).json({
      success: false,
      message: 'fullName, phone, and branchId are required',
    });
  }

  try {
    const supabase = getSupabase();

    // Parity Express walkIn.service.createTemporaryProfile:
    // INSERT INTO temporary_patients (branch_id, full_name, phone, age) RETURNING *
    const { data, error } = await supabase
      .from('temporary_patients')
      .insert({
        branch_id: branchId,
        full_name: fullName,
        phone,
        age: age ? parseInt(String(age), 10) : null,
      })
      .select('id, full_name, phone, branch_id')
      .maybeSingle();

    if (error || !data) {
      return fail(res, 'Failed to create temporary profile', 500);
    }

    return res.status(201).json({
      success: true,
      data: {
        tempPatientId: data.id,
        fullName: data.full_name,
        phone: data.phone,
        branchId: data.branch_id,
      },
      message: 'Profil temporer berhasil dibuat',
    });
  } catch (err: unknown) {
    return fail(res, 'Failed to create temporary profile', 500);
  }
}));

// ---------- 404 fallback domain walk-in ----------
router.use((req: Request, res: Response) => {
  return fail(res, 'Route tidak ditemukan di domain walk-in.', 404);
});

// ============================================================
// Vercel handler: mount router di prefix '/walk-in'
// ============================================================
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/walk-in', router);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel kirim FULL URL ke lambda (terbukti di 2.3.2c), jadi Express mount
  // prefix '/walk-in' match semua sub-path. Safeguard: kalau runtime strip
  // URL jadi destination saja (/api/walkIn) dan suffix masuk ?path=, rekonstruksi.
  const r = req as any;
  const captured = r.query && r.query.path ? r.query.path : undefined;
  if (captured) {
    const suffix = Array.isArray(captured) ? captured[0] : String(captured);
    const url = String(r.url || '');
    if (suffix && !url.includes(`/${suffix}`)) {
      r.url = `/walk-in/${suffix}`;
    }
  }
  return app(r, res as any);
}