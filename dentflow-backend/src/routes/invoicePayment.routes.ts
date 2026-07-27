import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware';
import { InvoicePaymentHandler } from '../handlers/invoicePayment.handler';

const router = Router();
const handler = new InvoicePaymentHandler();

// GET /api/invoices/:id - Get invoice detail with history (authenticated)
router.get('/:id', authMiddleware, handler.getInvoice);

// PUT /api/invoices/:id/mark-paid - Admin only
router.put('/:id/mark-paid', authMiddleware, roleMiddleware(['ADMIN_BRANCH']), handler.markPaid);

export default router;
