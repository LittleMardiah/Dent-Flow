import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../lib/supabase';
import { success, error } from '../lib/response';
import { extractBearerToken, verifyJwt, requireRole, unauthorized } from '../lib/auth';

const ALLOWED_ROLES = ['ADMIN_BRANCH', 'PATIENT', 'DOCTOR'];

/**
 * GET /api/doctors?branchId=...
 * List dokter (read-only). Auth + role: ADMIN_BRANCH, PATIENT, DOCTOR.
 * Contract mengikuti Express: dentflow-backend/src/handlers/doctorsList.handler.ts
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return error(res, 'Method not allowed', 405, 'METHOD_NOT_ALLOWED');
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return error(res, 'ENV_MISSING: SUPABASE_* belum di-set di Vercel.', 500, 'ENV_MISSING');
  }
  if (!process.env.JWT_SECRET) {
    return error(res, 'ENV_MISSING: JWT_SECRET belum di-set di Vercel.', 500, 'ENV_MISSING');
  }

  // Auth
  const authHeader = req.headers['authorization'];
  const token = extractBearerToken(typeof authHeader === 'string' ? authHeader : undefined);
  if (!token) {
    return error(res, 'Unauthorized', 401, 'UNAUTHORIZED');
  }

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

  try {
    const supabase = getSupabase();

    // branchId: query param (admin/doctor) atau branch user sendiri (fallback)
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

    if (dbError) {
      return error(res, `Database error: ${dbError.message}`, 500, 'DB_ERROR');
    }

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

    return success(res, {
      count: doctors.length,
      doctors,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return error(res, message, 500, 'INTERNAL_ERROR');
  }
}