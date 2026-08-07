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
   * GET /api/payments/reconciliation?date=YYYY-MM-DD
   * Returns daily reconciliation data
   */
  getReconciliationByDate = async (req: Request, res: Response): Promise<void> => {
    try {
      const dateParam = req.query.date as string;
      if (!dateParam) {
        res.status(400).json({ success: false, message: 'date parameter required (YYYY-MM-DD)' });
        return;
      }
      const date = new Date(dateParam);
      if (isNaN(date.getTime())) {
        res.status(400).json({ success: false, message: 'Invalid date format' });
        return;
      }
      const data = await this.service.getReconciliation(date);
      res.status(200).json({ success: true, data });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const stack = getErrorStack(error);
      logger.error({ error: message, stack });
      res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR', message: 'Server error' });
    }
  };

  /**
   * GET /api/payments/reconciliation/summary?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
   * Returns summary reconciliation for date range
   */
  getReconciliationSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const dateFrom = req.query.date_from as string;
    const dateTo = req.query.date_to as string;
    if (!dateFrom || !dateTo) {
      res.status(400).json({ success: false, message: 'date_from and date_to required' });
      return;
    }
    const branchId = req.user?.branchId;
    if (!branchId) {
      res.status(400).json({ success: false, message: 'Branch ID not found' });
      return;
    }
    const data = await this.service.getReconciliationSummary(dateFrom, dateTo, branchId);
    res.status(200).json({ success: true, data });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const stack = getErrorStack(error);
    logger.error({ error: message, stack });
    res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR', message: 'Server error' });
    }
  };
}
