import { getErrorMessage, getErrorStack } from "../utils/error.util";
import { Pool } from 'pg';

import { logger } from '../utils/logger';
import { InvoicePaymentService } from './invoicePayment.service';
import { pool } from '../config/database';

export class PaymentInputService {
  private pool: Pool;
  private invoicePaymentService: InvoicePaymentService;

  constructor() {
    this.pool = pool;
    this.invoicePaymentService = new InvoicePaymentService();
  }

  /**
   * Parse order_id format: INV-{branch_id}-{YYYYMMDD}-{SEQ}
   * Returns { branchId, dateStr, seq }
   */
  parseOrderId(orderId: string): { branchId: string; dateStr: string; seq: string } | null {
    const parts = orderId.split('-');
    if (parts.length !== 4 || parts[0] !== 'INV') {
      return null;
    }
    // Branch ID bisa memiliki hyphens, jadi kita gabungkan bagian 1 sampai length-2
    // INV-{uuid}-{date}-{seq}
    // Example: INV-494a607c-d109-4330-a3a9-68f54326f0c7-20260722-001
    // parts[0] = 'INV'
    // parts[1] = '494a607c'
    // parts[2] = 'd109'
    // parts[3] = '4330'
    // parts[4] = 'a3a9'
    // parts[5] = '68f54326f0c7'
    // parts[6] = '20260722'
    // parts[7] = '001'

    if (parts.length >= 8) {
      // Full UUID with hyphens
      const branchId = parts.slice(1, 7).join('-');
      const dateStr = parts[parts.length - 2];
      const seq = parts[parts.length - 1];
      return { branchId, dateStr, seq };
    }

    // Fallback: if UUID without hyphens or other format
    // We'll try to parse by detecting UUID length
    // For simplicity, we'll try to find the invoice directly
    return null;
  }

  async processPaymentInput(
    webhookData: {
      order_id: string;
      gross_amount: number;
      payment_type: string;
      status: string;
      transaction_id?: string;
    },
    webhookId: string
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const { order_id, gross_amount, payment_type, status, transaction_id } = webhookData;

      // 1. Find invoice by order_id dengan fallback: invoice_number → booking_id → id
      let invoice: any = null;

      // 1a. Coba cari berdasarkan invoice_number
      try {
        const result = await this.pool.query(
          'SELECT * FROM invoices WHERE invoice_number = $1',
          [order_id]
        );
        if (result.rows.length > 0) {
          invoice = result.rows[0];
        }
      } catch (e) {
        // invoice_number column might not exist, skip
      }

      // 1b. Jika tidak ditemukan, coba cari berdasarkan booking_id
      if (!invoice) {
        try {
          const result = await this.pool.query(
            'SELECT * FROM invoices WHERE booking_id = $1',
            [order_id]
          );
          if (result.rows.length > 0) {
            invoice = result.rows[0];
          }
        } catch (e) {
          // ignore
        }
      }

      // 1c. Jika masih tidak ditemukan, coba cari berdasarkan id (UUID invoice) sebagai fallback terakhir
      if (!invoice) {
        try {
          const result = await this.pool.query(
            'SELECT * FROM invoices WHERE id = $1',
            [order_id]
          );
          if (result.rows.length > 0) {
            invoice = result.rows[0];
          }
        } catch (e) {
          // ignore
        }
      }

      if (!invoice) {
        logger.warn(`Invoice not found for order_id: ${order_id}`);
        return { success: false, message: 'Invoice not found' };
      }

      // 2. Handle payment status
      if (status === 'deny' || status === 'expire' || status === 'failed') {
        logger.info(`Payment failed for invoice ${invoice.id}: status=${status}`);
        // Mark invoice as failed? We don't have a FAILED status yet.
        // For now, just log and don't mark paid.
        return {
          success: true,
          message: `Payment ${status}`,
        };
      }

      if (status === 'pending' || status === 'authorize') {
        logger.info(`Payment pending for invoice ${invoice.id}: status=${status}`);
        return {
          success: true,
          message: `Payment ${status}`,
        };
      }

      // 3. Verify amount matches
      if (status === 'capture' || status === 'settlement') {
        const invoiceAmount = parseFloat(invoice.amount_due);
        const webhookAmount = gross_amount; // already number

        if (webhookAmount !== invoiceAmount) {
          logger.warn(`Amount mismatch for invoice ${invoice.id}: expected ${invoiceAmount}, got ${webhookAmount}`);
          return {
            success: false,
            message: `Amount mismatch: expected ${invoiceAmount}, got ${webhookAmount}`,
          };
        }

        // 4. Mark invoice as paid
        const updatedInvoice = await this.invoicePaymentService.markInvoicePaid(
          invoice.id,
          payment_type || 'GATEWAY',
          transaction_id || `webhook-${webhookId}`,
          invoice.branch_id,
          webhookAmount
        );

        logger.info(`Payment processed successfully for invoice ${invoice.id}`);
        return {
          success: true,
          message: 'Payment processed successfully',
          data: updatedInvoice,
        };
      }

      // Unknown status
      logger.warn(`Unknown payment status: ${status} for invoice ${invoice.id}`);
      return {
        success: false,
        message: `Unknown status: ${status}`,
      };
    } catch (error: unknown) {
      logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) }, 'PaymentInputService error');
      return {
        success: false,
        message: getErrorMessage(error) || 'Payment processing failed',
      };
    }
  }

  /**
   * Get reconciliation data for admin
   */
  async getReconciliation(date: Date): Promise<any> {
    const dateStr = date.toISOString().split('T')[0];
    const result = await this.pool.query(
      `SELECT 
        i.id as invoice_id,
        i.invoice_number,
        i.amount_due,
        i.status as invoice_status,
        i.paid_at,
        i.payment_method,
        p.status as webhook_status,
        p.webhook_id,
        p.created_at as webhook_created_at
      FROM invoices i
      LEFT JOIN payment_webhooks p ON i.invoice_number = p.order_id
      WHERE i.invoice_date = $1
      ORDER BY i.created_at DESC`,
      [dateStr]
    );
    return result.rows;
  }

  /**
   * Get reconciliation summary for a date range (admin)
   */
  async getReconciliationSummary(dateFrom: string, dateTo: string, branchId: string): Promise<any> {
    const result = await this.pool.query(
      `SELECT 
        COUNT(*) as total_invoices,
        SUM(amount_due) as total_amount,
        SUM(CASE WHEN status = 'PAID' THEN paid_amount ELSE 0 END) as total_paid,
        COUNT(CASE WHEN status = 'UNPAID' THEN 1 END) as unpaid_count
      FROM invoices
      WHERE invoice_date BETWEEN $1 AND $2 AND branch_id = $3`,
      [dateFrom, dateTo, branchId]
    );
    return result.rows[0] || { total_invoices: 0, total_amount: 0, total_paid: 0, unpaid_count: 0 };
  }
}
