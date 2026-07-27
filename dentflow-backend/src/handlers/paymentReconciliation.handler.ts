import { Request, Response } from 'express';
import { PaymentInputService } from '../services/paymentInput.service';
import { logger } from '../utils/logger';
import { getErrorMessage, getErrorStack } from '../utils/error.util';

export class PaymentReconciliationHandler {
  private service: PaymentInputService;

  constructor() {
    this.service = new PaymentInputService();
  }

  /**
   * GET /api/admin/payments/reconciliation
   * Admin endpoint to view payment reconciliation
   * Query params: date_from (YYYY-MM-DD), date_to (YYYY-MM-DD)
   */
  getReconciliation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { date_from, date_to } = req.query;
      const adminId = req.user?.userId;

      if (!adminId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      if (!date_from || !date_to || typeof date_from !== 'string' || typeof date_to !== 'string') {
        res.status(400).json({
          success: false,
          error: 'date_from and date_to are required (format: YYYY-MM-DD)',
        });
        return;
      }

      const summary = await this.service.getReconciliationSummary(date_from, date_to);

      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const stack = getErrorStack(error);
      logger.error({ error: message, stack });
      res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR', message: 'Server error' });
    }
  };
}
