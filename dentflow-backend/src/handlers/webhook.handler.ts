import { Request, Response } from 'express';
import { paymentWebhookService } from '../services/paymentWebhook.service';
import { logger } from '../utils/logger';
import { getErrorMessage, getErrorStack } from '../utils/error.util';

export const handleMidtransWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-midtrans-signature'] as string;
    const webhookId = req.headers['x-midtrans-webhook-id'] as string;

    if (!signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing signature',
      });
    }

    if (!webhookId) {
      return res.status(400).json({
        success: false,
        message: 'Missing webhook id',
      });
    }

    const payload = req.body;
    const orderId = payload.order_id || payload.orderId;
    const serverKey = process.env.MIDTRANS_SERVER_KEY || 'test-key';

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Missing order_id',
      });
    }

    const result = await paymentWebhookService.processPaymentWebhook(
      webhookId,
      orderId,
      signature,
      payload,
      serverKey
    );

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(403).json(result);
    }
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const stack = getErrorStack(error);
    logger.error({ error: message, stack }, 'Webhook handler error');
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
