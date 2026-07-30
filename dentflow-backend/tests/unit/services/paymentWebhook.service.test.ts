import { PaymentWebhookService } from '../../../src/services/paymentWebhook.service';
import { PaymentWebhookRepository } from '../../../src/repositories/paymentWebhook.repository';
import { InvoiceService } from '../../../src/services/invoice.service';
import crypto from 'crypto';

jest.mock('../../../src/repositories/paymentWebhook.repository');
jest.mock('../../../src/services/invoice.service');

describe('PaymentWebhookService', () => {
  let service: PaymentWebhookService;
  let mockRepo: jest.Mocked<PaymentWebhookRepository>;
  let mockInvoice: jest.Mocked<InvoiceService>;

  const serverKey = 'test-key';
  const orderId = 'INV-001';
  const transactionId = 'txn-123';
  const statusCode = '200';
  const grossAmount = '100000';

  // ============================================================
  // SIGNATURE GENERATION - STANDAR MIDTRANS (SHA256)
  // Formula: SHA256(order_id + status_code + gross_amount + server_key)
  // ============================================================
  const validSignature = crypto
    .createHash('sha256')
    .update(orderId + statusCode + grossAmount + serverKey)
    .digest('hex');

  const payload = {
    order_id: orderId,
    transaction_id: transactionId,
    status_code: statusCode,
    gross_amount: grossAmount,
  };
  const payloadStr = JSON.stringify(payload);

  beforeEach(() => {
    mockRepo = new PaymentWebhookRepository() as jest.Mocked<PaymentWebhookRepository>;
    mockInvoice = new InvoiceService() as jest.Mocked<InvoiceService>;
    service = new PaymentWebhookService();
    (service as any).repo = mockRepo;
    (service as any).invoiceService = mockInvoice;
  });

  it('should validate Midtrans signature correctly', () => {
    const result = service.validateMidtransSignature(
      orderId,
      statusCode,
      grossAmount,
      validSignature,
      serverKey
    );
    expect(result).toBe(true);
  });

  it('should reject invalid signature', () => {
    const result = service.validateMidtransSignature(
      orderId,
      statusCode,
      grossAmount,
      'invalid',
      serverKey
    );
    expect(result).toBe(false);
  });

  it('should return already processed if webhook is idempotent', async () => {
    mockRepo.isWebhookProcessed.mockResolvedValue(true);

    const result = await service.processPaymentWebhook(
      'txn-1',
      orderId,
      validSignature,
      payload,
      serverKey
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain('idempotent');
  });

  it('should process valid webhook and mark invoice as paid', async () => {
    mockRepo.isWebhookProcessed.mockResolvedValue(false);
    mockRepo.recordWebhook.mockResolvedValue();
    mockRepo.updateStatus.mockResolvedValue();

    // Mock invoice lookup
    const mockInvoiceResult = { rows: [{ id: 'inv-1', amount_due: 100000 }] };
    (mockRepo as any).pool = { query: jest.fn().mockResolvedValue(mockInvoiceResult) };
    mockInvoice.markPaid.mockResolvedValue({ id: 'inv-1' });

    const result = await service.processPaymentWebhook(
      'txn-1',
      orderId,
      validSignature,
      payload,
      serverKey
    );
    expect(result.success).toBe(true);
    expect(mockInvoice.markPaid).toHaveBeenCalled();
  });

  it('should handle errors and schedule retry', async () => {
    mockRepo.isWebhookProcessed.mockResolvedValue(false);
    mockRepo.recordWebhook.mockResolvedValue();
    mockRepo.updateStatus.mockResolvedValue();
    mockRepo.createErrorRecord.mockResolvedValue();

    // Simulate DB error
    (mockRepo as any).pool = { query: jest.fn().mockRejectedValue(new Error('DB error')) };

    const result = await service.processPaymentWebhook(
      'txn-1',
      orderId,
      validSignature,
      payload,
      serverKey
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe('DB error');
    expect(mockRepo.updateStatus).toHaveBeenCalledWith('txn-1', 'FAILED');
    expect(mockRepo.createErrorRecord).toHaveBeenCalled();
  });
});
