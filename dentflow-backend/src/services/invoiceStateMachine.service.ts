import { Pool } from 'pg';

import { logger } from '../utils/logger';
import { auditService } from './audit.service';
import { AuditEventType } from '../models/audit.model';
import { InvoiceStateValidator } from './invoiceStateValidator.service';
import { getErrorMessage, getErrorStack } from '../utils/error.util';
import { pool } from '../config/database';

export interface MarkPaidOptions {
  invoiceId: string;
  paymentMethod: string;
  amount: number;
  branchId: string;
  userId?: string; // admin or system user
  transactionId?: string;
  notes?: string;
}

export class InvoiceStateMachineService {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  /**
   * Core transition: UNPAID → PAID
   * Used by both admin (InvoiceService) and webhook (InvoicePaymentService)
   */
  async transitionToPaid(options: MarkPaidOptions): Promise<any> {
    const { invoiceId, paymentMethod, amount, branchId, userId, transactionId } = options;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Get invoice with lock
      const invoiceResult = await client.query(
        'SELECT * FROM invoices WHERE id = $1 FOR UPDATE',
        [invoiceId]
      );
      if (invoiceResult.rows.length === 0) {
        throw new Error('INVOICE_NOT_FOUND');
      }
      const invoice = invoiceResult.rows[0];

      // 2. Validate state transition
      if (invoice.status === 'PAID') {
        logger.info(`Invoice ${invoiceId} already paid (idempotent)`);
        await client.query('COMMIT');
        return invoice;
      }

      if (!InvoiceStateValidator.validateTransition(invoice.status, 'PAID')) {
        throw new Error('INVALID_STATE_TRANSITION');
      }

      // 3. Update invoice
      const updateResult = await client.query(
        `UPDATE invoices
         SET status = 'PAID',
             payment_status = 'PAID',
             paid_at = NOW(),
             amount_paid = $1,
             paid_amount = $1,
             payment_method = $2,
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [amount, paymentMethod, invoiceId]
      );
      const updatedInvoice = updateResult.rows[0];

      // 4. Audit log
      await auditService.logEvent({
        branchId,
        userId: userId || undefined,
        eventType: AuditEventType.INVOICE_MARKED_PAID,
        entityType: 'INVOICE',
        entityId: invoiceId,
        description: `Invoice ${invoiceId} marked as PAID via ${paymentMethod}${transactionId ? ' (txn: '+transactionId+')' : ''}`,
        newValues: {
          status: 'PAID',
          payment_status: 'PAID',
          paid_at: updatedInvoice.paid_at,
          amount_paid: updatedInvoice.amount_paid,
          paid_amount: updatedInvoice.paid_amount,
          payment_method: paymentMethod,
        },
        oldValues: {
          status: invoice.status,
          payment_status: invoice.payment_status,
        },
      });

      await client.query('COMMIT');
      logger.info(`✅ Invoice ${invoiceId} marked as PAID (${paymentMethod})`);
      return updatedInvoice;
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      const message = getErrorMessage(error);
      const stack = getErrorStack(error);
      logger.error({ error: message, stack }, 'Failed to mark invoice as PAID');
      throw error;
    } finally {
      client.release();
    }
  }
}

export const invoiceStateMachineService = new InvoiceStateMachineService();
