import { InvoiceStateRepository } from '../repositories/invoiceState.repository';
import { auditService } from './audit.service';
import { AuditEventType } from '../models/audit.model';
import { logger } from '../utils/logger';

export class InvoicePaymentService {
  private repo: InvoiceStateRepository;

  constructor() {
    this.repo = new InvoiceStateRepository();
  }

  /**
   * Mark invoice as paid (for admin or webhook)
   * Idempotent: if already PAID, returns success
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
      // Get current invoice state
      const invoice = await this.repo.getInvoiceWithHistory(invoiceId);
      if (invoice.status === 'PAID') {
        logger.info(`Invoice ${invoiceId} already paid (idempotent)`);
        return invoice;
      }

      // Perform transition
      await this.repo.transitionState(
        invoiceId,
        'UNPAID',
        'PAID',
        `Payment via ${paymentMethod} (${transactionId})`,
        paymentMethod,
        transactionId,
        amount || invoice.amount_due
      );

      // Audit log
      await auditService.logEvent({
        branchId,
        userId: userId || 'system',
        eventType: AuditEventType.INVOICE_MARKED_PAID,
        entityType: 'INVOICE',
        entityId: invoiceId,
        description: `Invoice ${invoiceId} marked as PAID via ${paymentMethod}`,
        newValues: {
          status: 'PAID',
          payment_method: paymentMethod,
          paid_at: new Date().toISOString(),
        },
        oldValues: {
          status: 'UNPAID',
        },
      });

      // Get updated invoice with history
      return await this.repo.getInvoiceWithHistory(invoiceId);
    } catch (error: any) {
      logger.error({ error: error.message, stack: error.stack }, 'Failed to mark invoice as paid');
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
