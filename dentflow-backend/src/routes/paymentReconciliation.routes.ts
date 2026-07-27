import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware';
import { PaymentReconciliationHandler } from '../handlers/paymentReconciliation.handler';

const router = Router();
const handler = new PaymentReconciliationHandler();

// GET /api/admin/payments/reconciliation - Admin only
router.get(
  '/',
  authMiddleware,
  roleMiddleware(['ADMIN_BRANCH']),
  handler.getReconciliation
);

export default router;
