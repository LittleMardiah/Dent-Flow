import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../../lib/supabase';
import { success, error } from '../../lib/response';
import { extractBearerToken, verifyJwt, requireRole } from '../../lib/auth';

const ALLOWED_ROLES = ['ADMIN_BRANCH', 'DOCTOR'];

/**
 * GET /api/patients/branches
 * Daftar branch yang bisa diakses user (own branch + grant user_branch_access),
 * hanya yang is_active = true, diurutkan by name.
 * Parity Express: dentflow-backend/src/handlers/patient.handler.ts -> listAccessibleBranches
 * Response: { success, data: [{ id, name }, ...] }
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

  const authHeader = req.headers['authorization'];
  const token = extractBearerToken(typeof authHeader === 'string' ? authHeader : undefined);
  if (!token) return error(res, 'Unauthorized', 401, 'UNAUTHORIZED');

  let user;
  try {
    user = verifyJwt(token);
    requireRole(user, ALLOWED_ROLES);
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode === 403) return error(res, e.message || 'Forbidden', 403, 'FORBIDDEN');
    return error(res, 'Unauthorized', 401, 'UNAUTHORIZED');
  }

  try {
    const supabase = getSupabase();

    // Express: SELECT DISTINCT b.id, b.name FROM branches b
    //          WHERE b.is_active = true
    //            AND (b.id = own OR b.id IN (SELECT branch_id FROM user_branch_access WHERE user_id = X))
    //          ORDER BY b.name
    // Cross-table OR tidak didukung PostgREST -> dua query, digabung di JS.
    const { data: branchRows, error: eb } = await supabase
      .from('branches')
      .select('id, name')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (eb) return error(res, `Database error: ${eb.message}`, 500, 'DB_ERROR');

    const { data: grants, error: eg } = await supabase
      .from('user_branch_access')
      .select('branch_id')
      .eq('user_id', user.userId);
    if (eg) return error(res, `Database error: ${eg.message}`, 500, 'DB_ERROR');

    const accessibleIds = new Set<string>([
      user.branchId,
      ...(grants || []).map((g: any) => g.branch_id as string),
    ]);
    const branches = (branchRows || []).filter((b: any) => accessibleIds.has(b.id));

    return success(res, branches);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return error(res, message, 500, 'INTERNAL_ERROR');
  }
}