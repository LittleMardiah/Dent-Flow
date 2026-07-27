import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import { auditService } from '../services/audit.service';
import { AuditEventType } from '../models/audit.model';

export interface PaymentWebhookPayload {
  provider: 'midtrans' | 'xendit';
  webhookId: string;
  eventType: string;
  orderId: string;
  transactionStatus: string;
  signatureKey?: string;
  rawPayload: any;
}

export class PaymentWebhookService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({ connectionString: config.database.url });
  }

  async processWebhook(payload: PaymentWebhookPayload) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Cek idempotency
      const existing = await client.query(
        'SELECT id, status FROM payment_webhooks WHERE webhook_id = $1 AND provider = $2',
        [payload.webhookId, payload.provider]
      );

      if (existing.rows.length > 0) {
        logger.info(`⏭️ Idempotent webhook: ${payload.webhookId} (already processed)`);
        await client.query('COMMIT');
        return { idempotent: true, existing: existing.rows[0] };
      }

      // 2. Ambil branch_id dari database (UUID)
      const branchResult = await client.query('SELECT id FROM branches LIMIT 1');
      if (branchResult.rows.length === 0) {
        throw new Error('No branch found. Please seed branches first.');
      }
      const branchId = branchResult.rows[0].id;

      // 3. Simpan webhook
      const result = await client.query(
        `INSERT INTO payment_webhooks 
         (branch_id, provider, webhook_id, event_type, payload, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          branchId,
          payload.provider,
          payload.webhookId,
          payload.eventType,
          payload.rawPayload,
          'RECEIVED',
        ]
      );

      const webhookId = result.rows[0].id;

      // 4. Audit log
      await auditService.logEvent({
        branchId: branchId,
        userId: undefined,
        eventType: AuditEventType.PAYMENT_CONFIRMED,
        entityType: 'PAYMENT',
        entityId: webhookId,
        description: `Payment webhook received from ${payload.provider}: ${payload.webhookId}`,
      });

      await client.query('COMMIT');

      logger.info(`✅ Webhook processed: ${payload.webhookId}`);
      return { idempotent: false, id: webhookId };
    } catch (error: any) {
      await client.query('ROLLBACK');
      logger.error({ error: error.message, stack: error.stack });
      throw error;
    } finally {
      client.release();
    }
  }

  async markAsProcessed(webhookId: string) {
    const client = await this.pool.connect();
    try {
      await client.query(
        `UPDATE payment_webhooks 
         SET status = 'PROCESSED', processed_at = NOW()
         WHERE id = $1`,
        [webhookId]
      );
      logger.info(`✅ Webhook marked as processed: ${webhookId}`);
    } catch (error: any) {
      logger.error({ error: error.message, stack: error.stack });
    } finally {
      client.release();
    }
  }

  async getWebhook(id: string) {
    const result = await this.pool.query(
      'SELECT * FROM payment_webhooks WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }
}

export const paymentWebhookService = new PaymentWebhookService();
