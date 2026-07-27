import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware';
import { AdminWebhookHandler } from '../handlers/adminWebhook.handler';

const router = Router();
const handler = new AdminWebhookHandler();

// GET /api/admin/webhook-errors
router.get(
  '/webhook-errors',
  authMiddleware,
  roleMiddleware(['ADMIN_BRANCH']),
  handler.getErrors
);

// POST /api/admin/webhooks/:id/replay
router.post(
  '/webhooks/:id/replay',
  authMiddleware,
  roleMiddleware(['ADMIN_BRANCH']),
  handler.replayWebhook
);

export default router;
