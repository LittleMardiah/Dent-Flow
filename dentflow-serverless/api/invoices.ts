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
// Scope serverless: 5 endpoint:
//   GET  /api/invoices/summary  (revenue summary)
//   GET  /api/invoices          (list + filter)
//   PUT  /api/invoices/:id/mark-paid  (I3 — canonical state machine, ADMIN_BRANCH + DOCTOR)
//   GET  /api/invoices/:id      (detail + payment history)
//   POST /api/invoices/admin/:id/undo-payment  (soft undo, ADMIN_BRANCH only)
// Parity Express: dentflow-backend/src/routes/invoiceWeb.routes.ts
//                 dentflow-backend/src/handlers/invoiceWeb.handler.ts
//                 (getInvoiceSummary, getInvoiceList, getInvoiceDetail)
// Route order: /summary -> /admin/:id/undo-payment -> /:id (WAJIB, kalau kebalik "summary" match :id).
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

// SORT_MAP Express: { createdAt: 'i.created_at', amount: 'i.amount_due', dueDate: 'i.created_at' }
const SORT_MAP: Record<string, string> = {
  createdAt: 'created_at',
  amount: 'amount_due',
  dueDate: 'created_at',
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
    dueDate: row.created_at ? formatDateOnly(String(row.created_at)) : '',
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
        `id, invoice_number, patient_id, amount_due, status, created_at, paid_at, payment_method, payment_notes, patients:patient_id ( full_name )`,
        { count: 'exact' }
      )
      .eq('branch_id', branchId);

    if (status) {
      query = query.eq('status', status);
    }
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
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

// ---------- POST /api/invoices/admin/:id/undo-payment (soft undo) ----------
// Auth parity Express: ADMIN_BRANCH only.
// Soft approach: INSERT UNDO row ke invoice_payments (status='UNPAID', amount=0).
// TIDAK UPDATE invoices.status — trigger reversal tidak di-bypass.
router.all('/admin/:id/undo-payment', async (req: Request, res: Response) => {
  if (req.method !== 'POST') {
    return fail(res, 'Method not allowed', 405, 'METHOD_NOT_ALLOWED');
  }
  const authedReq = req as AuthedRequest;
  if (!authedReq.user || authedReq.user.role !== 'ADMIN_BRANCH') {
    return fail(res, 'Forbidden: ADMIN_BRANCH only', 403, 'FORBIDDEN');
  }

  const invoiceId = req.params.id;
  if (!invoiceId) return fail(res, 'Parameter id invoice wajib diisi', 400, 'VALIDATION_ERROR');

  const { reason } = (req.body || {}) as { reason?: string };
  if (!reason || !String(reason).trim()) {
    return fail(res, 'reason is required', 400, 'VALIDATION_ERROR');
  }

  try {
    const supabase = getSupabase();

    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('id, branch_id, status, amount_due')
      .eq('id', invoiceId)
      .maybeSingle();

    if (invErr) return fail(res, `Database error: ${invErr.message}`, 500, 'DB_ERROR');
    if (!invoice) return fail(res, 'Invoice tidak ditemukan', 404, 'INVOICE_NOT_FOUND');

    if (invoice.status !== 'PAID') {
      return fail(res, 'Invoice belum dibayar, tidak bisa undo payment', 400, 'INVOICE_NOT_PAID');
    }

    // Soft approach: INSERT UNDO row (status='UNPAID', amount=0).
    // Ini append-only audit trail — tidak UPDATE invoices.status.
    // Trigger prevent_invoice_payments_update hanya block UPDATE, INSERT OK.
    // UNIQUE(invoice_id, status, paid_at) tidak bentrok karena paid_at != paid_at baris PAID.
    const { error: insertErr } = await supabase
      .from('invoice_payments')
      .insert({
        invoice_id: invoiceId,
        status: 'UNPAID',
        amount: 0,
        payment_method: 'CASH',
        transaction_id: `UNDO:${String(reason).trim().substring(0, 100)}`,
      });

    if (insertErr) return fail(res, `Database error: ${insertErr.message}`, 500, 'DB_ERROR');

    // Re-fetch invoice + updated payment history
    const { data: updatedInvoice } = await supabase
      .from('invoices')
      .select('*, patients:patient_id ( full_name )')
      .eq('id', invoiceId)
      .maybeSingle();

    const { data: payments } = await supabase
      .from('invoice_payments')
      .select('id, amount, payment_method, paid_at, transaction_id, status')
      .eq('invoice_id', invoiceId)
      .order('paid_at', { ascending: true });

    const detail = updatedInvoice ? mapInvoice(updatedInvoice) : mapInvoice(invoice);
    detail.payments = (payments || []).map((row: any) => ({
      id: row.id,
      amount: Number(row.amount) || 0,
      method: row.payment_method,
      paidAt: row.paid_at,
      notes: null,
      adminName: 'Admin',
      status: row.status,
    }));

    res.status(200).json({
      success: true,
      data: detail,
      message: 'Payment undone (soft undo — invoice status unchanged)',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
});

// ---------- POST /api/admin/invoices/:id/mark-paid (I1 — admin mark-paid variant) ----------
// Rewrite: /api/admin/invoices/:path* -> /api/invoices?path=admin/$1
//   -> reconstruct: /api/invoices/admin/:id/mark-paid -> route POST /admin/:id/mark-paid.
// Parity Express: invoice.handler.markPaid -> InvoiceService.markPaid (invoice.service.ts).
//   Mount Express: /api/admin/invoices + roleMiddleware(['ADMIN_BRANCH']).
// Body: { payment_method (required), paid_amount (>0 required), notes? }.
// Idempotent: sudah PAID -> 200 + invoice (parity invoice.service.markPaid).
// Audit INVOICE_MARKED_PAID (old_values + new_values).
router.all('/admin/:id/mark-paid', async (req: Request, res: Response) => {
  if (req.method !== 'POST') {
    return fail(res, 'Method not allowed', 405, 'METHOD_NOT_ALLOWED');
  }
  const authedReq = req as AuthedRequest;
  const user = authedReq.user;
  if (!user || user.role !== 'ADMIN_BRANCH') {
    return fail(res, 'Forbidden: ADMIN_BRANCH only', 403, 'FORBIDDEN');
  }

  const invoiceId = req.params.id;
  if (!invoiceId) return fail(res, 'Parameter id invoice wajib diisi', 400, 'VALIDATION_ERROR');

  const { payment_method, paid_amount, notes } = (req.body || {}) as {
    payment_method?: string;
    paid_amount?: number;
    notes?: string;
  };

  if (!payment_method || !String(payment_method).trim()) {
    return fail(res, 'payment_method is required', 400, 'VALIDATION_ERROR');
  }

  const validMethods = ['CASH', 'TRANSFER', 'GATEWAY'];
  if (!validMethods.includes(String(payment_method).trim())) {
    return fail(res, 'Invalid payment_method. Must be CASH, TRANSFER, or GATEWAY', 400, 'VALIDATION_ERROR');
  }

  if (!paid_amount || Number(paid_amount) <= 0) {
    return fail(res, 'paid_amount must be > 0', 400, 'VALIDATION_ERROR');
  }

  try {
    const supabase = getSupabase();

    // 1. Load invoice (parity state machine: SELECT FOR UPDATE -> optimistic via status check)
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('id, branch_id, status, amount_due, payment_status, payment_method')
      .eq('id', invoiceId)
      .maybeSingle();

    if (invErr) return fail(res, `Database error: ${invErr.message}`, 500, 'DB_ERROR');
    if (!invoice) return fail(res, 'Invoice not found', 404, 'INVOICE_NOT_FOUND');

    // 2. Idempotent: sudah PAID -> return current (parity invoice.service.markPaid)
    if (invoice.status === 'PAID') {
      const { data: current } = await supabase
        .from('invoices')
        .select('*, patients:patient_id ( full_name )')
        .eq('id', invoiceId)
        .maybeSingle();
      return res.status(200).json({
        success: true,
        data: current || mapInvoice(invoice),
        message: 'Invoice already paid',
      });
    }

    // 3. Validate transition: only UNPAID/PARTIAL -> PAID (parity InvoiceStateValidator)
    const validFromStatuses = ['UNPAID', 'PARTIAL'];
    if (!validFromStatuses.includes(invoice.status)) {
      return fail(res, 'Invalid state transition', 409, 'INVALID_TRANSITION');
    }

    // 4. Update invoice (parity invoice.service.markPaid: paid_amount DIWAJIBKAN explicit)
    //    notes: parity Express service ignore (_notes not persisted).
    const paidAmount = Number(paid_amount);

    const { error: updateErr } = await supabase
      .from('invoices')
      .update({
        status: 'PAID',
        payment_status: 'PAID',
        paid_at: new Date().toISOString(),
        amount_paid: paidAmount,
        paid_amount: paidAmount,
        payment_method: String(payment_method).trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);

    if (updateErr) return fail(res, `Database error: ${updateErr.message}`, 500, 'DB_ERROR');

    // 5. Audit INVOICE_MARKED_PAID (parity auditService.logEvent: oldValues + newValues)
    const { error: auditErr } = await supabase.from('audit_logs').insert({
      branch_id: user.branchId,
      user_id: user.userId,
      event_type: 'INVOICE_MARKED_PAID',
      entity_type: 'INVOICE',
      entity_id: invoiceId,
      description: `Invoice ${invoiceId} marked as paid by admin ${user.userId}${notes ? ` (${notes})` : ''}`,
      old_values: {
        status: invoice.status,
        payment_status: invoice.payment_status,
      },
      new_values: {
        status: 'PAID',
        payment_status: 'PAID',
        payment_method: String(payment_method).trim(),
        paid_amount: paidAmount,
      },
    });
    if (auditErr) console.error('INVOICE_MARKED_PAID audit failed:', auditErr.message);

    // 6. Re-fetch invoice + payment history (trigger trg_log_invoice_payment auto-INSERT)
    const { data: updatedInvoice } = await supabase
      .from('invoices')
      .select('*, patients:patient_id ( full_name )')
      .eq('id', invoiceId)
      .maybeSingle();

    const { data: payments } = await supabase
      .from('invoice_payments')
      .select('id, amount, payment_method, paid_at, transaction_id, status')
      .eq('invoice_id', invoiceId)
      .order('paid_at', { ascending: true });

    const detail = mapInvoice(updatedInvoice || invoice);
    detail.payments = (payments || []).map((row: any) => ({
      id: row.id,
      amount: Number(row.amount) || 0,
      method: row.payment_method,
      paidAt: row.paid_at,
      notes: null,
      adminName: user.userId,
      status: row.status,
    }));

    res.status(200).json({
      success: true,
      data: detail,
      message: 'Invoice marked as paid',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
});

// ---------- PUT /api/invoices/:id/mark-paid (I3 — canonical state machine) ----------
// Parity Express: InvoicePaymentHandler.markPaid -> InvoicePaymentService.markInvoicePaid
//   -> InvoiceStateMachineService.transitionToPaid.
// Auth: ADMIN_BRANCH + DOCTOR (ALLOWED_ROLES at router level).
// Body: { payment_method (required), transaction_id? (optional), amount? (optional default amount_due) }.
// Idempotent: returns 200 + invoice data when already PAID.
// Trigger trg_log_invoice_payment auto-INSERT ke invoice_payments (append-only audit trail).
// CHECK valid_paid_state: PAID -> paid_at + paid_amount NOT NULL.
router.all('/:id/mark-paid', async (req: Request, res: Response) => {
  if (req.method !== 'PUT') {
    return fail(res, 'Method not allowed', 405, 'METHOD_NOT_ALLOWED');
  }
  const authedReq = req as AuthedRequest;
  const user = authedReq.user;

  const invoiceId = req.params.id;
  if (!invoiceId) return fail(res, 'Parameter id invoice wajib diisi', 400, 'VALIDATION_ERROR');

  const { payment_method, transaction_id, amount } = (req.body || {}) as {
    payment_method?: string;
    transaction_id?: string;
    amount?: number;
  };

  if (!payment_method || !String(payment_method).trim()) {
    return fail(res, 'payment_method is required', 400, 'VALIDATION_ERROR');
  }

  // Validate payment_method (parity CHECK constraint)
  const validMethods = ['CASH', 'TRANSFER', 'GATEWAY'];
  if (!validMethods.includes(String(payment_method).trim())) {
    return fail(res, 'Invalid payment_method. Must be CASH, TRANSFER, or GATEWAY', 400, 'VALIDATION_ERROR');
  }

  try {
    const supabase = getSupabase();

    // 1. Load invoice (parity state machine: get with lock via FOR UPDATE — Supabase RPC limitation:
    //    optimistic concurrency via status check is sufficient for Vercel serverless)
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('id, branch_id, status, amount_due, payment_status, payment_method')
      .eq('id', invoiceId)
      .maybeSingle();

    if (invErr) return fail(res, `Database error: ${invErr.message}`, 500, 'DB_ERROR');
    if (!invoice) return fail(res, 'Invoice not found', 404, 'INVOICE_NOT_FOUND');

    // 2. Idempotent: already PAID -> return current (parity Express transitionToPaid: return existing)
    if (invoice.status === 'PAID') {
      const { data: current } = await supabase
        .from('invoices')
        .select('*, patients:patient_id ( full_name )')
        .eq('id', invoiceId)
        .maybeSingle();
      return res.status(200).json({
        success: true,
        data: current || mapInvoice(invoice),
        message: 'Invoice already paid',
      });
    }

    // 3. Validate transition: only UNPAID/PARTIAL -> PAID (parity InvoiceStateValidator)
    const validFromStatuses = ['UNPAID', 'PARTIAL'];
    if (!validFromStatuses.includes(invoice.status)) {
      return fail(res, 'Invalid state transition', 409, 'INVALID_TRANSITION');
    }

    // 4. Update invoice (parity state machine: SET status=PAID, payment_status=PAID,
    //    paid_at=NOW(), amount_paid=..., paid_amount=..., payment_method=..., updated_at=NOW())
    //    NOTE: invoices TIDAK punya kolom transaction_id (trigger trg_log_invoice_payment
    //    insert NULL ke invoice_payments.transaction_id). transaction_id dari body hanya
    //    dipakai di audit description (parity Express InvoiceStateMachineService).
    const paidAmount = amount || invoice.amount_due;
    const txnId = transaction_id || `manual-${Date.now()}`;

    const { error: updateErr } = await supabase
      .from('invoices')
      .update({
        status: 'PAID',
        payment_status: 'PAID',
        paid_at: new Date().toISOString(),
        amount_paid: paidAmount,
        paid_amount: paidAmount,
        payment_method: String(payment_method).trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);

    if (updateErr) return fail(res, `Database error: ${updateErr.message}`, 500, 'DB_ERROR');

    // 5. Audit INVOICE_MARKED_PAID (parity auditService.logEvent)
    const { error: auditErr } = await supabase.from('audit_logs').insert({
      branch_id: user.branchId,
      user_id: user.userId,
      event_type: 'INVOICE_MARKED_PAID',
      entity_type: 'INVOICE',
      entity_id: invoiceId,
      description: `Invoice ${invoiceId} marked as PAID via ${String(payment_method).trim()}${transaction_id ? ` (txn: ${transaction_id})` : ''}`,
      old_values: {
        status: invoice.status,
        payment_status: invoice.payment_status,
      },
      new_values: {
        status: 'PAID',
        payment_status: 'PAID',
        payment_method: String(payment_method).trim(),
        paid_amount: paidAmount,
      },
    });
    if (auditErr) console.error('INVOICE_MARKED_PAID audit failed:', auditErr.message);

    // 6. Re-fetch invoice for response (trigger trg_log_invoice_payment auto-INSERT payment history)
    const { data: updatedInvoice } = await supabase
      .from('invoices')
      .select('*, patients:patient_id ( full_name )')
      .eq('id', invoiceId)
      .maybeSingle();

    const { data: payments } = await supabase
      .from('invoice_payments')
      .select('id, amount, payment_method, paid_at, transaction_id, status')
      .eq('invoice_id', invoiceId)
      .order('paid_at', { ascending: true });

    const detail = mapInvoice(updatedInvoice || invoice);
    detail.payments = (payments || []).map((row: any) => ({
      id: row.id,
      amount: Number(row.amount) || 0,
      method: row.payment_method,
      paidAt: row.paid_at,
      notes: null,
      adminName: user.userId,
      status: row.status,
    }));

    res.status(200).json({
      success: true,
      data: detail,
      message: 'Invoice marked as paid',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return fail(res, message, 500, 'INTERNAL_ERROR');
  }
});

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
      .select('id, amount, payment_method, paid_at, transaction_id, status')
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
      status: row.status,
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