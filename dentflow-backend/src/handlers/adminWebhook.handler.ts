import { Request, Response } from 'express';
import { PaymentWebhookRepository } from '../repositories/paymentWebhook.repository';
import { PaymentWebhookService } from '../services/paymentWebhook.service';
import { logger } from '../utils/logger';
import { getErrorMessage, getErrorStack } from '../utils/error.util';

export class AdminWebhookHandler {
  private repo: PaymentWebhookRepository;
  private service: PaymentWebhookService;

  constructor() {
    this.repo = new PaymentWebhookRepository();
    this.service = new PaymentWebhookService();
  }

  getErrors = async (req: Request, res: Response): Promise<void> => {
    try {
      const adminId = req.user?.userId;
      if (!adminId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { status } = req.query;
      const errors = await this.repo.getWebhookErrors(status as string);

      res.status(200).json({
        success: true,
        data: errors,
        count: errors.length,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const stack = getErrorStack(error);
      logger.error({ error: message, stack });
      res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR', message: 'Server error' });
    }
  };

  replayWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const webhookId = req.params.id as string;
      const adminId = req.user?.userId;

      console.log(`🔍 [REPLAY] Looking for error record with webhook_id: ${webhookId}`);

      if (!adminId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const errorRecord = await this.repo.getErrorByWebhookId(webhookId);
      console.log(`🔍 [REPLAY] Error record found:`, errorRecord);

      if (!errorRecord) {
        res.status(404).json({ success: false, error: 'WEBHOOK_NOT_FOUND', message: 'Webhook error record not found' });
        return;
      }

      if (errorRecord.webhook_status === 'PROCESSED') {
        res.status(409).json({ success: false, error: 'ALREADY_PROCESSED', message: 'Webhook already processed' });
        return;
      }

      // 🔥 Fix: skipValidation = true karena signature tidak perlu divalidasi ulang di replay
      const result = await this.service.processPaymentWebhook(
        webhookId,
        errorRecord.order_id,
        '',
        errorRecord.payload,
        process.env.MIDTRANS_SERVER_KEY || '',
        true  // skipValidation = true
      );

      if (result.success) {
        await this.repo.deleteErrorRecord(webhookId);
        logger.info(`✅ Manual replay succeeded for webhook ${webhookId} by admin ${adminId}`);
        res.status(200).json({
          success: true,
          message: 'Webhook replayed successfully',
        });
      } else {
        const nextRetry = new Date(Date.now() + 60 * 1000);
        await this.repo.incrementRetryCount(webhookId, nextRetry);
        logger.warn(`⚠️ Manual replay failed for webhook ${webhookId} by admin ${adminId}`);
        res.status(500).json({
          success: false,
          message: `Manual replay failed: ${result.message}`,
        });
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const stack = getErrorStack(error);
      logger.error({ error: message, stack });
      res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR', message: 'Server error' });
    }
  };
}
