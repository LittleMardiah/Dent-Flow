import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware';
import {
  getInvoiceSummary,
  getInvoiceList,
  getInvoiceDetail,
  addInvoicePayment,
} from '../handlers/invoiceWeb.handler';

const router = Router();

// Web finance page (admin/doctor invoice access)
router.use(authMiddleware, roleMiddleware(['ADMIN_BRANCH', 'DOCTOR']));

// GET /api/invoices/summary?branchId=...
router.get('/summary', getInvoiceSummary);

// GET /api/invoices?branchId=&status=&...
router.get('/', getInvoiceList);

// GET /api/invoices/:id
router.get('/:id', getInvoiceDetail);

// POST /api/invoices/:id/payments
router.post('/:id/payments', addInvoicePayment);

export default router;