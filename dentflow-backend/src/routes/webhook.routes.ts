import { Router } from 'express';
import { handleMidtransWebhook } from '../handlers/webhook.handler';

const router = Router();

// POST /webhooks/midtrans - Midtrans webhook endpoint (no auth)
router.post('/midtrans', handleMidtransWebhook);

export default router;
