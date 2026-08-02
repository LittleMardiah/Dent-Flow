import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import { auditService } from './audit.service';
import { AuditEventType } from '../models/audit.model';
import { InvoiceStateValidator } from './invoiceStateValidator.service';

export class InvoiceService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({ connectionString: config.database.url });
  }

  async markPaid(
    invoiceId: string,
    adminId: string,
    paymentMethod: string,
    paidAmount: number,
    _notes?: string
  ) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const invoiceResult = await client.query(
        'SELECT * FROM invoices WHERE id = $1 FOR UPDATE',
        [invoiceId]
      );
      if (invoiceResult.rows.length === 0) {
        throw new Error('INVOICE_NOT_FOUND');
      }
      const invoice = invoiceResult.rows[0];

      if (invoice.status === 'PAID') {
        throw new Error('INVOICE_ALREADY_PAID');
      }

      if (!InvoiceStateValidator.validateTransition(invoice.status, 'PAID')) {
        throw new Error('INVALID_STATE_TRANSITION');
      }

      const updateResult = await client.query(
        `UPDATE invoices
         SET status = 'PAID',
             paid_at = NOW(),
             amount_paid = $1,
             payment_method = $3,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [paidAmount, invoiceId, paymentMethod]
      );
      const updated = updateResult.rows[0];

      await auditService.logEvent({
        branchId: updated.branch_id,
        userId: adminId,
        eventType: AuditEventType.INVOICE_MARKED_PAID,
        entityType: 'INVOICE',
        entityId: updated.id,
        description: `Invoice ${invoiceId} marked as paid by admin ${adminId}`,
        newValues: {
          status: 'PAID',
          paid_at: updated.paid_at,
          amount_paid: updated.amount_paid,
          payment_method: paymentMethod,
        },
        oldValues: {
          status: invoice.status,
        },
      });

      await client.query('COMMIT');
      logger.info(`✅ Invoice ${invoiceId} marked as paid`);
      return updated;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async undoPayment(invoiceId: string, adminId: string, reason: string) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const invoiceResult = await client.query(
        'SELECT * FROM invoices WHERE id = $1 FOR UPDATE',
        [invoiceId]
      );
      if (invoiceResult.rows.length === 0) {
        throw new Error('INVOICE_NOT_FOUND');
      }
      const invoice = invoiceResult.rows[0];

      if (invoice.status !== 'PAID') {
        throw new Error('INVOICE_NOT_PAID');
      }

      // Bypass trigger to allow admin override
      await client.query('SET LOCAL session_replication_role = replica;');

      const updateResult = await client.query(
        `UPDATE invoices
         SET status = 'UNPAID',
             paid_at = NULL,
             amount_paid = 0,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [invoiceId]
      );

      await client.query('SET LOCAL session_replication_role = DEFAULT;');

      const updated = updateResult.rows[0];

      await auditService.logEvent({
        branchId: updated.branch_id,
        userId: adminId,
        eventType: AuditEventType.INVOICE_UNDO_PAYMENT,
        entityType: 'INVOICE',
        entityId: updated.id,
        description: `Payment undone for invoice ${invoiceId} by admin ${adminId}. Reason: ${reason}`,
        newValues: {
          status: 'UNPAID',
        },
        oldValues: {
          status: 'PAID',
        },
      });

      await client.query('COMMIT');
      logger.info(`✅ Invoice ${invoiceId} payment undone`);
      return updated;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getInvoiceById(invoiceId: string) {
    const result = await this.pool.query(
      'SELECT * FROM invoices WHERE id = $1',
      [invoiceId]
    );
    if (result.rows.length === 0) {
      throw new Error('INVOICE_NOT_FOUND');
    }
    return result.rows[0];
  }
}