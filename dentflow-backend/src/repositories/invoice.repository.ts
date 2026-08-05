import { getErrorMessage, getErrorStack } from "../utils/error.util";
import { BaseRepository } from './base.repository';
import { logger } from '../utils/logger';
import { auditService } from '../services/audit.service';
import { AuditEventType } from '../models/audit.model';

export interface InvoiceData {
  branchId: string;
  encounterId: string;
  patientId: string;
  amountDue: number;
  amountPaid?: number;
  status?: 'UNPAID' | 'PARTIAL' | 'PAID';
}

export class InvoiceRepository extends BaseRepository {
  async create(data: InvoiceData) {
    const client = await this.getClient();
    try {
      const result = await client.query(
        `INSERT INTO invoices 
         (branch_id, encounter_id, patient_id, amount_due, amount_paid, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          data.branchId,
          data.encounterId,
          data.patientId,
          data.amountDue,
          data.amountPaid || 0,
          data.status || 'UNPAID',
        ]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  async getById(id: string) {
    const result = await this.query(
      'SELECT * FROM invoices WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  // AUTO-FILTER BY BRANCH_ID (Multi-tenant!)
  async getByPatient(patientId: string, branchId: string) {
    const result = await this.query(
      'SELECT * FROM invoices WHERE patient_id = $1 AND branch_id = $2 ORDER BY created_at DESC',
      [patientId, branchId]
    );
    return result.rows;
  }

  // AUTO-FILTER BY BRANCH_ID (Multi-tenant!)
  async getByBranch(branchId: string, limit: number = 100) {
    const result = await this.query(
      'SELECT * FROM invoices WHERE branch_id = $1 ORDER BY created_at DESC LIMIT $2',
      [branchId, limit]
    );
    return result.rows;
  }

  async updateStatus(id: string, newStatus: 'UNPAID' | 'PARTIAL' | 'PAID', paymentData?: any) {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');

      const current = await client.query(
        'SELECT status, amount_due, amount_paid, branch_id FROM invoices WHERE id = $1',
        [id]
      );
      if (current.rows.length === 0) {
        throw new Error('Invoice not found');
      }
      const oldStatus = current.rows[0].status;

      if (oldStatus === 'PAID' && newStatus !== 'PAID') {
        throw new Error('Cannot update invoice: status is already PAID (final state)');
      }

      const result = await client.query(
        `UPDATE invoices 
         SET status = $1, updated_at = NOW(), 
             amount_paid = CASE 
               WHEN $1 = 'PAID' THEN amount_due 
               ELSE amount_paid 
             END,
             paid_at = CASE 
               WHEN $1 = 'PAID' THEN NOW() 
               ELSE paid_at 
             END
         WHERE id = $2 AND status != 'PAID'
         RETURNING *`,
        [newStatus, id]
      );

      if (result.rows.length === 0) {
        throw new Error('Invoice not found or already in final state (PAID)');
      }

      const updatedInvoice = result.rows[0];

      if (paymentData && (newStatus === 'PARTIAL' || newStatus === 'PAID')) {
        await client.query(
          `INSERT INTO invoice_payments 
           (invoice_id, amount_paid, payment_method, payment_date, notes)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            id,
            paymentData.amount || updatedInvoice.amount_due,
            paymentData.method || 'CASH',
            paymentData.paymentDate || new Date(),
            paymentData.notes || null,
          ]
        );
      }

      await auditService.logEvent({
        branchId: updatedInvoice.branch_id,
        userId: undefined,
        eventType: AuditEventType.INVOICE_GENERATED,
        entityType: 'INVOICE',
        entityId: updatedInvoice.id,
        description: `Invoice status changed from ${oldStatus} to ${newStatus}`,
      });

      await client.query('COMMIT');
      logger.info(`✅ Invoice ${id} status updated: ${oldStatus} → ${newStatus}`);
      return updatedInvoice;
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) });
      throw error;
    } finally {
      client.release();
    }
  }

  async getPayments(invoiceId: string) {
    const result = await this.query(
      'SELECT * FROM invoice_payments WHERE invoice_id = $1 ORDER BY payment_date DESC',
      [invoiceId]
    );
    return result.rows;
  }
}

export const invoiceRepository = new InvoiceRepository();
