import { webhookRetryJob } from '../../../src/jobs/webhookRetry.job';
import { PaymentWebhookRepository } from '../../../src/repositories/paymentWebhook.repository';
import { PaymentWebhookService } from '../../../src/services/paymentWebhook.service';
import { pool } from '../../../src/config/database';

// Mock dependencies
jest.mock('../../../src/repositories/paymentWebhook.repository');
jest.mock('../../../src/services/paymentWebhook.service');
jest.mock('../../../src/config/database');

describe('WebhookRetryJob', () => {
  let mockRepo: jest.Mocked<PaymentWebhookRepository>;
  let mockService: jest.Mocked<PaymentWebhookService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo = new PaymentWebhookRepository() as jest.Mocked<PaymentWebhookRepository>;
    mockService = new PaymentWebhookService() as jest.Mocked<PaymentWebhookService>;

    // Override the constructors to return mocks
    (PaymentWebhookRepository as jest.Mock).mockImplementation(() => mockRepo);
    (PaymentWebhookService as jest.Mock).mockImplementation(() => mockService);

    // Mock pool.query to avoid real DB calls
    (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
  });

  it('should process pending retries', async () => {
    const pending = [
      { webhook_id: 'w1', order_id: 'INV-1', payload: {}, retry_count: 0 },
    ];
    mockRepo.getPendingRetries.mockResolvedValue(pending);
    mockRepo.deleteErrorRecord.mockResolvedValue();
    mockService.processPaymentWebhook.mockResolvedValue({ success: true, message: 'OK' });

    await webhookRetryJob.execute();

    expect(mockRepo.getPendingRetries).toHaveBeenCalled();
    expect(mockService.processPaymentWebhook).toHaveBeenCalledWith(
      'w1',
      'INV-1',
      '',
      {},
      expect.any(String)
    );
    expect(mockRepo.deleteErrorRecord).toHaveBeenCalledWith('w1');
  });

  it('should increment retry count on failure', async () => {
    const pending = [
      { webhook_id: 'w2', order_id: 'INV-2', payload: {}, retry_count: 0 },
    ];
    mockRepo.getPendingRetries.mockResolvedValue(pending);
    mockRepo.incrementRetryCount.mockResolvedValue();
    mockService.processPaymentWebhook.mockResolvedValue({ success: false, message: 'Error' });

    await webhookRetryJob.execute();

    expect(mockRepo.incrementRetryCount).toHaveBeenCalledWith('w2', expect.any(Date));
  });

  it('should mark permanently failed after 3 retries', async () => {
    const pending = [
      { webhook_id: 'w3', order_id: 'INV-3', payload: {}, retry_count: 2 },
    ];
    mockRepo.getPendingRetries.mockResolvedValue(pending);
    mockRepo.markPermanentlyFailed.mockResolvedValue();
    mockService.processPaymentWebhook.mockResolvedValue({ success: false, message: 'Error' });

    await webhookRetryJob.execute();

    expect(mockRepo.markPermanentlyFailed).toHaveBeenCalledWith('w3');
  });

  it('should handle empty pending retries', async () => {
    mockRepo.getPendingRetries.mockResolvedValue([]);
    await webhookRetryJob.execute();
    expect(mockService.processPaymentWebhook).not.toHaveBeenCalled();
  });
});
