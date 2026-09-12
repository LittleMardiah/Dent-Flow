import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../../../lib/supabase';
import { success, error } from '../../../lib/response';
import { extractBearerToken, verifyJwt, requireRole } from '../../../lib/auth';

const ALLOWED_ROLES = ['DOCTOR', 'ADMIN_BRANCH'];

/**
 * GET /api/doctors/:id/patients
 * List pasien yang pernah di-handle dokter (berbasis encounters).
 * Role: DOCTOR, ADMIN_BRANCH.
 * Contract mengikuti Express: dentflow-backend/src/handlers/doctorProfile.handler.ts
 * -> response data = array pasien (bukan wrapper {count, patients}).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return error(res, 'Method not allowed', 405, 'METHOD_NOT_ALLOWED');
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return error(res, 'ENV_MISSING: SUPABASE_* belum di-set.', 500, 'ENV_MISSING');
  }
  if (!process.env.JWT_SECRET) {
    return error(res, 'ENV_MISSING: JWT_SECRET belum di-set.', 500, 'ENV_MISSING');
  }

  // Auth
  const authHeader = req.headers['authorization'];
  const token = extractBearerToken(typeof authHeader === 'string' ? authHeader : undefined);
  if (!token) return error(res, 'Unauthorized', 401, 'UNAUTHORIZED');

  let user;
  try {
    user = verifyJwt(token);
    requireRole(user, ALLOWED_ROLES);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 403) {
      return error(res, e.message || 'Forbidden', 403, 'FORBIDDEN');
    }
    return error(res, 'Unauthorized', 401, 'UNAUTHORIZED');
  }

  // Path param :id
  const rawId = req.query.id;
  const doctorId = typeof rawId === 'string' && rawId.length > 0
    ? rawId
    : Array.isArray(rawId) ? rawId[0] : '';

  if (!doctorId) {
    return error(res, 'Parameter id dokter wajib diisi', 400, 'VALIDATION_ERROR');
  }

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

    if (doctorErr) {
      return error(res, `Database error: ${doctorErr.message}`, 500, 'DB_ERROR');
    }
    if (!doctorRow) {
      return error(res, 'Dokter tidak ditemukan di branch ini', 404, 'DOCTOR_NOT_FOUND');
    }

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

    if (dbError) {
      return error(res, `Database error: ${dbError.message}`, 500, 'DB_ERROR');
    }

    // Aggregate per patient: total visits + last visit
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

    return success(res, patients);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return error(res, message, 500, 'INTERNAL_ERROR');
  }
}