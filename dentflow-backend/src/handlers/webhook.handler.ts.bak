import { Request, Response } from 'express';
import { paymentWebhookService } from '../services/paymentWebhook.service';
import { logger } from '../utils/logger';

export const handleMidtransWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-midtrans-signature'] as string;
    if (!signature) {
      return res.status(400).json({ success: false, message: 'Missing signature' });
    }

    const webhookId = req.headers['x-midtrans-webhook-id'] as string;
    const payload = req.body;
    const serverKey = process.env.MIDTRANS_SERVER_KEY || 'test-key';

    // ✅ PASTIKAN grossAmount dan statusCode STRING
    const statusCode = String(payload.status_code || '');
    const grossAmount = String(payload.gross_amount || '0');
    const orderId = String(payload.order_id || '');

    const isValid = await paymentWebhookService.validateMidtransSignature(
      orderId,
      statusCode,
      grossAmount,
      signature,
      serverKey
    );

    if (!isValid) {
      return res.status(403).json({ success: false, message: 'Invalid signature' });
    }

    const result = await paymentWebhookService.processPaymentWebhook(
      webhookId,
      orderId,
      signature,
      payload,
      serverKey
    );

    if (result.message && result.message.includes('idempotent')) {
      return res.status(200).json({ success: true, message: 'Webhook already processed (idempotent)' });
    }

    return res.status(200).json({ success: true, message: 'Webhook processed successfully' });
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, 'Webhook handler error');
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};
