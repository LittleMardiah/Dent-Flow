import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../../../lib/supabase';
import { success, error } from '../../../lib/response';
import { extractBearerToken, verifyJwt, requireRole, enforceTenant } from '../../../lib/auth';

const ALLOWED_ROLES = ['ADMIN_BRANCH', 'DOCTOR'];

/**
 * GET /api/patients/:id/audit-trail
 * Riwayat audit pasien (scoped branch efektif + join actor username).
 * Parity Express: dentflow-backend/src/handlers/patient.handler.ts -> getPatientAuditTrail.
 * Response: { success, data: [{ id, eventType, description, createdAt, actorName }, ...] }
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

  const rawId = req.query.id;
  const patientId = typeof rawId === 'string' && rawId.length > 0
    ? rawId
    : Array.isArray(rawId) ? rawId[0] : '';

  if (!patientId) return error(res, 'Parameter id pasien wajib diisi', 400, 'VALIDATION_ERROR');

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
      if (e.statusCode === 403) return error(res, e.message || 'Forbidden', 403, 'FORBIDDEN');
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
    if (!patient) return error(res, 'Pasien tidak ditemukan', 404, 'PATIENT_NOT_FOUND');

    // Express: WHERE al.entity_id = $1 AND al.branch_id = $2 ORDER BY al.created_at DESC
    // (tidak filter entity_type; join actors untuk username).
    const { data, error: e1 } = await supabase
      .from('audit_logs')
      .select('id, event_type, description, created_at, users:user_id ( username )')
      .eq('entity_id', patientId)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });
    if (e1) return error(res, `Database error: ${e1.message}`, 500, 'DB_ERROR');

    const logs = (data || []).map((l: any) => ({
      id: l.id,
      eventType: l.event_type,
      description: l.description || '',
      createdAt: l.created_at,
      actorName: l.users?.username || 'System',
    }));

    return success(res, logs);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return error(res, message, 500, 'INTERNAL_ERROR');
  }
}