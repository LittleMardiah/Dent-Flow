import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../lib/supabase';
import { success, error } from '../lib/response';
import { extractBearerToken, verifyJwt, requireRole } from '../lib/auth';

const ALLOWED_ROLES = ['ADMIN_BRANCH', 'DOCTOR'];

/**
 * GET /api/patients?search=&page=&limit=
 * List pasien (scoped ke branch user).
 * Parity Express: dentflow-backend/src/handlers/patient.handler.ts -> listPatients
 * Response shape Express: { success, data: { data, total, page, totalPages } }
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

  try {
    const supabase = getSupabase();

    let query = supabase
      .from('patients')
      .select(
        `
        id,
        branch_id,
        user_id,
        full_name,
        phone,
        created_at,
        updated_at,
        users:user_id ( email )
      `,
        { count: 'exact' }
      )
      .eq('branch_id', user.branchId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.or(
        `full_name.ilike.${likePattern},phone.ilike.${likePattern}`
      );
    }

    const { data, error: dbErr, count } = await query;
    if (dbErr) return error(res, `Database error: ${dbErr.message}`, 500, 'DB_ERROR');

    const rows = data || [];
    const patientIds = rows.map((p: any) => p.id);

    // totalBookings + lastVisit (parity subquery Express)
    let bookingsCount: Record<string, number> = {};
    let lastVisits: Record<string, string> = {};
    if (patientIds.length > 0) {
      const bookings = await supabase
        .from('bookings')
        .select('patient_id')
        .in('patient_id', patientIds);
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

    return success(res, {
      data: patients,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 0,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return error(res, message, 500, 'INTERNAL_ERROR');
  }
}