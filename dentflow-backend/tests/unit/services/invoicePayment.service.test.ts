import { InvoicePaymentService } from '../../../src/services/invoicePayment.service';
import { InvoiceStateRepository } from '../../../src/repositories/invoiceState.repository';
import { auditService } from '../../../src/services/audit.service';

jest.mock('../../../src/repositories/invoiceState.repository');
jest.mock('../../../src/services/audit.service');

describe('InvoicePaymentService', () => {
  let service: InvoicePaymentService;
  let mockRepo: jest.Mocked<InvoiceStateRepository>;

  beforeEach(() => {
    mockRepo = new InvoiceStateRepository() as jest.Mocked<InvoiceStateRepository>;
    service = new InvoicePaymentService();
    (service as any).repo = mockRepo;
    jest.clearAllMocks();
  });

  it('should mark invoice as paid (UNPAID → PAID)', async () => {
    const invoice = { id: 'inv-1', status: 'UNPAID', amount_due: 100000 };
    const updatedInvoice = { ...invoice, status: 'PAID', paid_at: new Date() };

    // Mock untuk dua pemanggilan getInvoiceWithHistory
    mockRepo.getInvoiceWithHistory
      .mockResolvedValueOnce(invoice)   // pertama: sebelum update
      .mockResolvedValueOnce(updatedInvoice); // kedua: setelah update

    mockRepo.transitionState.mockResolvedValue();

    const result = await service.markInvoicePaid('inv-1', 'CASH', 'txn-123', 'branch-1', 100000, 'admin-1');
    expect(result.status).toBe('PAID');
    expect(mockRepo.transitionState).toHaveBeenCalled();
    expect(auditService.logEvent).toHaveBeenCalled();
  });

  it('should be idempotent (already PAID)', async () => {
    const invoice = { id: 'inv-1', status: 'PAID', amount_due: 100000 };
    mockRepo.getInvoiceWithHistory.mockResolvedValue(invoice);

    const result = await service.markInvoicePaid('inv-1', 'CASH', 'txn-123', 'branch-1', 100000, 'admin-1');
    expect(result.status).toBe('PAID');
    expect(mockRepo.transitionState).not.toHaveBeenCalled();
  });

  it('should throw error for invalid transition', async () => {
    const invoice = { id: 'inv-1', status: 'UNPAID', amount_due: 100000 };
    mockRepo.getInvoiceWithHistory.mockResolvedValue(invoice);
    mockRepo.transitionState.mockRejectedValue(new Error('INVALID_TRANSITION'));

    await expect(service.markInvoicePaid('inv-1', 'CASH', 'txn-123', 'branch-1', 100000, 'admin-1'))
      .rejects.toThrow('INVALID_TRANSITION');
  });

  it('should get invoice detail with history', async () => {
    const invoice = { id: 'inv-1', status: 'PAID', payment_history: [] };
    mockRepo.getInvoiceWithHistory.mockResolvedValue(invoice);

    const result = await service.getInvoiceDetail('inv-1');
    expect(result).toEqual(invoice);
  });

  it('should handle invoice not found', async () => {
    mockRepo.getInvoiceWithHistory.mockRejectedValue(new Error('INVOICE_NOT_FOUND'));

    await expect(service.markInvoicePaid('inv-1', 'CASH', 'txn-123', 'branch-1', 100000, 'admin-1'))
      .rejects.toThrow('INVOICE_NOT_FOUND');
  });
});
