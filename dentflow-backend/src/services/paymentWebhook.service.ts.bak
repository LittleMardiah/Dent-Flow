import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import { auditService } from './audit.service';
import { AuditEventType } from '../models/audit.model';

export class PaymentWebhookService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({ connectionString: config.database.url });
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
    return expected === signature;
  }

  async processPaymentWebhook(
    webhookId: string,
    orderId: string,
    signature: string,
    payload: any,
    serverKey: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const statusCode = String(payload.status_code || payload.statusCode || '');
      const grossAmount = String(payload.gross_amount || payload.grossAmount || '0');

      if (!this.validateMidtransSignature(orderId, statusCode, grossAmount, signature, serverKey)) {
        logger.warn(`❌ Invalid signature for webhook ${webhookId}`);
        return { success: false, message: 'Invalid signature' };
      }

      // 1. CEK IDEMPOTENCY (cek keberadaan webhook_id di tabel, status apapun)
      const exists = await this.isWebhookExists(webhookId);
      if (exists) {
        logger.info(`ℹ️ Webhook ${webhookId} already processed (idempotent)`);
        return { success: true, message: 'Already processed (idempotent)' };
      }

      // 2. Dapatkan invoice (untuk branch_id)
      let invoice;
      if (orderId.startsWith('INV-')) {
        const invoiceResult = await this.pool.query(
          'SELECT * FROM invoices WHERE invoice_number = $1',
          [orderId]
        );
        invoice = invoiceResult.rows[0];
      } else {
        const invoiceResult = await this.pool.query(
          'SELECT * FROM invoices WHERE id = $1',
          [orderId]
        );
        invoice = invoiceResult.rows[0];
      }

      if (!invoice) {
        logger.warn(`❌ Invoice not found for order_id: ${orderId}`);
        return { success: false, message: 'Invoice not found' };
      }

      // 3. Record webhook (status RECEIVED)
      await this.recordWebhook(webhookId, orderId, signature, payload, invoice.branch_id);

      // 4. Update invoice (status + payment_status + paid_amount)
      await this.pool.query(
        `UPDATE invoices 
         SET status = 'PAID', 
             payment_status = 'PAID',
             paid_at = NOW(), 
             paid_amount = $1 
         WHERE id = $2`,
        [parseFloat(payload.gross_amount) || 0, invoice.id]
      );

      // 5. Audit log
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
          paid_amount: parseFloat(payload.gross_amount) || 0,
        },
        oldValues: {
          status: invoice.status,
          payment_status: invoice.payment_status,
        },
      });

      // 6. Mark webhook as PROCESSED
      await this.markWebhookProcessed(webhookId);

      logger.info(`✅ Invoice ${invoice.invoice_number} paid successfully via webhook ${webhookId}`);
      return { success: true, message: 'Webhook processed successfully' };
    } catch (error: any) {
      logger.error({ error: error.message, stack: error.stack }, 'Error processing webhook');
      return { success: false, message: error.message || 'Internal server error' };
    }
  }

  async isWebhookExists(webhookId: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM payment_webhooks WHERE webhook_id = $1',
      [webhookId]
    );
    return result.rows.length > 0;
  }

  async recordWebhook(
    webhookId: string,
    orderId: string,
    signature: string,
    payload: any,
    branchId: string
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO payment_webhooks 
       (webhook_id, order_id, signature, payload, provider, branch_id, status, created_at)
       VALUES ($1, $2, $3, $4, 'midtrans', $5, 'RECEIVED', NOW())`,
      [webhookId, orderId, signature, payload, branchId]
    );
  }

  async markWebhookProcessed(webhookId: string): Promise<void> {
    await this.pool.query(
      `UPDATE payment_webhooks SET status = 'PROCESSED', processed_at = NOW() WHERE webhook_id = $1`,
      [webhookId]
    );
  }
}

export const paymentWebhookService = new PaymentWebhookService();
