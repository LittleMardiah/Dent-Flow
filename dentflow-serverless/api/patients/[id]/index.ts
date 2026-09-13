import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../../../lib/supabase';
import { success, error } from '../../../lib/response';
import { extractBearerToken, verifyJwt, requireRole, enforceTenant } from '../../../lib/auth';

const ALLOWED_ROLES = ['ADMIN_BRANCH', 'DOCTOR'];

/**
 * GET /api/patients/:id
 * Detail pasien + bookings + encounters + invoices (scoped branch efektif).
 * Parity Express: dentflow-backend/src/handlers/patient.handler.ts -> getPatientDetail.
 * Effective branch: ?branchId= (harus punya grant) atau user.branchId (getEffectiveBranch).
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

    // Patient + email user (parity query utama Express).
    const { data: patient, error: e1 } = await supabase
      .from('patients')
      .select(`id, user_id, full_name, phone, branch_id, created_at, updated_at, users:user_id ( email )`)
      .eq('id', patientId)
      .eq('branch_id', branchId)
      .is('deleted_at', null)
      .maybeSingle();
    if (e1) return error(res, `Database error: ${e1.message}`, 500, 'DB_ERROR');
    if (!patient) return error(res, 'Pasien tidak ditemukan', 404, 'PATIENT_NOT_FOUND');

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
    if (bookingsRes.error) return error(res, `Database error: ${bookingsRes.error.message}`, 500, 'DB_ERROR');
    if (encountersRes.error) return error(res, `Database error: ${encountersRes.error.message}`, 500, 'DB_ERROR');
    if (invoicesRes.error) return error(res, `Database error: ${invoicesRes.error.message}`, 500, 'DB_ERROR');

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

    return success(res, {
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
    return error(res, message, 500, 'INTERNAL_ERROR');
  }
}