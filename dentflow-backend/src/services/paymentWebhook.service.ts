import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import { auditService } from './audit.service';
import { AuditEventType } from '../models/audit.model';
import { getErrorMessage, getErrorStack } from '../utils/error.util';
import { PaymentWebhookRepository } from '../repositories/paymentWebhook.repository';

export class PaymentWebhookService {
  private pool: Pool;
  private repository: PaymentWebhookRepository;

  constructor() {
    this.pool = new Pool({ connectionString: config.database.url });
    this.repository = new PaymentWebhookRepository();
  }

  validateMidtransSignature(
    orderId: string,
    statusCode: string,
    grossAmount: string,
    signature: string,
    serverKey: string
  ): boolean {
    const raw = orderId + statusCode + grossAmount + serverKey;
    const expected = crypto.createHmac('sha256', serverKey).update(raw).digest('hex');
    const valid = expected === signature;
    if (!valid) {
      logger.warn(`❌ Signature mismatch: expected=${expected}, got=${signature}`);
    }
    return valid;
  }

  async processPaymentWebhook(
    webhookId: string,
    orderId: string,
    signature: string,
    payload: any,
    serverKey: string,
    skipValidation: boolean = false
  ): Promise<{ success: boolean; message: string }> {
    try {
      const statusCode = String(payload.status_code || payload.statusCode || '');
      const grossAmount = String(payload.gross_amount || payload.grossAmount || '0');
      const transactionStatus = payload.transaction_status || payload.transactionStatus || '';

      console.log(`🔍 [TEST] Processing webhook ${webhookId} for order ${orderId}`);

      // 1. Validasi signature
      if (!skipValidation) {
        if (!this.validateMidtransSignature(orderId, statusCode, grossAmount, signature, serverKey)) {
          console.log(`❌ [TEST] Invalid signature for webhook ${webhookId}`);
          return { success: false, message: 'Invalid signature' };
        }
      }

      // 2. CEK IDEMPOTENCY
      try {
        const exists = await this.repository.isWebhookProcessed(webhookId);
        if (exists) {
          console.log(`ℹ️ [TEST] Webhook ${webhookId} already processed (idempotent)`);
          return { success: true, message: 'Already processed (idempotent)' };
        }
      } catch (err) {
        console.log(`❌ [TEST] Idempotency check failed: ${getErrorMessage(err)}`);
        return { success: false, message: 'Idempotency check failed' };
      }

      // 3. Dapatkan invoice (SEBELUM record webhook)
      console.log(`🔍 [LOOKUP] Starting invoice lookup for order ${orderId}`);
      let invoice = null;

      try {
        if (orderId.startsWith('INV-')) {
          console.log(`🔍 [LOOKUP] Query by invoice_number: ${orderId}`);
          const result = await this.pool.query(
            'SELECT * FROM invoices WHERE invoice_number = $1',
            [orderId]
          );
          console.log(`🔍 [LOOKUP] invoice_number result rows: ${result.rows.length}`);
          invoice = result.rows[0] || null;
        }

        if (!invoice) {
          console.log(`🔍 [LOOKUP] Query by booking_id: ${orderId}`);
          const result = await this.pool.query(
            'SELECT * FROM invoices WHERE booking_id = $1',
            [orderId]
          );
          console.log(`🔍 [LOOKUP] booking_id result rows: ${result.rows.length}`);
          invoice = result.rows[0] || null;
        }

        if (!invoice) {
          console.log(`🔍 [LOOKUP] Query by id: ${orderId}`);
          const result = await this.pool.query(
            'SELECT * FROM invoices WHERE id = $1',
            [orderId]
          );
          console.log(`🔍 [LOOKUP] id result rows: ${result.rows.length}`);
          invoice = result.rows[0] || null;
        }
      } catch (err) {
        console.log(`❌ [LOOKUP] Database error: ${getErrorMessage(err)}`);
        return { success: false, message: 'Database error fetching invoice' };
      }

      // 4. Invoice tidak ditemukan → QUEUE RETRY
      if (!invoice) {
        console.log(`❌ [LOOKUP] Invoice NOT found for order ${orderId}`);
        try {
          const nextRetryAt = new Date(Date.now() + 30 * 1000);
          await this.repository.createErrorRecord(
            webhookId,
            'Invoice not found - retry later',
            nextRetryAt
          );
          console.log(`✅ [LOOKUP] Error record created for webhook ${webhookId}`);
        } catch (err) {
          console.log(`❌ [LOOKUP] Error creating error record: ${getErrorMessage(err)}`);
          return { success: false, message: 'Failed to create error record' };
        }
        return { success: false, message: 'Invoice not found, queued for retry' };
      }

      console.log(`✅ [TEST] Invoice found: ${invoice.invoice_number} (${invoice.id})`);

      // 5. RECORD WEBHOOK (SETELAH invoice ditemukan, dengan branch_id)
      try {
        await this.recordWebhook(webhookId, orderId, signature, payload, invoice.branch_id);
        console.log(`✅ [TEST] Record webhook success for ${webhookId}`);
      } catch (err) {
        console.log(`❌ [TEST] Record webhook failed: ${getErrorMessage(err)}`);
        return { success: false, message: 'Failed to record webhook' };
      }

      // 6. Handle status
      const successStatuses = ['capture', 'settlement'];
      const failureStatuses = ['deny', 'expire', 'failure'];
      const pendingStatuses = ['pending', 'authorize'];

      try {
        if (successStatuses.includes(transactionStatus)) {
          await this.handleSuccessPayment(invoice, payload);
          await this.repository.updateStatus(webhookId, 'PROCESSED');
          console.log(`✅ [TEST] Invoice ${invoice.invoice_number} paid successfully`);
          return { success: true, message: 'Webhook processed successfully' };
        } else if (failureStatuses.includes(transactionStatus)) {
          await this.handleFailedPayment(invoice, orderId, transactionStatus);
          await this.repository.updateStatus(webhookId, 'PROCESSED');
          console.log(`❌ [TEST] Payment failed for invoice ${invoice.invoice_number}`);
          return { success: true, message: `Payment ${transactionStatus} handled` };
        } else if (pendingStatuses.includes(transactionStatus)) {
          console.log(`⏳ [TEST] Payment pending for invoice ${invoice.invoice_number}`);
          await this.repository.updateStatus(webhookId, 'PROCESSED');
          return { success: true, message: `Payment ${transactionStatus} - pending` };
        } else {
          console.log(`⚠️ [TEST] Unknown status: ${transactionStatus}`);
          await this.repository.updateStatus(webhookId, 'PROCESSED');
          return { success: true, message: `Unknown status: ${transactionStatus}` };
        }
      } catch (err) {
        console.log(`❌ [TEST] Payment handling error: ${getErrorMessage(err)}`);
        return { success: false, message: 'Payment handling failed' };
      }
    } catch (error: unknown) {
      console.log(`❌ [TEST] Unhandled error: ${getErrorMessage(error)}`);
      return { success: false, message: getErrorMessage(error) || 'Internal server error' };
    }
  }

  private async handleSuccessPayment(invoice: any, payload: any): Promise<void> {
    const paidAmount = parseFloat(payload.gross_amount) || 0;
    await this.pool.query(
      `UPDATE invoices 
       SET status = 'PAID', 
           payment_status = 'PAID',
           paid_at = NOW(), 
           paid_amount = $1 
       WHERE id = $2`,
      [paidAmount, invoice.id]
    );
    await auditService.logEvent({
      branchId: invoice.branch_id,
      userId: undefined,
      eventType: AuditEventType.INVOICE_MARKED_PAID,
      entityType: 'INVOICE',
      entityId: invoice.id,
      description: `Invoice ${invoice.invoice_number} marked as paid via webhook`,
      newValues: {
        status: 'PAID',
        payment_status: 'PAID',
        paid_at: new Date().toISOString(),
        paid_amount: paidAmount,
      },
      oldValues: {
        status: invoice.status,
        payment_status: invoice.payment_status,
      },
    });
  }

  private async handleFailedPayment(invoice: any, orderId: string, status: string): Promise<void> {
    await this.pool.query(
      `UPDATE invoices SET payment_notes = $1 WHERE id = $2`,
      [`Payment ${status} via webhook`, invoice.id]
    );
    if (invoice.booking_id) {
      await this.pool.query(
        `UPDATE bookings 
         SET status = 'CANCELLED', cancel_reason = $1 
         WHERE id = $2`,
        [`Payment ${status} - webhook failed`, invoice.booking_id]
      );
    }
    await auditService.logEvent({
      branchId: invoice.branch_id,
      userId: undefined,
      eventType: AuditEventType.PAYMENT_FAILED,
      entityType: 'INVOICE',
      entityId: invoice.id,
      description: `Payment ${status} for invoice ${invoice.invoice_number}`,
      newValues: { payment_notes: `Payment ${status} via webhook`, transaction_status: status },
      oldValues: { payment_status: invoice.payment_status },
    });
  }

  async recordWebhook(
    webhookId: string,
    orderId: string,
    signature: string,
    payload: any,
    branchId: string
  ): Promise<void> {
    try {
      console.log(`🔍 [RECORD] Inserting webhook ${webhookId} for order ${orderId}, branch ${branchId}`);
      await this.pool.query(
        `INSERT INTO payment_webhooks 
        (webhook_id, order_id, signature, payload, branch_id, provider, status, created_at)
        VALUES ($1, $2, $3, $4, $5, 'midtrans', 'RECEIVED', NOW())
        ON CONFLICT (webhook_id) DO NOTHING`,
        [webhookId, orderId, signature, payload, branchId]
      );
      console.log(`✅ [RECORD] Webhook ${webhookId} inserted successfully`);
    } catch (err) {
      console.log(`❌ [RECORD] Error inserting webhook: ${getErrorMessage(err)}`);
      throw err;
    }
  }

  async isWebhookExists(webhookId: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM payment_webhooks WHERE webhook_id = $1',
      [webhookId]
    );
    return result.rows.length > 0;
  }

  async markWebhookProcessed(webhookId: string): Promise<void> {
    await this.pool.query(
      `UPDATE payment_webhooks SET status = 'PROCESSED', processed_at = NOW() WHERE webhook_id = $1`,
      [webhookId]
    );
  }
}

export const paymentWebhookService = new PaymentWebhookService();
