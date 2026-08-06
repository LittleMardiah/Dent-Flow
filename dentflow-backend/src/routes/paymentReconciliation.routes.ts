import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware';
import { PaymentReconciliationHandler } from '../handlers/paymentReconciliation.handler';

const router = Router();
const handler = new PaymentReconciliationHandler();

// GET /api/payments/reconciliation?date=YYYY-MM-DD
router.get(
  '/reconciliation',
  authMiddleware,
  roleMiddleware(['ADMIN_BRANCH']),
  handler.getReconciliationByDate
);

// GET /api/payments/reconciliation/summary?date_from=...&date_to=...
router.get(
  '/reconciliation/summary',
  authMiddleware,
  roleMiddleware(['ADMIN_BRANCH']),
  handler.getReconciliationSummary
);

export default router;
