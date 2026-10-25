import type { VercelRequest, VercelResponse } from '@vercel/node';
import express, { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { getSupabase } from '../lib/supabase';
import { extractBearerToken, verifyJwt, requireRole, enforceTenant, AuthUser } from '../lib/auth';

// Router-level guard = UNION (quick-view juga untuk PATIENT, parity
// patientHistory.routes.ts). Semua route patients lain di-restriksi ulang
// per-route ke ADMIN_DOCTOR (parity patients.routes.ts) supaya PATIENT tetap
// ter-block — kalau cuma union doang, PATIENT bisa buka list/detail/audit,
// itu SECURITY REGRESSION. Pattern sama dengan encounters.ts.
const ALLOWED_ROLES = ['ADMIN_BRANCH', 'DOCTOR', 'PATIENT'];
const ADMIN_DOCTOR = ['ADMIN_BRANCH', 'DOCTOR'];

// ============================================================
// Consolidated /api/patients — B+C pattern (MODULITH pilot)
// - Approach B: vercel.json rewrites /api/patients/:path* -> /api/patients
// - Approach C: Express router di-mount prefix '/api/patients'
//   (Vercel kirim FULL URL ke lambda, terbukti di task 2.3.2c)
// Parity Express: dentflow-backend/src/routes/patients.routes.ts
//   (scope serverless saat ini: 4 endpoint GET)
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

// ---------- Auth + env guard (level router, parity 4 file lama) ----------
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

// ---------- GET /api/patients/branches ----------
// HARUS SEBELUM /:id (kalau kebalik, "branches" akan match :id).
router.all('/branches', getOnly(async (req, res) => {
  const user = req.user;
  if (!ADMIN_DOCTOR.includes(user.role)) return fail(res, 'Forbidden', 403, 'FORBIDDEN');
  try {
    const supabase = getSupabase();

    // Parity Express listAccessibleBranches:
    // SELECT DISTINCT b.id, b.name FROM branches b
    // WHERE b.is_active = true AND (b.id = own OR b.id IN (user_branch_access)) ORDER BY b.name
    // Cross-table OR tidak didukung PostgREST -> dua query, kurasi di JS (sama dgn file lama).
    const { data: branchRows, error: eb } = await supabase
      .from('branches')
      .select('id, name')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (eb) return fail(res, `Database error: ${eb.message}`, 500, 'DB_ERROR');

    const { data: grants, error: eg } = await supabase
      .from('user_branch_access')
      .select('branch_id')
      .eq('user_id', user.userId);
    if (eg) return fail(res, `Database error: ${eg.message}`, 500, 'DB_ERROR');

    const accessibleIds = new Set<string>([
      user.branchId,
      ...(grants || []).map((g: any) => g.branch_id as string),
    ]);
    const branches = (branchRows || []).filter((b: any) => accessibleIds.has(b.id));

    return ok(res, branches);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- PUT /api/patients/:id ----------
// P1 — parity Express: patient.handler.ts updatePatient.
// WRITE ROUTE: WAJIB SEBELUM router.all('/:id', getOnly) supaya tidak
// shadow oleh GET-only guard (task 2.4.2c P1/P2 route shadow).
router.put('/:id', async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user;
  if (!ADMIN_DOCTOR.includes(user.role)) return fail(res, 'Forbidden', 403, 'FORBIDDEN');
  const patientId = req.params.id;
  if (!patientId) return fail(res, 'Parameter id pasien wajib diisi', 400, 'VALIDATION_ERROR');

  const { fullName, phone, email } = (req.body || {}) as {
    fullName?: string;
    phone?: string;
    email?: string;
  };
  if (!fullName || typeof fullName !== 'string' || !String(fullName).trim()) {
    return fail(res, 'Nama lengkap wajib diisi', 400, 'VALIDATION_ERROR');
  }

  try {
    const supabase = getSupabase();

    // getEffectiveBranch parity: req.branchId (tenant grant) || user.branchId.
    const rawBranch = req.query.branchId;
    const requestedBranchId = typeof rawBranch === 'string' && rawBranch.length > 0 ? rawBranch : undefined;
    let branchId = user.branchId;
    try {
      branchId = await enforceTenant(supabase, user, requestedBranchId);
    } catch (tenantErr: unknown) {
      const e = tenantErr as { statusCode?: number; message?: string };
      if (e.statusCode === 403) return fail(res, e.message || 'Forbidden', 403, 'FORBIDDEN');
      throw tenantErr;
    }

    // Branch scope: pasien harus ada di branch user.
    const { data: patient, error: e1 } = await supabase
      .from('patients')
      .select('id, user_id')
      .eq('id', patientId)
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .maybeSingle();
    if (e1) return fail(res, `Database error: ${e1.message}`, 500, 'DB_ERROR');
    if (!patient) return fail(res, 'Pasien tidak ditemukan', 404, 'PATIENT_NOT_FOUND');
    const userId = patient.user_id;

    if (email && typeof email === 'string') {
      const { data: dup, error: dupErr } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .neq('id', userId)
        .maybeSingle();
      if (dupErr) return fail(res, `Database error: ${dupErr.message}`, 500, 'DB_ERROR');
      if (dup) return fail(res, 'Email sudah digunakan oleh pengguna lain', 400, 'EMAIL_TAKEN');
    }

    // Parity: UPDATE patients SET full_name=$1, phone=COALESCE($2, phone), updated_at=NOW().
    const updates: Record<string, unknown> = { full_name: String(fullName).trim(), updated_at: new Date().toISOString() };
    if (phone !== undefined) updates.phone = String(phone);
    const { data: row, error: updErr } = await supabase
      .from('patients')
      .update(updates)
      .eq('id', patientId)
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .select('id, user_id, full_name, phone, branch_id, created_at, updated_at')
      .maybeSingle();
    if (updErr) return fail(res, `Database error: ${updErr.message}`, 500, 'DB_ERROR');
    if (!row) return fail(res, 'Pasien tidak ditemukan', 404, 'PATIENT_NOT_FOUND');

    if (email && typeof email === 'string') {
      const { error: uErr } = await supabase.from('users').update({ email }).eq('id', userId);
      if (uErr) return fail(res, `Database error: ${uErr.message}`, 500, 'DB_ERROR');
    }

    const { data: emailRow } = await supabase.from('users').select('email').eq('id', userId).maybeSingle();

    return ok(res, {
      id: row.id,
      userId: row.user_id,
      fullName: row.full_name,
      phone: row.phone || '',
      email: (emailRow as any)?.email || '',
      branchId: row.branch_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
});

// ---------- DELETE /api/patients/:id ----------
// P2 — parity Express: patient.handler.ts softDeletePatient (soft delete).
// WRITE ROUTE: WAJIB SEBELUM router.all('/:id', getOnly) supaya tidak
// shadow oleh GET-only guard (task 2.4.2c P1/P2 route shadow).
router.delete('/:id', async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user;
  if (!ADMIN_DOCTOR.includes(user.role)) return fail(res, 'Forbidden', 403, 'FORBIDDEN');
  const patientId = req.params.id;
  if (!patientId) return fail(res, 'Parameter id pasien wajib diisi', 400, 'VALIDATION_ERROR');

  try {
    const supabase = getSupabase();

    // getEffectiveBranch parity: req.branchId (tenant grant) || user.branchId.
    const rawBranch = req.query.branchId;
    const requestedBranchId = typeof rawBranch === 'string' && rawBranch.length > 0 ? rawBranch : undefined;
    let branchId = user.branchId;
    try {
      branchId = await enforceTenant(supabase, user, requestedBranchId);
    } catch (tenantErr: unknown) {
      const e = tenantErr as { statusCode?: number; message?: string };
      if (e.statusCode === 403) return fail(res, e.message || 'Forbidden', 403, 'FORBIDDEN');
      throw tenantErr;
    }

    // Parity Express: UPDATE patients SET deleted_at=NOW(), updated_at=NOW()
    // WHERE id=$1 AND branch_id=$2 AND deleted_at IS NULL RETURNING id, user_id.
    const now = new Date().toISOString();
    const { data: deleted, error: dErr } = await supabase
      .from('patients')
      .update({ deleted_at: now, updated_at: now })
      .eq('id', patientId)
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .select('id, user_id')
      .maybeSingle();
    if (dErr) return fail(res, `Database error: ${dErr.message}`, 500, 'DB_ERROR');
    if (!deleted) return fail(res, 'Pasien tidak ditemukan', 404, 'PATIENT_NOT_FOUND');

    // Parity Express: nonaktifkan akun user pasien.
    const { error: uErr } = await supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', deleted.user_id);
    if (uErr) return fail(res, `Database error: ${uErr.message}`, 500, 'DB_ERROR');

    return res.status(200).json({
      success: true,
      data: { id: patientId },
      message: 'Pasien berhasil dihapus',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
});

// ---------- GET /api/patients (list) ----------
router.all('/', getOnly(async (req, res) => {
  const user = req.user;
  if (!ADMIN_DOCTOR.includes(user.role)) return fail(res, 'Forbidden', 403, 'FORBIDDEN');
  try {
    const search = String(req.query.search || '').trim();
    const page = parseInt(String(req.query.page || '1'), 10) || 1;
    const limit = Math.min(parseInt(String(req.query.limit || '20'), 10) || 20, 100);
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Search pakai `%` wildcard (PostgREST ilike). `*` itu selector, bukan wildcard.
    // NOTE: email search via cross-table OR TIDAK di-support PostgREST v2 di sini.
    // Deviation dari Express (full_name OR phone OR email) -> hanya full_name OR phone.
    // Flag: TD-MIGRATE-008.
    const likePattern = search ? `%${search}%` : '';

    const supabase = getSupabase();
    let query = supabase
      .from('patients')
      .select(
        `id, branch_id, user_id, full_name, phone, created_at, updated_at, users:user_id ( email )`,
        { count: 'exact' }
      )
      .eq('branch_id', user.branchId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.or(`full_name.ilike.${likePattern},phone.ilike.${likePattern}`);
    }

    const { data, error: dbErr, count } = await query;
    if (dbErr) return fail(res, `Database error: ${dbErr.message}`, 500, 'DB_ERROR');

    const rows = data || [];
    const patientIds = rows.map((p: any) => p.id);

    // totalBookings + lastVisit (parity subquery Express).
    let bookingsCount: Record<string, number> = {};
    let lastVisits: Record<string, string> = {};
    if (patientIds.length > 0) {
      const bookings = await supabase.from('bookings').select('patient_id').in('patient_id', patientIds);
      if (!bookings.error) {
        bookingsCount = (bookings.data || []).reduce<Record<string, number>>((acc, b: any) => {
          acc[b.patient_id] = (acc[b.patient_id] || 0) + 1;
          return acc;
        }, {});
      }

      const encounters = await supabase
        .from('encounters')
        .select('patient_id, completed_at')
        .in('patient_id', patientIds);
      if (!encounters.error) {
        lastVisits = (encounters.data || []).reduce<Record<string, string>>((acc, e: any) => {
          const current = e.completed_at ? String(e.completed_at) : '';
          if (current && (!acc[e.patient_id] || current > acc[e.patient_id])) {
            acc[e.patient_id] = current;
          }
          return acc;
        }, {});
      }
    }

    const patients = rows.map((p: any) => ({
      id: p.id,
      userId: p.user_id,
      fullName: p.full_name,
      phone: p.phone || '',
      email: p.users?.email || '',
      branchId: p.branch_id,
      totalBookings: bookingsCount[p.id] || 0,
      lastVisit: lastVisits[p.id] || '',
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    const total = count || 0;

    return ok(res, {
      data: patients,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 0,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- GET /api/patients/:id/audit-trail ----------
router.all('/:id/audit-trail', getOnly(async (req, res) => {
  const user = req.user;
  if (!ADMIN_DOCTOR.includes(user.role)) return fail(res, 'Forbidden', 403, 'FORBIDDEN');
  const patientId = req.params.id;
  if (!patientId) return fail(res, 'Parameter id pasien wajib diisi', 400, 'VALIDATION_ERROR');

  try {
    const supabase = getSupabase();

    // getEffectiveBranch parity: req.branchId (tenant grant) || user.branchId
    const rawBranch = req.query.branchId;
    const requestedBranchId = typeof rawBranch === 'string' && rawBranch.length > 0 ? rawBranch : undefined;
    let branchId = user.branchId;
    try {
      branchId = await enforceTenant(supabase, user, requestedBranchId);
    } catch (tenantErr: unknown) {
      const e = tenantErr as { statusCode?: number; message?: string };
      if (e.statusCode === 403) return fail(res, e.message || 'Forbidden', 403, 'FORBIDDEN');
      throw tenantErr;
    }

    // Pastikan pasien ada di branch user (parity: 404 kalau tidak).
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .maybeSingle();
    if (!patient) return fail(res, 'Pasien tidak ditemukan', 404, 'PATIENT_NOT_FOUND');

    // Express: WHERE al.entity_id = $1 AND al.branch_id = $2 ORDER BY al.created_at DESC
    // (tidak filter entity_type; join actors untuk username).
    const { data, error: e1 } = await supabase
      .from('audit_logs')
      .select('id, event_type, description, created_at, users:user_id ( username )')
      .eq('entity_id', patientId)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });
    if (e1) return fail(res, `Database error: ${e1.message}`, 500, 'DB_ERROR');

    const logs = (data || []).map((l: any) => ({
      id: l.id,
      eventType: l.event_type,
      description: l.description || '',
      createdAt: l.created_at,
      actorName: l.users?.username || 'System',
    }));

    return ok(res, logs);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- POST /api/patients/merge (P3 mergePatients) ----------
// Parity Express patient.handler.mergePatients.
// Design: RPC atomic merge_patients (migration 037) — Supabase JS tidak
// bisa multi-write atomic.
// WAJIB SEBELUM getOnly('/:id') supaya tidak shadow (L1).
// Deviation positive vs Express: audit PATIENT_MERGED + users.is_active=false.
router.post('/merge', async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user;
  if (!ADMIN_DOCTOR.includes(user.role)) return fail(res, 'Forbidden', 403, 'FORBIDDEN');

  const body = (req.body || {}) as {
    primaryId?: string;
    duplicateIds?: string[];
    branchId?: string;
  };

  if (!body.primaryId || !Array.isArray(body.duplicateIds) || body.duplicateIds.length === 0) {
    return fail(res, 'primaryId dan duplicateIds (non-empty array) wajib diisi', 400, 'VALIDATION_ERROR');
  }

  try {
    const supabase = getSupabase();
    let branchId = user.branchId;
    try {
      branchId = await enforceTenant(supabase, user, body.branchId);
    } catch (tenantErr: unknown) {
      const e = tenantErr as { statusCode?: number; message?: string };
      if (e.statusCode === 403) return fail(res, e.message || 'Forbidden', 403, 'FORBIDDEN');
      throw tenantErr;
    }

    const { data, error: rpcErr } = await supabase.rpc('merge_patients', {
      p_primary_id: body.primaryId,
      p_dup_ids: body.duplicateIds,
      p_branch_id: branchId,
      p_user_id: user.userId,
    });

    if (rpcErr) {
      const msg = String(rpcErr.message || '');
      if (msg.includes('PRIMARY_PATIENT_NOT_FOUND')) return fail(res, 'Pasien utama tidak ditemukan', 404, 'PRIMARY_PATIENT_NOT_FOUND');
      if (msg.includes('DUPLICATE_PATIENT_NOT_FOUND')) return fail(res, 'Pasien duplikat tidak ditemukan', 404, 'DUPLICATE_PATIENT_NOT_FOUND');
      if (msg.includes('NO_DUPLICATE_IDS')) return fail(res, 'Tidak ada pasien duplikat', 400, 'NO_DUPLICATE_IDS');
      return fail(res, `RPC error: ${msg}`, 500, 'RPC_ERROR');
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return fail(res, 'RPC returned empty', 500, 'RPC_ERROR');

    return ok(res, {
      primaryId: row.primary_id,
      mergedCount: Number(row.merged_count),
    }, 200);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
});

// ---------- GET /api/patients/:id/quick-view ----------
// Parity Express: patientHistory.routes.ts (role PATIENT|DOCTOR|ADMIN_BRANCH) +
// patientQuickView.handler.ts. WAJIB SEBELUM /:id (dua segment path).
// SECURITY FIX vs Express (TD-2.4.24): Express query cuma WHERE p.id=$1 —
// cross-branch, tanpa soft-delete filter, tanpa ownership. Di sini:
//   - branch scope wajib .eq('branch_id', user.branchId)
//   - soft-delete wajib .is('deleted_at', null)
//   - PATIENT hanya boleh pasien yang user_id = JWT.userId (ownership)
// Response shape EXACT parity Express (no timestamp, id ... totalVisits),
// medicalConditions & allergies hardcoded [] (schema tidak punya sumber).
router.get('/:id/quick-view', async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user;
  const patientId = req.params.id;
  if (!patientId) return res.status(400).json({ success: false, message: 'Parameter id pasien wajib diisi' });

  try {
    const supabase = getSupabase();

    const base = supabase
      .from('patients')
      .select('id, full_name, phone, date_of_birth, user_id')
      .eq('id', patientId)
      .eq('branch_id', user.branchId)
      .is('deleted_at', null);
    const query = user.role === 'PATIENT' ? base.eq('user_id', user.userId) : base;

    const { data: patient, error: e1 } = await query.maybeSingle();
    if (e1) return fail(res, `Database error: ${e1.message}`, 500, 'DB_ERROR');
    if (!patient) return res.status(404).json({ success: false, message: 'Pasien tidak ditemukan' });

    const { data: userRow } = patient.user_id
      ? await supabase.from('users').select('email').eq('id', patient.user_id).maybeSingle()
      : { data: null };

    const { data: encounters, error: e2 } = await supabase
      .from('encounters')
      .select('completed_at')
      .eq('patient_id', patient.id);
    if (e2) return fail(res, `Database error: ${e2.message}`, 500, 'DB_ERROR');

    const totalVisits = (encounters || []).length;
    let lastVisit = '';
    for (const e of encounters || []) {
      const ts = e.completed_at ? String(e.completed_at) : '';
      if (ts && ts > lastVisit) lastVisit = ts;
    }

    const age = patient.date_of_birth
      ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
      : undefined;

    return res.status(200).json({
      success: true,
      data: {
        id: patient.id,
        fullName: patient.full_name,
        phone: patient.phone || '',
        email: (userRow as any)?.email || '',
        age,
        medicalConditions: [],
        allergies: [],
        lastVisit,
        totalVisits,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
});

// ---------- GET /api/patients/:id (detail) ----------
router.all('/:id', getOnly(async (req, res) => {
  const user = req.user;
  if (!ADMIN_DOCTOR.includes(user.role)) return fail(res, 'Forbidden', 403, 'FORBIDDEN');
  const patientId = req.params.id;
  if (!patientId) return fail(res, 'Parameter id pasien wajib diisi', 400, 'VALIDATION_ERROR');

  try {
    const supabase = getSupabase();

    // getEffectiveBranch parity: req.branchId (tenant grant) || user.branchId
    const rawBranch = req.query.branchId;
    const requestedBranchId = typeof rawBranch === 'string' && rawBranch.length > 0 ? rawBranch : undefined;
    let branchId = user.branchId;
    try {
      branchId = await enforceTenant(supabase, user, requestedBranchId);
    } catch (tenantErr: unknown) {
      const e = tenantErr as { statusCode?: number; message?: string };
      if (e.statusCode === 403) return fail(res, e.message || 'Forbidden', 403, 'FORBIDDEN');
      throw tenantErr;
    }

    // Patient + email user (parity query utama Express getPatientDetail).
    const { data: patient, error: e1 } = await supabase
      .from('patients')
      .select(`id, user_id, full_name, phone, branch_id, created_at, updated_at, users:user_id ( email )`)
      .eq('id', patientId)
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .maybeSingle();
    if (e1) return fail(res, `Database error: ${e1.message}`, 500, 'DB_ERROR');
    if (!patient) return fail(res, 'Pasien tidak ditemukan', 404, 'PATIENT_NOT_FOUND');

    // totalBookings/lastVisit = subquery COUNT/MAX Express (tanpa filter branch).
    const [countRes, lastRes] = await Promise.all([
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('patient_id', patientId),
      supabase.from('encounters').select('completed_at').eq('patient_id', patientId).order('completed_at', { ascending: false }).limit(1),
    ]);
    const totalBookings = countRes.count || 0;
    const lastRow = (lastRes.data || [])[0];
    const lastVisit = lastRow && lastRow.completed_at ? String(lastRow.completed_at) : '';

    // Bookings + encounters + invoices (branch-scoped, paralel).
    const [bookingsRes, encountersRes, invoicesRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, booking_date, booking_time, status, doctors:doctor_id ( full_name )')
        .eq('patient_id', patientId)
        .eq('branch_id', branchId)
        .order('booking_date', { ascending: false })
        .order('booking_time', { ascending: false }),
      supabase
        .from('encounters')
        .select('id, created_at, diagnosis, doctors:doctor_id ( full_name )')
        .eq('patient_id', patientId)
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false }),
      supabase
        .from('invoices')
        .select('id, invoice_number, amount_due, status')
        .eq('patient_id', patientId)
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false }),
    ]);
    if (bookingsRes.error) return fail(res, `Database error: ${bookingsRes.error.message}`, 500, 'DB_ERROR');
    if (encountersRes.error) return fail(res, `Database error: ${encountersRes.error.message}`, 500, 'DB_ERROR');
    if (invoicesRes.error) return fail(res, `Database error: ${invoicesRes.error.message}`, 500, 'DB_ERROR');

    const bookings = (bookingsRes.data || []).map((b: any) => ({
      id: b.id,
      bookingDate: b.booking_date ? `${b.booking_date} ${b.booking_time || ''}`.trim() : '',
      doctorName: b.doctors?.full_name || '',
      status: b.status,
    }));
    const encounters = (encountersRes.data || []).map((e: any) => ({
      id: e.id,
      createdAt: e.created_at,
      doctorName: e.doctors?.full_name || '',
      diagnosis: e.diagnosis || '',
    }));
    const invoices = (invoicesRes.data || []).map((i: any) => ({
      id: i.id,
      invoiceNumber: i.invoice_number || '',
      totalAmount: Number(i.amount_due) || 0,
      status: i.status,
    }));

    return ok(res, {
      id: patient.id,
      userId: patient.user_id,
      fullName: patient.full_name,
      phone: patient.phone || '',
      email: (patient as any).users?.email || '',
      branchId: patient.branch_id,
      totalBookings,
      lastVisit,
      createdAt: patient.created_at,
      updatedAt: patient.updated_at,
      bookings,
      encounters,
      invoices,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- 404 fallback domain patients ----------
router.use((req: Request, res: Response) => {
  return fail(res, 'Route tidak ditemukan di domain patients.', 404, 'NOT_FOUND');
});

// ============================================================
// Vercel handler: mount router di prefix '/api/patients'
// ============================================================
const app = express();
app.use('/api/patients', router);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel kirim FULL URL ke lambda (terbukti di 2.3.2c), jadi Express mount
  // prefix '/api/patients' match semua sub-path. Safeguard: kalau runtime strip
  // URL jadi destination saja (/api/patients) dan suffix masuk ?path=, rekonstruksi.
  const r = req as any;
  const captured = r.query && r.query.path ? r.query.path : undefined;
  if (captured) {
    const suffix = Array.isArray(captured) ? captured[0] : String(captured);
    const url = String(r.url || '');
    if (suffix && !url.includes(`/${suffix}`)) {
      r.url = `/api/patients/${suffix}`;
    }
  }
  return app(r, res as any);
}