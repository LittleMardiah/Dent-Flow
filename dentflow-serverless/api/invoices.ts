import type { VercelRequest, VercelResponse } from '@vercel/node';
import express, { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { getSupabase } from '../lib/supabase';
import { extractBearerToken, verifyJwt, requireRole, AuthUser } from '../lib/auth';

// ============================================================
// Consolidated /api/invoices — READ ONLY (Batch 3)
// - Approach B: vercel.json rewrites /api/invoices/:path* -> /api/invoices?path=$1
// - Approach C: Express router di-mount prefix '/api/invoices'
//   (Vercel kirim FULL URL ke lambda, terbukti di task 2.3.2c)
// Scope serverless saat ini: 3 endpoint GET:
//   GET /api/invoices/summary  (revenue summary)
//   GET /api/invoices          (list + filter)
//   GET /api/invoices/:id      (detail + payment history)
// Parity Express: dentflow-backend/src/routes/invoiceWeb.routes.ts
//                 dentflow-backend/src/handlers/invoiceWeb.handler.ts
//                 (getInvoiceSummary, getInvoiceList, getInvoiceDetail)
// Route order: /summary SEBELUM /:id (WAJIB, kalau kebalik "summary" match :id).
// Write endpoint (POST /:id/payments) SKIP -> Batch 4.
// ============================================================

// Auth parity Express: router.use(authMiddleware, roleMiddleware(['ADMIN_BRANCH', 'DOCTOR']))
const ALLOWED_ROLES = ['ADMIN_BRANCH', 'DOCTOR'];

// Response helpers — shape IDENTIK dengan lib/response (success/error).
// Success manual tanpa `timestamp` (parity Express invoiceWeb.handler.ts);
// error pakai fail (parity lib/response + pola encounters.ts).
const fail = (res: Response, message: string, status = 400, code = 'ERROR') =>
  res.status(status).json({ success: false, error: code, message, timestamp: new Date().toISOString() });

interface AuthedRequest extends Request {
  user: AuthUser;
}

const router: Router = express.Router();

// ---------- Auth + env guard (level router, parity invoiceWeb.routes.ts) ----------
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

// ---------- Helpers (parity invoiceWeb.handler.ts) ----------

// SORT_MAP Express: { createdAt: 'i.created_at', amount: 'i.amount_due', dueDate: 'i.invoice_date' }
const SORT_MAP: Record<string, string> = {
  createdAt: 'created_at',
  amount: 'amount_due',
  dueDate: 'invoice_date',
};

function formatDateOnly(d: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mapInvoice(row: any): any {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    patientId: row.patient_id,
    patientName: row.patients?.full_name || row.patient_name || '',
    amount: Number(row.amount_due) || 0,
    status: row.status,
    dueDate: row.invoice_date ? formatDateOnly(String(row.invoice_date)) : '',
    createdAt: row.created_at,
    paidAt: row.paid_at || null,
    paymentMethod: row.payment_method || null,
    notes: row.payment_notes || null,
    items: [] as any[],
    payments: [] as any[],
  };
}

// ---------- GET /api/invoices/summary ----------
router.all('/summary', getOnly(async (req, res) => {
  const branchId = (req.query.branchId as string) || '';
  if (!branchId) {
    return fail(res, 'branchId is required', 400, 'VALIDATION_ERROR');
  }

  try {
    const supabase = getSupabase();

    // Parity SQL Express (agregasi di JS karena PostgREST tidak support CASE-WHEN):
    //   today        = status PAID & paid_at::date = CURRENT_DATE
    //   this_month   = status PAID & paid_at >= date_trunc('month')
    //   year_to_date = status PAID & paid_at >= date_trunc('year')
    //   outstanding  = status IN (UNPAID, PARTIAL, OVERDUE) -> SUM(amount_due)
    //   paid/unpaid  = COUNT(*) FILTER ...
    const { data, error: dbErr } = await supabase
      .from('invoices')
      .select('status, paid_at, paid_amount, amount_due')
      .eq('branch_id', branchId)
      .limit(100000);

    if (dbErr) return fail(res, `Database error: ${dbErr.message}`, 500, 'DB_ERROR');

    const rows = data || [];
    const now = new Date();
    const todayStr = formatDateOnly(now.toISOString());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const yearStart = new Date(now.getFullYear(), 0, 1).getTime();

    let today = 0;
    let thisMonth = 0;
    let yearToDate = 0;
    let outstanding = 0;
    let totalInvoices = 0;
    let paidCount = 0;
    let unpaidCount = 0;

    for (const row of rows) {
      const status = row.status || '';
      totalInvoices += 1;

      if (status === 'PAID') {
        paidCount += 1;
        const amount = Number(row.paid_amount) || Number(row.amount_due) || 0;
        if (row.paid_at) {
          const paidAt = new Date(row.paid_at).getTime();
          if (!isNaN(paidAt)) {
            if (formatDateOnly(String(row.paid_at)) === todayStr) today += amount;
            if (paidAt >= monthStart) thisMonth += amount;
            if (paidAt >= yearStart) yearToDate += amount;
          }
        }
      }

      if (['UNPAID', 'PARTIAL', 'OVERDUE'].includes(status)) {
        unpaidCount += 1;
        outstanding += Number(row.amount_due) || 0;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        today,
        thisMonth,
        yearToDate,
        outstanding,
        totalInvoices,
        paidCount,
        unpaidCount,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- GET /api/invoices (list + filter) ----------
router.all('/', getOnly(async (req, res) => {
  const branchId = (req.query.branchId as string) || '';
  if (!branchId) {
    return fail(res, 'branchId is required', 400, 'VALIDATION_ERROR');
  }

  const status = (req.query.status as string) || '';
  const dateFrom = (req.query.dateFrom as string) || '';
  const dateTo = (req.query.dateTo as string) || '';
  const sortBy = SORT_MAP[(req.query.sortBy as string) || 'createdAt'] || 'created_at';
  const ascending = ((req.query.sortOrder as string) || 'desc').toLowerCase() === 'asc';
  const page = parseInt((req.query.page as string) || '1', 10) || 1;
  const limit = parseInt((req.query.limit as string) || '20', 10) || 20;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  try {
    const supabase = getSupabase();

    let query = supabase
      .from('invoices')
      .select(
        `id, invoice_number, patient_id, amount_due, status, invoice_date, created_at, paid_at, payment_method, payment_notes, patients:patient_id ( full_name )`,
        { count: 'exact' }
      )
      .eq('branch_id', branchId);

    if (status) {
      query = query.eq('status', status);
    }
    if (dateFrom) {
      query = query.gte('invoice_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('invoice_date', dateTo);
    }

    query = query.order(sortBy, { ascending }).range(from, to);

    const { data, error: dbErr, count } = await query;
    if (dbErr) return fail(res, `Database error: ${dbErr.message}`, 500, 'DB_ERROR');

    const total = count || 0;
    const items = (data || []).map(mapInvoice);

    res.status(200).json({
      success: true,
      data: {
        data: items,
        total,
        page,
        totalPages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- GET /api/invoices/:id (detail) ----------
router.all('/:id', getOnly(async (req, res) => {
  const invoiceId = req.params.id;
  if (!invoiceId) return fail(res, 'Parameter id invoice wajib diisi', 400, 'VALIDATION_ERROR');

  try {
    const supabase = getSupabase();

    // Parity Express loadInvoiceDetail: SELECT i.*, p.full_name as patient_name
    const { data: invoice, error: dbErr } = await supabase
      .from('invoices')
      .select('*, patients:patient_id ( full_name )')
      .eq('id', invoiceId)
      .maybeSingle();

    if (dbErr) return fail(res, `Database error: ${dbErr.message}`, 500, 'DB_ERROR');
    if (!invoice) return fail(res, 'Invoice tidak ditemukan', 404, 'INVOICE_NOT_FOUND');

    // Parity Express: SELECT ip.id, ip.amount, ip.payment_method, ip.paid_at,
    //                 ip.transaction_id, u.username as admin_name
    //                 WHERE ip.invoice_id = $1 ORDER BY ip.paid_at ASC
    // Deviasi: tabel invoice_payments tidak punya kolom created_by (cek migrasi 005),
    // jadi join ke users di-omit; adminName fallback default 'Admin' (parity Express fallback).
    const { data: payments, error: payErr } = await supabase
      .from('invoice_payments')
      .select('id, amount, payment_method, paid_at, transaction_id')
      .eq('invoice_id', invoiceId)
      .order('paid_at', { ascending: true });

    if (payErr) return fail(res, `Database error: ${payErr.message}`, 500, 'DB_ERROR');

    const detail = mapInvoice(invoice);
    detail.payments = (payments || []).map((row: any) => ({
      id: row.id,
      amount: Number(row.amount) || 0,
      method: row.payment_method,
      paidAt: row.paid_at,
      notes: null,
      adminName: 'Admin',
    }));

    res.status(200).json({ success: true, data: detail });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
}));

// ---------- 404 fallback domain invoices ----------
router.use((req: Request, res: Response) => {
  return fail(res, 'Route tidak ditemukan di domain invoices.', 404, 'NOT_FOUND');
});

// ============================================================
// Vercel handler: mount router di prefix '/api/invoices'
// ============================================================
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api/invoices', router);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel kirim FULL URL ke lambda (terbukti di 2.3.2c), jadi Express mount
  // prefix '/api/invoices' match semua sub-path. Safeguard: kalau runtime strip
  // URL jadi destination saja (/api/invoices) dan suffix masuk ?path=, rekonstruksi.
  const r = req as any;
  const captured = r.query && r.query.path ? r.query.path : undefined;
  if (captured) {
    const suffix = Array.isArray(captured) ? captured[0] : String(captured);
    const url = String(r.url || '');
    if (suffix && !url.includes(`/${suffix}`)) {
      r.url = `/api/invoices/${suffix}`;
    }
  }
  return app(r, res as any);
}