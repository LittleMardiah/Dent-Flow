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

  private isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
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

  // ============================================================
  // RECORD WEBHOOK DENGAN BRANCH_ID NULL (TD-PAY-018)
  // ============================================================

  async recordWebhookWithNullableBranchId(
    webhookId: string,
    orderId: string,
    signature: string,
    payload: any
  ): Promise<void> {
    try {
      console.log(`🔍 [RECORD] Inserting webhook ${webhookId} for order ${orderId} with NULL branch_id`);
      await this.pool.query(
        `INSERT INTO payment_webhooks 
         (webhook_id, order_id, signature, payload, branch_id, provider, status, created_at)
         VALUES ($1, $2, $3, $4, NULL, 'midtrans', 'RECEIVED', NOW())
         ON CONFLICT (webhook_id) DO NOTHING`,
        [webhookId, orderId, signature, JSON.stringify(payload)]
      );
      console.log(`✅ [RECORD] Webhook ${webhookId} inserted successfully with NULL branch_id`);
    } catch (err) {
      console.log(`❌ [RECORD] Error inserting webhook: ${getErrorMessage(err)}`);
      throw err;
    }
  }

  async updateWebhookBranchId(webhookId: string, branchId: string): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE payment_webhooks SET branch_id = $1 WHERE webhook_id = $2`,
        [branchId, webhookId]
      );
      console.log(`✅ [UPDATE] Webhook ${webhookId} branch_id updated to ${branchId}`);
    } catch (err) {
      console.log(`❌ [UPDATE] Failed to update webhook branch_id: ${getErrorMessage(err)}`);
      throw err;
    }
  }

  // ============================================================
  // MAIN PROCESS (NEW FLOW - RECORD FIRST, UPDATE LATER)
  // ============================================================

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

      if (!skipValidation) {
        if (!this.validateMidtransSignature(orderId, statusCode, grossAmount, signature, serverKey)) {
          console.log(`❌ [TEST] Invalid signature for webhook ${webhookId}`);
          return { success: false, message: 'Invalid signature' };
        }
      }

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

      // ✅ STEP 1: RECORD WEBHOOK FIRST (dengan branch_id = NULL)
      try {
        await this.recordWebhookWithNullableBranchId(
          webhookId,
          orderId,
          signature,
          payload
        );
      } catch (err) {
        console.log(`❌ [WEBHOOK] Failed to record webhook: ${getErrorMessage(err)}`);
        return { success: false, message: 'Failed to record webhook' };
      }

      // ✅ STEP 2: LOOKUP INVOICE
      console.log(`🔍 [LOOKUP] Starting invoice lookup for order ${orderId}`);
      let invoice = null;

      try {
        if (orderId.startsWith('INV-')) {
          const result = await this.pool.query(
            'SELECT * FROM invoices WHERE invoice_number = $1',
            [orderId]
          );
          invoice = result.rows[0] || null;
        }
        if (!invoice && this.isValidUUID(orderId)) {
          const result = await this.pool.query(
            'SELECT * FROM invoices WHERE booking_id = $1',
            [orderId]
          );
          invoice = result.rows[0] || null;
        }
        if (!invoice && this.isValidUUID(orderId)) {
          const result = await this.pool.query(
            'SELECT * FROM invoices WHERE id = $1',
            [orderId]
          );
          invoice = result.rows[0] || null;
        }
      } catch (err) {
        console.log(`❌ [LOOKUP] Database error: ${getErrorMessage(err)}`);
      }

      // ✅ STEP 3: HANDLE INVOICE NOT FOUND
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

      console.log(`✅ [LOOKUP] Invoice found: ${invoice.invoice_number} (${invoice.id})`);

      // ✅ STEP 4: UPDATE WEBHOOK BRANCH_ID (karena sekarang sudah tau branch_id)
      try {
        await this.updateWebhookBranchId(webhookId, invoice.branch_id);
      } catch (err) {
        console.log(`⚠️ [LOOKUP] Warning: Failed to update webhook branch_id: ${getErrorMessage(err)}`);
      }

      // ✅ STEP 5: PROCESS PAYMENT
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
        } else if (refundStatuses.includes(transactionStatus)) {
          await this.handleRefundPayment(invoice, orderId, transactionStatus, payload, webhookId);
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

  // Method lama dipertahankan untuk kompatibilitas
  async recordWebhook(
    webhookId: string,
    orderId: string,
    signature: string,
    payload: any,
    branchId: string
  ): Promise<void> {
    await this.recordWebhookWithNullableBranchId(webhookId, orderId, signature, payload);
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
