import { Request, Response } from 'express';
import { PaymentWebhookService } from '../services/paymentWebhook.service';
import { logger } from '../utils/logger';

export class WebhookHandler {
  private service: PaymentWebhookService;

  constructor() {
    this.service = new PaymentWebhookService();
  }

  handleMidtransWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const payload = req.body;
      const signature = req.headers['x-midtrans-signature'] as string;

      if (!signature) {
        logger.warn('Missing signature header');
        res.status(400).json({ success: false, message: 'Missing signature' });
        return;
      }

      const webhookId = req.headers['x-midtrans-webhook-id'] as string || `webhook-${Date.now()}`;
      const orderId = payload.order_id || payload.transaction_id;

      if (!orderId) {
        logger.error('Missing order_id in payload');
        res.status(400).json({ success: false, message: 'Missing order_id' });
        return;
      }

      const serverKey = process.env.MIDTRANS_SERVER_KEY || '';

      const result = await this.service.processPaymentWebhook(
        webhookId,
        orderId,
        signature,
        payload,
        serverKey
      );

      if (result.success) {
        res.status(200).json({ success: true, message: result.message });
      } else {
        res.status(500).json({ success: false, message: result.message });
      }
    } catch (error: any) {
      logger.error({ error: error.message, stack: error.stack }, 'Webhook handler error');
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
}
