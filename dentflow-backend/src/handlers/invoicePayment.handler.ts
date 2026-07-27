import { Request, Response } from 'express';
import { InvoicePaymentService } from '../services/invoicePayment.service';
import { logger } from '../utils/logger';
import { getErrorMessage, getErrorStack } from '../utils/error.util';

export class InvoicePaymentHandler {
  private service: InvoicePaymentService;

  constructor() {
    this.service = new InvoicePaymentService();
  }

  /**
   * GET /api/invoices/:id
   * Get invoice detail with payment history
   */
  getInvoice = async (req: Request, res: Response): Promise<void> => {
    try {
      const invoiceId = req.params.id as string;
      const invoice = await this.service.getInvoiceDetail(invoiceId);
      res.status(200).json({
        success: true,
        data: invoice,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const stack = getErrorStack(error);
      logger.error({ error: message, stack });
      if (message === 'INVOICE_NOT_FOUND') {
        res.status(404).json({ success: false, error: 'INVOICE_NOT_FOUND', message: 'Invoice not found' });
        return;
      }
      res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR', message: 'Server error' });
    }
  };

  /**
   * PUT /api/invoices/:id/mark-paid
   * Admin/system endpoint to mark invoice as paid
   * Idempotent: returns success if already PAID
   */
  markPaid = async (req: Request, res: Response): Promise<void> => {
    try {
      const invoiceId = req.params.id as string;
      const { payment_method, transaction_id, amount } = req.body;
      const adminId = req.user?.userId;
      const branchId = req.user?.branchId;

      if (!adminId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      if (!payment_method) {
        res.status(400).json({ success: false, error: 'payment_method is required' });
        return;
      }

      const invoice = await this.service.markInvoicePaid(
        invoiceId,
        payment_method,
        transaction_id || `manual-${Date.now()}`,
        branchId || 'system',
        amount,
        adminId
      );

      res.status(200).json({
        success: true,
        data: invoice,
        message: 'Invoice marked as paid',
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const stack = getErrorStack(error);
      logger.error({ error: message, stack });
      if (message === 'INVOICE_NOT_FOUND') {
        res.status(404).json({ success: false, error: 'INVOICE_NOT_FOUND', message: 'Invoice not found' });
        return;
      }
      if (message === 'INVALID_TRANSITION' || message === 'TRANSITION_FAILED') {
        res.status(409).json({ success: false, error: 'INVALID_TRANSITION', message: 'Invalid state transition' });
        return;
      }
      res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR', message: 'Server error' });
    }
  };
}
