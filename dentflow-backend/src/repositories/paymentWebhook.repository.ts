import { Pool } from 'pg';
import { config } from '../config';

export class PaymentWebhookRepository {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({ connectionString: config.database.url });
  }

  async recordWebhook(
    webhookId: string,
    orderId: string,
    signature: string,
    payload: any
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO payment_webhooks (webhook_id, order_id, signature, payload, status)
       VALUES ($1, $2, $3, $4, 'RECEIVED')
       ON CONFLICT (webhook_id) DO NOTHING`,
      [webhookId, orderId, signature, payload]
    );
  }

  async isWebhookProcessed(webhookId: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT status FROM payment_webhooks WHERE webhook_id = $1`,
      [webhookId]
    );
    if (result.rows.length === 0) return false;
    return result.rows[0].status === 'PROCESSED';
  }

  async updateStatus(webhookId: string, status: string): Promise<void> {
    await this.pool.query(
      `UPDATE payment_webhooks SET status = $1, processed_at = NOW() WHERE webhook_id = $2`,
      [status, webhookId]
    );
  }

  async getWebhookByOrderId(orderId: string): Promise<any> {
    const result = await this.pool.query(
      `SELECT * FROM payment_webhooks WHERE order_id = $1`,
      [orderId]
    );
    return result.rows[0] || null;
  }

  async createErrorRecord(webhookId: string, error: string, nextRetryAt: Date): Promise<void> {
    const webhookExists = await this.pool.query(
      'SELECT webhook_id FROM payment_webhooks WHERE webhook_id = $1',
      [webhookId]
    );

    if (webhookExists.rows.length === 0) {
      const errorMsg = `Cannot create error record: webhook_id ${webhookId} not found in payment_webhooks table.`;
      console.log(`❌ [REPO] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    console.log(`✅ [REPO] Webhook ${webhookId} exists, proceeding to create error record`);

    const exists = await this.pool.query(
      'SELECT id FROM payment_webhook_errors WHERE webhook_id = $1',
      [webhookId]
    );

    if (exists.rows.length > 0) {
      await this.pool.query(
        `UPDATE payment_webhook_errors 
         SET last_error = $1, 
             next_retry_at = $2, 
             retry_count = retry_count + 1,
             updated_at = NOW()
         WHERE webhook_id = $3`,
        [error, nextRetryAt, webhookId]
      );
    } else {
      await this.pool.query(
        `INSERT INTO payment_webhook_errors 
         (webhook_id, last_error, next_retry_at, retry_count, created_at)
         VALUES ($1, $2, $3, 0, NOW())`,
        [webhookId, error, nextRetryAt]
      );
    }
  }

  async getPendingRetries(limit: number = 10): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT e.*, w.payload, w.order_id, w.webhook_id
       FROM payment_webhook_errors e
       JOIN payment_webhooks w ON e.webhook_id = w.webhook_id
       WHERE e.retry_count < 3 
         AND e.next_retry_at <= NOW()
         AND w.status != 'PERMANENTLY_FAILED'
       ORDER BY e.next_retry_at ASC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  async incrementRetryCount(webhookId: string, nextRetryAt: Date): Promise<void> {
    // Fix: hapus last_retry_at karena kolom tidak ada di tabel
    await this.pool.query(
      `UPDATE payment_webhook_errors 
       SET retry_count = retry_count + 1, 
           next_retry_at = $1
       WHERE webhook_id = $2`,
      [nextRetryAt, webhookId]
    );
  }

  async markPermanentlyFailed(webhookId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE payment_webhooks SET status = 'PERMANENTLY_FAILED' WHERE webhook_id = $1`,
        [webhookId]
      );
      await client.query(
        `UPDATE payment_webhook_errors SET retry_count = 3, next_retry_at = NULL WHERE webhook_id = $1`,
        [webhookId]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getErrorByWebhookId(webhookId: string): Promise<any> {
    const result = await this.pool.query(
      `SELECT e.*, w.payload, w.order_id, w.status as webhook_status
       FROM payment_webhook_errors e
       JOIN payment_webhooks w ON e.webhook_id = w.webhook_id
       WHERE e.webhook_id = $1`,
      [webhookId]
    );
    return result.rows[0] || null;
  }

  async deleteErrorRecord(webhookId: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM payment_webhook_errors WHERE webhook_id = $1',
      [webhookId]
    );
  }

  async getWebhookErrors(status?: string): Promise<any[]> {
    let query = `
      SELECT e.*, w.payload, w.order_id, w.webhook_id, w.status as webhook_status
      FROM payment_webhook_errors e
      JOIN payment_webhooks w ON e.webhook_id = w.webhook_id
    `;
    const params: any[] = [];
    if (status) {
      query += ` WHERE w.status = $1`;
      params.push(status);
    }
    query += ` ORDER BY e.created_at DESC LIMIT 100`;
    const result = await this.pool.query(query, params);
    return result.rows;
  }

  async isWebhookExistsById(webhookId: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM payment_webhooks WHERE webhook_id = $1 LIMIT 1',
      [webhookId]
    );
    return result.rows.length > 0;
  }
}
