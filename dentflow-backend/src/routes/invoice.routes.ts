import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware';
import { InvoiceHandler } from '../handlers/invoice.handler';
import { InvoiceService } from '../services/invoice.service';

const router = Router();
const invoiceService = new InvoiceService();
const invoiceHandler = new InvoiceHandler(invoiceService);

// All routes require admin authentication
router.use(authMiddleware, roleMiddleware(['ADMIN_BRANCH']));

// GET /api/admin/invoices/:id - Get invoice detail
router.get('/:id', invoiceHandler.getInvoice);

// POST /api/admin/invoices/:id/mark-paid - Mark invoice as paid
router.post('/:id/mark-paid', invoiceHandler.markPaid);

// POST /api/admin/invoices/:id/undo-payment - Undo payment (admin override)
router.post('/:id/undo-payment', invoiceHandler.undoPayment);

export default router;
