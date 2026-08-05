import { logger } from '../utils/logger';
import { PaymentWebhookService } from '../services/paymentWebhook.service';
import { PaymentWebhookRepository } from '../repositories/paymentWebhook.repository';
import { pool } from '../config/database';
import { getErrorMessage, getErrorStack } from '../utils/error.util';

export const webhookRetryJob = {
  name: 'webhook-retry',
  schedule: '*/5 * * * *',

  async execute(): Promise<void> {
    try {
      logger.info('🔄 Running webhook retry job...');
      
      const repo = new PaymentWebhookRepository();
      const service = new PaymentWebhookService();
      const pending = await repo.getPendingRetries(10);

      if (!pending || pending.length === 0) {
        logger.info('✅ No pending webhooks to retry');
        return;
      }

      logger.info(`📦 Found ${pending.length} pending webhooks to retry`);

      for (const item of pending) {
        const webhookId = item.webhook_id;
        const orderId = item.order_id;
        const payload = item.payload;
        const retryCount = item.retry_count || 0;

        logger.info(`🔄 Retrying webhook ${webhookId} (attempt ${retryCount + 1}/3)`);

        const result = await service.processPaymentWebhook(
          webhookId,
          orderId,
          '',
          payload,
          process.env.MIDTRANS_SERVER_KEY || ''
        );

        if (result.success) {
          await repo.deleteErrorRecord(webhookId);
          logger.info(`✅ Webhook ${webhookId} retry succeeded`);
        } else {
          const newRetryCount = retryCount + 1;
          
          if (newRetryCount >= 3) {
            await repo.markPermanentlyFailed(webhookId);
            logger.error(`❌ Webhook ${webhookId} permanently failed after 3 retries`);
            await webhookRetryJob.handleAutoCancel(orderId);
          } else {
            const delays = [30, 120, 600];
            const nextDelay = delays[newRetryCount - 1] || 600;
            const nextRetryAt = new Date(Date.now() + nextDelay * 1000);
            
            await repo.incrementRetryCount(webhookId, nextRetryAt);
            logger.info(`⏳ Webhook ${webhookId} retry ${newRetryCount}/3 scheduled at ${nextRetryAt.toISOString()}`);
          }
        }
      }

      logger.info('✅ Webhook retry job completed');
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const stack = getErrorStack(error);
      logger.error({ error: message, stack }, '❌ Webhook retry job failed');
    }
  },

  async handleAutoCancel(orderId: string): Promise<void> {
    try {
      const result = await pool.query(
        `SELECT b.id, b.patient_id, b.doctor_id, b.branch_id, b.queue_number, b.created_at
         FROM bookings b
         LEFT JOIN invoices i ON b.id = i.booking_id
         WHERE i.invoice_number = $1 OR b.id = $1
         LIMIT 1`,
        [orderId]
      );
      if (result.rows.length === 0) return;

      const booking = result.rows[0];
      const hoursSinceCreation = (Date.now() - new Date(booking.created_at).getTime()) / (1000 * 60 * 60);

      if (hoursSinceCreation < 24) {
        logger.info(`⏳ Booking ${booking.id} is only ${hoursSinceCreation.toFixed(1)}h old, skipping auto-cancel`);
        return;
      }

      await pool.query(
        `UPDATE bookings 
         SET status = 'CANCELLED', 
             cancel_reason = 'payment_failure_timeout',
             updated_at = NOW()
         WHERE id = $1`,
        [booking.id]
      );

      logger.info(`✅ Booking ${booking.id} auto-cancelled due to payment failure timeout`);
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const stack = getErrorStack(error);
      logger.error({ error: message, stack }, 'Failed to auto-cancel booking');
    }
  }
};
