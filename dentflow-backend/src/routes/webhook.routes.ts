import { Router } from 'express';
import { WebhookHandler } from '../handlers/webhook.handler';

const router = Router();
const webhookHandler = new WebhookHandler();

// POST /webhooks/midtrans - Midtrans webhook endpoint (no auth)
router.post('/midtrans', webhookHandler.handleMidtransWebhook);

export default router;
