import { InvoiceStateRepository } from '../repositories/invoiceState.repository';
import { auditService } from './audit.service';
import { AuditEventType } from '../models/audit.model';
import { logger } from '../utils/logger';
import { invoiceStateMachineService } from './invoiceStateMachine.service';
import { getErrorMessage, getErrorStack } from '../utils/error.util';

export class InvoicePaymentService {
  private repo: InvoiceStateRepository;

  constructor() {
    this.repo = new InvoiceStateRepository();
  }

  /**
   * Mark invoice as paid (for admin or webhook)
   * Now uses centralized InvoiceStateMachineService
   */
  async markInvoicePaid(
    invoiceId: string,
    paymentMethod: string,
    transactionId: string,
    branchId: string,
    amount?: number,
    userId?: string
  ): Promise<any> {
    try {
      // Check current state (idempotency)
      const current = await this.repo.getInvoiceWithHistory(invoiceId);
      if (current.status === 'PAID') {
        logger.info(`Invoice ${invoiceId} already paid (idempotent)`);
        return current;
      }

      const paidAmount = amount || current.amount_due;

      return await invoiceStateMachineService.transitionToPaid({
        invoiceId,
        paymentMethod,
        amount: paidAmount,
        branchId,
        userId: userId || undefined,
        transactionId,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const stack = getErrorStack(error);
      logger.error({ error: message, stack }, 'Failed to mark invoice as paid');
      throw error;
    }
  }

  /**
   * Get invoice detail with history
   */
  async getInvoiceDetail(invoiceId: string): Promise<any> {
    return this.repo.getInvoiceWithHistory(invoiceId);
  }
}
