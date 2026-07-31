import { Request, Response } from 'express';
import { InvoiceService } from '../services/invoice.service';
import { logger } from '../utils/logger';
import { getErrorMessage, getErrorStack } from '../utils/error.util';

export class InvoiceHandler {
  constructor(private invoiceService: InvoiceService) {}

  markPaid = async (req: Request, res: Response): Promise<void> => {
    console.log("🔍 [markPaid] req.user:", JSON.stringify(req.user, null, 2));
    try {
      const invoiceId = req.params.id as string;
      const { payment_method, paid_amount, notes } = req.body;
      const adminId = req.user?.userId;

      if (!adminId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      if (!payment_method) {
        res.status(400).json({ success: false, error: 'payment_method is required' });
        return;
      }

      if (!paid_amount || paid_amount <= 0) {
        res.status(400).json({ success: false, error: 'paid_amount must be > 0' });
        return;
      }

      const invoice = await this.invoiceService.markPaid(
        invoiceId,
        adminId,
        payment_method,
        paid_amount,
        notes
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
      if (message === 'INVOICE_ALREADY_PAID') {
        res.status(409).json({ success: false, error: 'INVOICE_ALREADY_PAID', message: 'Invoice already paid' });
        return;
      }
      res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR', message: 'Server error' });
    }
  };

  undoPayment = async (req: Request, res: Response): Promise<void> => {
    try {
      const invoiceId = req.params.id as string;
      const adminId = req.user?.userId;
      const { reason } = req.body;

      if (!adminId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      if (!reason) {
        res.status(400).json({ success: false, error: 'reason is required' });
        return;
      }

      const invoice = await this.invoiceService.undoPayment(invoiceId, adminId, reason);

      res.status(200).json({
        success: true,
        data: invoice,
        message: 'Payment undone',
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const stack = getErrorStack(error);
      logger.error({ error: message, stack });

      if (message === 'INVOICE_NOT_FOUND') {
        res.status(404).json({ success: false, error: 'INVOICE_NOT_FOUND', message: 'Invoice not found' });
        return;
      }
      if (message === 'INVOICE_NOT_PAID') {
        res.status(400).json({ success: false, error: 'INVOICE_NOT_PAID', message: 'Invoice is not paid' });
        return;
      }
      res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR', message: 'Server error' });
    }
  };

  getInvoice = async (req: Request, res: Response): Promise<void> => {
    try {
      const invoiceId = req.params.id as string;
      const invoice = await this.invoiceService.getInvoiceById(invoiceId);

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
}
