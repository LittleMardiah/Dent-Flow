import { Request, Response } from 'express';

import { logger } from '../utils/logger';
import { invoiceStateMachineService } from '../services/invoiceStateMachine.service';
import { getErrorMessage, getErrorStack } from '../utils/error.util';
import { pool } from '../config/database';


const SORT_MAP: Record<string, string> = {
  createdAt: 'i.created_at',
  amount: 'i.amount_due',
  dueDate: 'i.created_at',
};

function formatDateOnly(d: any): string {
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mapInvoice(row: any) {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    patientId: row.patient_id,
    patientName: row.patient_name,
    amount: Number(row.amount_due) || 0,
    status: row.status,
    dueDate: row.created_at ? formatDateOnly(row.created_at) : '',
    createdAt: row.created_at,
    paidAt: row.paid_at,
    paymentMethod: row.payment_method,
    notes: row.notes || row.payment_notes || null,
    items: [] as any[],
    payments: [] as any[],
  };
}

async function loadInvoiceDetail(invoiceId: string): Promise<any> {
  const invoiceResult = await pool.query(
    `SELECT i.*, p.full_name as patient_name
     FROM invoices i
     JOIN patients p ON i.patient_id = p.id
     WHERE i.id = $1`,
    [invoiceId]
  );
  if (invoiceResult.rows.length === 0) {
    throw new Error('INVOICE_NOT_FOUND');
  }
  const invoice = mapInvoice(invoiceResult.rows[0]);

  const paymentsResult = await pool.query(
    `SELECT ip.id, ip.amount, ip.payment_method, ip.paid_at, ip.transaction_id,
            u.username as admin_name
     FROM invoice_payments ip
     LEFT JOIN users u ON u.id = ip.created_by
     WHERE ip.invoice_id = $1
     ORDER BY ip.paid_at ASC`,
    [invoiceId]
  );

  invoice.payments = paymentsResult.rows.map((row) => ({
    id: row.id,
    amount: Number(row.amount) || 0,
    method: row.payment_method,
    paidAt: row.paid_at,
    notes: null,
    adminName: row.admin_name || 'Admin',
  }));

  invoice.items = [];
  return invoice;
}

/**
 * GET /api/invoices/summary?branchId=...
 * Revenue summary for finance dashboard.
 * Response: { success, data: RevenueSummary }
 */
export const getInvoiceSummary = async (req: Request, res: Response) => {
  try {
    const branchId = (req.query.branchId as string) || '';
    if (!branchId) {
      return res.status(400).json({ success: false, message: 'branchId is required' });
    }

    const result = await pool.query(
      `SELECT
        COALESCE(SUM(CASE WHEN status = 'PAID' AND paid_at::date = CURRENT_DATE THEN COALESCE(paid_amount, amount_due) ELSE 0 END), 0) as today,
        COALESCE(SUM(CASE WHEN status = 'PAID' AND paid_at >= date_trunc('month', CURRENT_DATE) THEN COALESCE(paid_amount, amount_due) ELSE 0 END), 0) as this_month,
        COALESCE(SUM(CASE WHEN status = 'PAID' AND paid_at >= date_trunc('year', CURRENT_DATE) THEN COALESCE(paid_amount, amount_due) ELSE 0 END), 0) as year_to_date,
        COALESCE(SUM(CASE WHEN status IN ('UNPAID', 'PARTIAL', 'OVERDUE') THEN amount_due ELSE 0 END), 0) as outstanding,
        COUNT(*) as total_invoices,
        COUNT(*) FILTER (WHERE status = 'PAID') as paid_count,
        COUNT(*) FILTER (WHERE status IN ('UNPAID', 'PARTIAL', 'OVERDUE')) as unpaid_count
       FROM invoices
       WHERE branch_id = $1`,
      [branchId]
    );

    const row = result.rows[0];
    res.status(200).json({
      success: true,
      data: {
        today: Number(row.today) || 0,
        thisMonth: Number(row.this_month) || 0,
        yearToDate: Number(row.year_to_date) || 0,
        outstanding: Number(row.outstanding) || 0,
        totalInvoices: parseInt(row.total_invoices) || 0,
        paidCount: parseInt(row.paid_count) || 0,
        unpaidCount: parseInt(row.unpaid_count) || 0,
      },
    });
  } catch (error: unknown) {
    logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) }, 'Invoice summary error');
    res.status(500).json({ success: false, message: getErrorMessage(error) || 'Internal server error' });
  }
};

/**
 * GET /api/invoices?branchId=&status=&dateFrom=&dateTo=&sortBy=&sortOrder=&page=&limit=
 * Paginated invoice list for finance page.
 * Response: { success, data: { data, total, page, totalPages } }
 */
export const getInvoiceList = async (req: Request, res: Response) => {
  try {
    const branchId = (req.query.branchId as string) || '';
    if (!branchId) {
      return res.status(400).json({ success: false, message: 'branchId is required' });
    }

    const status = (req.query.status as string) || '';
    const dateFrom = (req.query.dateFrom as string) || '';
    const dateTo = (req.query.dateTo as string) || '';
    const sortBy = SORT_MAP[(req.query.sortBy as string) || 'createdAt'] || 'i.created_at';
    const sortOrder = (req.query.sortOrder as string || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const page = parseInt((req.query.page as string) || '1') || 1;
    const limit = parseInt((req.query.limit as string) || '20') || 20;
    const offset = (page - 1) * limit;

    const whereClauses: string[] = ['i.branch_id = $1'];
    const params: any[] = [branchId];

    if (status) {
      whereClauses.push(`i.status = $${params.length + 1}`);
      params.push(status);
    }
    if (dateFrom) {
      whereClauses.push(`i.created_at >= $${params.length + 1}`);
      params.push(dateFrom);
    }
    if (dateTo) {
      whereClauses.push(`i.created_at <= $${params.length + 1}`);
      params.push(dateTo);
    }

    const whereSql = whereClauses.join(' AND ');

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM invoices i WHERE ${whereSql}`,
      params
    );
    const total = parseInt(countResult.rows[0].total) || 0;

    const listResult = await pool.query(
      `SELECT i.*, p.full_name as patient_name
       FROM invoices i
       JOIN patients p ON i.patient_id = p.id
       WHERE ${whereSql}
       ORDER BY ${sortBy} ${sortOrder}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const data = listResult.rows.map(mapInvoice);

    res.status(200).json({
      success: true,
      data: {
        data,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) }, 'Invoice list error');
    res.status(500).json({ success: false, message: getErrorMessage(error) || 'Internal server error' });
  }
};

/**
 * GET /api/invoices/:id
 * Invoice detail with items & payment history.
 * Response: { success, data: Invoice }
 */
export const getInvoiceDetail = async (req: Request, res: Response) => {
  try {
    const invoiceId = String(req.params.id);
    const detail = await loadInvoiceDetail(invoiceId);
    res.status(200).json({ success: true, data: detail });
  } catch (error: unknown) {
    logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) }, 'Invoice detail error');
    if ((error as Error).message === 'INVOICE_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
    }
    res.status(500).json({ success: false, message: getErrorMessage(error) || 'Internal server error' });
  }
};

/**
 * POST /api/invoices/:id/payments
 * Manual payment entry by admin.
 * Body: { amount, method: CASH|TRANSFER, notes? }
 * Response: { success, data: Invoice }
 */
export const addInvoicePayment = async (req: Request, res: Response) => {
  try {
    const invoiceId = String(req.params.id);
    const adminId = req.user?.userId;
    const branchId = req.user?.branchId;

    const amount = Number(req.body?.amount);
    const method = String(req.body?.method || 'CASH').toUpperCase();
    const notes = req.body?.notes;

    if (!adminId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Nominal harus lebih dari 0' });
    }
    if (!['CASH', 'TRANSFER', 'GATEWAY'].includes(method)) {
      return res.status(400).json({ success: false, message: 'Metode pembayaran tidak valid' });
    }

    const invoiceResult = await pool.query(
      'SELECT id, branch_id, amount_due, status FROM invoices WHERE id = $1',
      [invoiceId]
    );
    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
    }
    const invoice = invoiceResult.rows[0];

    if (Number(invoice.amount_due) < Number(amount)) {
      return res.status(400).json({ success: false, message: 'Nominal melebihi total invoice' });
    }

    await invoiceStateMachineService.transitionToPaid({
      invoiceId,
      paymentMethod: method,
      amount,
      branchId: branchId || invoice.branch_id,
      userId: adminId,
      transactionId: `ADMIN-${Date.now()}`,
      notes,
    });

    await pool.query(
      'UPDATE invoices SET paid_by_admin_id = $1 WHERE id = $2',
      [adminId, invoiceId]
    );

    const detail = await loadInvoiceDetail(invoiceId);
    res.status(200).json({
      success: true,
      data: detail,
      message: 'Pembayaran berhasil dicatat',
    });
  } catch (error: unknown) {
    logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) }, 'Invoice payment error');
    res.status(500).json({ success: false, message: getErrorMessage(error) || 'Internal server error' });
  }
};