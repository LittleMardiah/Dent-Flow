import type { VercelRequest, VercelResponse } from '@vercel/node';
import express, { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { getSupabase } from '../lib/supabase';
import { extractBearerToken, verifyJwt, requireRole, enforceTenant, AuthUser } from '../lib/auth';

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

// ---------- Profil dokter (shared GET /me & PUT /me) ----------
// Parity Express PROFILE_QUERY (doctorProfile.handler.ts:10-18):
// createdAt & updatedAt bersumber dari DOCTORS (d.created_at/d.updated_at),
// is_active dari USERS (u.is_active), branchName dari BRANCHES (b.name).
const profileQuery = (userId: string) =>
  getSupabase()
    .from('doctors')
    .select(`
      id,
      user_id,
      full_name,
      specialization,
      license_number,
      branch_id,
      created_at,
      updated_at,
      users:user_id ( email, phone, is_active ),
      branches:branch_id ( name )
    `)
    .eq('user_id', userId)
    .maybeSingle();

const mapProfile = (d: any) => ({
  id: d.id,
  userId: d.user_id,
  fullName: d.full_name,
  email: d.users?.email || '',
  phone: d.users?.phone || '',
  specialization: d.specialization || '',
  licenseNumber: d.license_number || '',
  isActive: d.users?.is_active ?? true,
  branchId: d.branch_id,
  branchName: d.branches?.name || '',
  createdAt: d.created_at,
  updatedAt: d.updated_at,
});

// ---------- Doctor detail helpers (GET /:id + PATCH /:id/status) ----------
// New (design): mapDoctorDetail dipisah dari mapProfile — Test A prompt mewajibkan
// response TANPA createdAt/updatedAt/timestamp (D6). isActive = users.is_active (D2).
const isValidUuid = (s: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

const mapDoctorDetail = (row: any) => ({
  id: row.id,
  userId: row.user_id,
  fullName: row.full_name,
  email: row.users?.email || '',
  specialization: row.specialization || '',
  licenseNumber: row.license_number || '',
  isActive: row.users?.is_active ?? true,
  branchId: row.branch_id,
  branchName: row.branches?.name || '',
});

// Shared query: doctors join users + branches, branch-scoped. Parity profileQuery
// tapi tanpa created_at/updated_at (D6). Dipakai GET /:id dan re-fetch PATCH /:id/status.
// NOTE: TANPA maybeSingle() supaya masih bisa di-chain .eq() (role DOCTOR self filter).
const doctorDetailQuery = (id: string, branchId: string) =>
  getSupabase()
    .from('doctors')
    .select(`
      id,
      user_id,
      full_name,
      specialization,
      license_number,
      branch_id,
      users:user_id ( email, is_active ),
      branches:branch_id ( name )
    `)
    .eq('id', id)
    .eq('branch_id', branchId);

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

    const { data: doctorsData, error: dbError } = await supabase
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

    // Agregat queueCount (SATU query, bukan N+1): hitung queues status WAITING per doctor_id.
    const doctorIds = (doctorsData || []).map((d: any) => d.id);
    let queueCounts: Record<string, number> = {};
    if (doctorIds.length > 0) {
      const { data: queueRows, error: queueErr } = await supabase
        .from('queues')
        .select('doctor_id')
        .in('doctor_id', doctorIds)
        .eq('status', 'WAITING');
      if (queueErr) return fail(res, `Database error: ${queueErr.message}`, 500, 'DB_ERROR');
      queueCounts = (queueRows || []).reduce((acc: Record<string, number>, q: any) => {
        acc[q.doctor_id] = (acc[q.doctor_id] || 0) + 1;
        return acc;
      }, {});
    }

    const doctors = (doctorsData || []).map((d: any) => ({
      id: d.id,
      userId: d.user_id,
      branchId: d.branch_id,
      branchName: d.branches?.name || null,
      fullName: d.full_name,
      specialization: d.specialization,
      licenseNumber: d.license_number,
      isAvailable: d.is_available,
      isActive: d.is_available,
      email: d.users?.email || null,
      queueCount: queueCounts[d.id] || 0,
    }));

    return ok(res, doctors);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- GET /api/doctors/me ----------
// Parity Express: doctorProfile.handler.ts getDoctorProfile.
// Auth: DOCTOR only — TIDAK ADMIN_BRANCH (parity roleMiddleware(['DOCTOR'])).
// pakai router.get (bukan all) biar PUT /me (handler terpisah di bawah) tetap 200.
router.get('/me', getOnly(async (req, res) => {
  const user = req.user;
  if (!user?.userId) return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');
  if (user.role !== 'DOCTOR') {
    return fail(res, 'Forbidden: role tidak diizinkan untuk endpoint ini.', 403, 'FORBIDDEN');
  }

  try {
    const { data: profile, error: profileErr } = await profileQuery(user.userId);
    if (profileErr) return fail(res, `Database error: ${profileErr.message}`, 500, 'DB_ERROR');
    if (!profile) return res.status(404).json({ success: false, error: 'DOCTOR_PROFILE_NOT_FOUND' });

    return res.status(200).json({ success: true, data: mapProfile(profile) });
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

// ---------- PUT /api/doctors/me ----------
// D0 — parity Express: doctorProfile.handler.ts updateDoctorProfile.
// Auth: DOCTOR only (parity roleMiddleware(['DOCTOR'])).
router.put('/me', async (req: Request, res: Response) => {
  const authedReq = req as AuthedRequest;
  const user = authedReq.user;

  // Parity: endpoint ini khusus DOCTOR (dipakai dokter untuk update profil sendiri).
  if (user.role !== 'DOCTOR') {
    return fail(res, 'Forbidden: role tidak diizinkan untuk endpoint ini.', 403, 'FORBIDDEN');
  }

  const userId = user.userId;
  if (!userId) {
    return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');
  }

  const { phone, email } = (req.body || {}) as { phone?: string; email?: string };
  if (phone === undefined && email === undefined) {
    return fail(res, 'Minimal satu field (phone / email) harus diisi', 400, 'VALIDATION_ERROR');
  }

  try {
    const supabase = getSupabase();

    const { data: profile, error: profileErr } = await profileQuery(userId);
    if (profileErr) return fail(res, `Database error: ${profileErr.message}`, 500, 'DB_ERROR');
    if (!profile) return fail(res, 'Profil dokter tidak ditemukan', 404, 'DOCTOR_PROFILE_NOT_FOUND');

    if (email !== undefined) {
      if (typeof email !== 'string' || !String(email).trim()) {
        return fail(res, 'Format email tidak valid', 400, 'VALIDATION_ERROR');
      }
      const { data: dup, error: dupErr } = await supabase
        .from('users')
        .select('id')
        .eq('email', String(email).trim())
        .neq('id', userId)
        .maybeSingle();
      if (dupErr) return fail(res, `Database error: ${dupErr.message}`, 500, 'DB_ERROR');
      if (dup) return fail(res, 'Email sudah digunakan oleh pengguna lain', 400, 'EMAIL_TAKEN');
    }

    // Parity: UPDATE users SET email=COALESCE(...), phone=COALESCE(...), updated_at=NOW() WHERE id=$3.
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (email !== undefined) updates.email = String(email).trim();
    if (phone !== undefined) updates.phone = String(phone);
    const { error: updErr } = await supabase.from('users').update(updates).eq('id', userId);
    if (updErr) return fail(res, `Database error: ${updErr.message}`, 500, 'DB_ERROR');

    const { data: updated, error: refetchErr } = await profileQuery(userId);
    if (refetchErr) return fail(res, `Database error: ${refetchErr.message}`, 500, 'DB_ERROR');

    return res.status(200).json({
      success: true,
      data: mapProfile(updated),
      message: 'Profil dokter berhasil diperbarui',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
});

// ---------- DELETE /api/doctors/:id/leave ----------
// D2 — parity Express: doctorSchedule.handler.ts removeLeave
// Auth: router-level (ADMIN_BRANCH, PATIENT, DOCTOR) — sama dengan Express roleMiddleware.
router.delete('/:id/leave', async (req: Request, res: Response) => {
  const authedReq = req as AuthedRequest;
  const doctorId = req.params.id as string;
  const body = (req.body || {}) as { start_date?: string; end_date?: string };
  const adminId = authedReq.user?.userId;

  if (!adminId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (!body.start_date || !body.end_date) {
    return res.status(400).json({ success: false, error: 'start_date and end_date are required' });
  }

  try {
    const supabase = getSupabase();

    // Resolve doctors.id -> users.id: doctor_leaves.doctor_id FK -> users(id)
    // (sama seperti PUT D1). Delete harus match dgn user_id biar record
    // yang di-insert via PUT ketemu (task 2.4.2c D2, same root cause).
    const { data: doctorRow, error: doctorErr } = await supabase
      .from('doctors')
      .select('user_id')
      .eq('id', doctorId)
      .maybeSingle();
    if (doctorErr) return fail(res, `Database error: ${doctorErr.message}`, 500, 'DB_ERROR');
    if (!doctorRow) return fail(res, 'Dokter tidak ditemukan', 404, 'DOCTOR_NOT_FOUND');
    const doctorUserId = doctorRow.user_id as string;

    // Parity Express removeDoctorLeave: DELETE FROM doctor_leaves
    // WHERE doctor_id=$1 AND start_date=$2 AND end_date=$3 (dates di-normalisasi ke YYYY-MM-DD).
    const startStr = new Date(body.start_date).toISOString().split('T')[0];
    const endStr = new Date(body.end_date).toISOString().split('T')[0];

    const { error: dbErr } = await supabase
      .from('doctor_leaves')
      .delete()
      .eq('doctor_id', doctorUserId)
      .eq('start_date', startStr)
      .eq('end_date', endStr);

    if (dbErr) {
      return res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR', message: 'Server error' });
    }

    return res.status(200).json({
      success: true,
      message: `Doctor ${doctorId} leave removed from ${body.start_date} to ${body.end_date}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_SERVER_ERROR');
  }
});

// ---------- PUT /api/doctors/:id/leave ----------
// D1 — parity Express: doctorSchedule.handler.ts setLeave + service setDoctorLeave.
// Branch scope wajib: branch_id body di-resolve via enforceTenant, dan target
// dokter divalidasi ada di branch tsb (cegah cross-branch write + 404 yang jelas).
router.put('/:id/leave', async (req: Request, res: Response) => {
  const authedReq = req as AuthedRequest;
  const user = authedReq.user;
  const doctorId = req.params.id as string;
  const body = (req.body || {}) as {
    branch_id?: string;
    start_date?: string;
    end_date?: string;
    reason?: string;
  };
  const adminId = user?.userId;

  if (!adminId) {
    return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');
  }

  if (!body.branch_id || !body.start_date || !body.end_date) {
    return fail(res, 'branch_id, start_date, end_date are required', 400, 'VALIDATION_ERROR');
  }

  try {
    const supabase = getSupabase();

    // getEffectiveBranch parity: req.branchId (tenant grant) || user.branchId.
    let branchId = user.branchId;
    try {
      branchId = await enforceTenant(supabase, user, body.branch_id);
    } catch (tenantErr: unknown) {
      const e = tenantErr as { statusCode?: number; message?: string };
      if (e.statusCode === 403) return fail(res, e.message || 'Forbidden', 403, 'FORBIDDEN');
      throw tenantErr;
    }

    // Branch scope: pastikan dokter ada di branch tsb (parity GET /:id/patients).
    // Ambil user_id juga: doctor_leaves.doctor_id FK -> users(id) (migration 007),
    // sama seperti doctor_schedules.dokter_id -> users(id). doctors.id adalah UUID
    // terpisah (gen_random_uuid), JANGAN dipakai untuk kolom doctor_id (task 2.4.2c D1).
    const { data: doctorRow, error: doctorErr } = await supabase
      .from('doctors')
      .select('id, user_id')
      .eq('id', doctorId)
      .eq('branch_id', branchId)
      .maybeSingle();
    if (doctorErr) return fail(res, `Database error: ${doctorErr.message}`, 500, 'DB_ERROR');
    if (!doctorRow) return fail(res, 'Dokter tidak ditemukan di branch ini', 404, 'DOCTOR_NOT_FOUND');
    const doctorUserId = doctorRow.user_id as string;

    // Parity Express service setDoctorLeave: INSERT INTO doctor_leaves.
    // doctor_id di-isi user_id dokter (bukan doctors.id) supaya FK users(id) valid.
    const startStr = new Date(body.start_date).toISOString().split('T')[0];
    const endStr = new Date(body.end_date).toISOString().split('T')[0];

    const { error: insErr } = await supabase
      .from('doctor_leaves')
      .insert({
        doctor_id: doctorUserId,
        branch_id: branchId,
        start_date: startStr,
        end_date: endStr,
        reason: body.reason || '',
        created_by: adminId,
      });
    if (insErr) return fail(res, 'Gagal set leave', 500, 'LEAVE_SET_FAILED');

    return res.status(200).json({
      success: true,
      message: `Doctor ${doctorId} leave set from ${body.start_date} to ${body.end_date}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_SERVER_ERROR');
  }
});

// ---------- POST /api/doctors/:id/ready-next (D3) ----------
router.post('/:id/ready-next', async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user;
  if (!user || user.role !== 'DOCTOR') {
    return fail(res, 'Forbidden: endpoint ini untuk dokter', 403, 'FORBIDDEN');
  }
  const doctorId = req.params.id as string;
  if (!doctorId) return fail(res, 'Parameter id dokter wajib diisi', 400, 'VALIDATION_ERROR');

  try {
    const supabase = getSupabase();
    const { data: doctor, error: dErr } = await supabase
      .from('doctors')
      .select('id, user_id, branch_id')
      .eq('id', doctorId)
      .eq('branch_id', user.branchId)
      .maybeSingle();
    if (dErr) return fail(res, `Database error: ${dErr.message}`, 500, 'DB_ERROR');
    if (!doctor) return fail(res, 'Dokter tidak ditemukan di branch ini', 404, 'DOCTOR_NOT_FOUND');
    if (doctor.user_id !== user.userId) return fail(res, 'Forbidden: bukan data Anda', 403, 'FORBIDDEN');

    const { data: rpcData, error: rpcErr } = await supabase.rpc('call_next_patient', {
      p_doctor_id: doctorId,
      p_branch_id: user.branchId,
    });
    if (rpcErr) return fail(res, `RPC error: ${rpcErr.message}`, 500, 'RPC_ERROR');

    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (!row) {
      return res.status(200).json({
        success: true, data: null,
        message: 'Tidak ada pasien menunggu',
        timestamp: new Date().toISOString(),
      });
    }

    const { error: auditErr } = await supabase.from('audit_logs').insert({
      branch_id: user.branchId, user_id: user.userId,
      event_type: 'QUEUE_CALLED', entity_type: 'QUEUE', entity_id: row.queue_id,
      new_values: { queue_number: row.queue_number, status: 'BEING_CALLED' },
      description: `Queue ${row.queue_number} called`,
    });
    if (auditErr) console.error('QUEUE_CALLED audit failed:', auditErr.message);

    return res.status(200).json({
      success: true,
      data: {
        id: row.queue_id, queue_number: row.queue_number,
        booking_id: row.booking_id, doctor_id: row.doctor_id,
        status: row.status, called_at: row.called_at,
      },
      message: 'Pasien berikutnya dipanggil',
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
});

// ---------- GET /api/doctors/:id/queue-today ----------
// Parity Express: doctorQueue.handler.ts getDoctorQueueToday (resolveDoctorRecordId).
// Auth: DOCTOR + ADMIN_BRANCH.
// SECURITY FIX (TD-2.4.26): Express mengizinkan cross-doctor read dalam 1 branch.
// Serverless: role DOCTOR dibatasi ke self — resolve :id harus == self doctor record.
// Note: resolve pakai 2 query parameterized (by user_id, fallback by id), TANPA .or()
// injection, konsisten precedent auth.ts.
router.all('/:id/queue-today', getOnly(async (req, res) => {
  const user = req.user;

  if (!['DOCTOR', 'ADMIN_BRANCH'].includes(user.role)) {
    return res.status(403).json({ success: false, message: 'Forbidden', error: 'FORBIDDEN' });
  }

  const doctorParam = req.params.id;
  if (!doctorParam) {
    return res.status(400).json({ success: false, message: 'Parameter id dokter wajib diisi', error: 'VALIDATION_ERROR' });
  }

  try {
    const supabase = getSupabase();

    // Resolve :id -> doctors.id (bisa user_id atau doctor record id), branch scope user.
    const { data: byUserId, error: e1 } = await supabase
      .from('doctors')
      .select('id, user_id')
      .eq('user_id', doctorParam)
      .eq('branch_id', user.branchId)
      .limit(1)
      .maybeSingle();
    if (e1) return res.status(500).json({ success: false, message: `Database error: ${e1.message}`, error: 'DB_ERROR' });

    let doctorRow = byUserId;
    if (!doctorRow) {
      const { data: byId, error: e2 } = await supabase
        .from('doctors')
        .select('id, user_id')
        .eq('id', doctorParam)
        .eq('branch_id', user.branchId)
        .limit(1)
        .maybeSingle();
      if (e2) return res.status(500).json({ success: false, message: `Database error: ${e2.message}`, error: 'DB_ERROR' });
      doctorRow = byId;
    }

    if (!doctorRow) {
      return res.status(404).json({ success: false, message: 'Dokter tidak ditemukan' });
    }

    if (user.role === 'DOCTOR') {
      const { data: selfRow, error: selfErr } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', user.userId)
        .eq('branch_id', user.branchId)
        .maybeSingle();
      if (selfErr) return res.status(500).json({ success: false, message: `Database error: ${selfErr.message}`, error: 'DB_ERROR' });
      if (doctorRow.id !== selfRow?.id) {
        return res.status(403).json({ success: false, message: 'Forbidden', error: 'FORBIDDEN' });
      }
    }

    const { data: rows, error: rpcErr } = await supabase.rpc('get_doctor_queue_today', {
      p_doctor_id: doctorRow.id,
      p_branch_id: user.branchId,
    });
    if (rpcErr) return res.status(500).json({ success: false, message: `RPC error: ${rpcErr.message}`, error: 'RPC_ERROR' });

    const data = ((rows || []) as any[]).map((row: any) => ({
      id: row.id,
      bookingId: row.booking_id,
      queueNumber: row.queue_number,
      patientId: row.patient_id,
      patientName: row.patient_name,
      checkInTime: row.check_in_time,
      status: row.status,
      isWalkIn: !!row.is_walk_in,
      waitTimeMinutes: Math.round(Number(row.wait_minutes)) || 0,
    }));

    const currentPatient =
      data.find((p) => p.status === 'IN_SERVICE') ||
      data.find((p) => p.status === 'BEING_CALLED') ||
      null;

    const nextPatients = data.filter((p) => p.status === 'WAITING').slice(0, 3);
    const waitingCount = data.filter((p) => p.status === 'WAITING').length;

    return res.status(200).json({
      success: true,
      data: { data, currentPatient, nextPatients, waitingCount },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return res.status(500).json({ success: false, message, error: 'INTERNAL_ERROR' });
  }
}));

// ---------- GET /api/doctors/:id ----------
// New (design): single doctor detail (Subset B1). Response explicit res.json tanpa
// timestamp (D6). isActive = users.is_active (D2). DOCTOR dibatasi self (TD-2.4.26),
// cross-branch / non-self → 404 (D1, no info leak).
router.get('/:id', async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user;
  const doctorId = req.params.id as string;

  try {
    requireRole(user, ['ADMIN_BRANCH', 'DOCTOR']);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 403) return fail(res, e.message || 'Forbidden', 403, 'FORBIDDEN');
    return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');
  }

  if (!isValidUuid(doctorId)) {
    return res.status(400).json({ success: false, message: 'Format id dokter tidak valid', error: 'VALIDATION_ERROR' });
  }

  try {
    // Branch scope wajib (D8). Role DOCTOR: .eq user_id -> self only (TD-2.4.26),
    // bukan self → row null → 404 (bukan 403, D1).
    let query = doctorDetailQuery(doctorId, user.branchId);
    if (user.role === 'DOCTOR') {
      query = query.eq('user_id', user.userId);
    }
    const { data: row, error: dbError } = await query.maybeSingle();
    if (dbError) return fail(res, `Database error: ${dbError.message}`, 500, 'DB_ERROR');
    if (!row) {
      return res.status(404).json({ success: false, message: 'Dokter tidak ditemukan', error: 'DOCTOR_NOT_FOUND' });
    }
    return res.status(200).json({ success: true, data: mapDoctorDetail(row) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
});

// ---------- PATCH /api/doctors/:id/status ----------
// New (design): toggle akun dokter (Subset B1). Field = users.is_active (D4),
// parity patients.ts P2 (soft-delete = is_active false). ADMIN_BRANCH only (D7).
router.patch('/:id/status', async (req: Request, res: Response) => {
  const user = (req as AuthedRequest).user;
  const doctorId = req.params.id as string;

  try {
    requireRole(user, ['ADMIN_BRANCH']);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 403) return fail(res, e.message || 'Forbidden', 403, 'FORBIDDEN');
    return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');
  }

  if (!isValidUuid(doctorId)) {
    return res.status(400).json({ success: false, message: 'Format id dokter tidak valid', error: 'VALIDATION_ERROR' });
  }

  const body = (req.body || {}) as { isActive?: unknown };
  if (typeof body.isActive !== 'boolean') {
    return res.status(400).json({ success: false, message: 'isActive wajib bertipe boolean', error: 'VALIDATION_ERROR' });
  }

  try {
    const supabase = getSupabase();

    // Branch scope (D8): resolve doctors.id -> user_id, cek branch user.
    const { data: doctorRow, error: doctorErr } = await supabase
      .from('doctors')
      .select('id, user_id, branch_id')
      .eq('id', doctorId)
      .eq('branch_id', user.branchId)
      .maybeSingle();
    if (doctorErr) return fail(res, `Database error: ${doctorErr.message}`, 500, 'DB_ERROR');
    if (!doctorRow) {
      return res.status(404).json({ success: false, message: 'Dokter tidak ditemukan', error: 'DOCTOR_NOT_FOUND' });
    }

    // Parity patients.ts P2: UPDATE users SET is_active=... + updated_at.
    const { error: updErr } = await supabase
      .from('users')
      .update({ is_active: body.isActive, updated_at: new Date().toISOString() })
      .eq('id', doctorRow.user_id);
    if (updErr) return fail(res, `Database error: ${updErr.message}`, 500, 'DB_ERROR');

    // Re-fetch detail terbaru (isActive = users.is_active).
    const { data: updated, error: refetchErr } = await doctorDetailQuery(doctorId, user.branchId).maybeSingle();
    if (refetchErr) return fail(res, `Database error: ${refetchErr.message}`, 500, 'DB_ERROR');

    return res.status(200).json({ success: true, data: mapDoctorDetail(updated) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
});

// ---------- 404 fallback domain doctors ----------
router.use((req: Request, res: Response) => {
  return fail(res, 'Route tidak ditemukan di domain doctors.', 404, 'NOT_FOUND');
});

// ============================================================
// Vercel handler: mount router di prefix '/api/doctors'
// ============================================================
const app = express();
app.use(express.json({ limit: '1mb' }));
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