import { InvoiceStateMachineService } from '../../../src/services/invoiceStateMachine.service';
import { Pool } from 'pg';
import { auditService } from '../../../src/services/audit.service';
import { InvoiceStateValidator } from '../../../src/services/invoiceStateValidator.service';

jest.mock('pg');
jest.mock('../../../src/services/audit.service');
jest.mock('../../../src/services/invoiceStateValidator.service');

describe('InvoiceStateMachineService', () => {
  let service: InvoiceStateMachineService;
  let mockPool: jest.Mocked<Pool>;
  let mockClient: any;

  beforeEach(() => {
    mockPool = new Pool() as jest.Mocked<Pool>;
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    mockPool.connect = jest.fn().mockResolvedValue(mockClient);

    service = new InvoiceStateMachineService();
    (service as any).pool = mockPool;

    jest.clearAllMocks();
    (InvoiceStateValidator.validateTransition as jest.Mock).mockReturnValue(true);
  });

  describe('transitionToPaid', () => {
    const mockOptions = {
      invoiceId: 'inv-123',
      paymentMethod: 'GATEWAY',
      amount: 150000,
      branchId: 'branch-789',
      userId: 'user-456',
      transactionId: 'txn-001',
      notes: 'test',
    };

    it('should transition UNPAID to PAID successfully', async () => {
      const mockInvoice = {
        id: 'inv-123',
        status: 'UNPAID',
        payment_status: 'UNPAID',
        paid_at: null,
        amount_paid: 0,
        paid_amount: 0,
        payment_method: null,
      };
      const mockUpdatedInvoice = {
        ...mockInvoice,
        status: 'PAID',
        payment_status: 'PAID',
        paid_at: new Date(),
        amount_paid: 150000,
        paid_amount: 150000,
        payment_method: 'GATEWAY',
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockInvoice] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rows: [mockUpdatedInvoice] }) // UPDATE
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      (InvoiceStateValidator.validateTransition as jest.Mock).mockReturnValue(true);
      (auditService.logEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await service.transitionToPaid(mockOptions);

      expect(result).toEqual(mockUpdatedInvoice);
      expect(mockClient.query).toHaveBeenCalledTimes(4);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(auditService.logEvent).toHaveBeenCalledTimes(1);
    });

    it('should return existing invoice if already PAID (idempotent)', async () => {
      const mockInvoice = {
        id: 'inv-123',
        status: 'PAID',
        payment_status: 'PAID',
        paid_at: new Date(),
        amount_paid: 150000,
        paid_amount: 150000,
        payment_method: 'GATEWAY',
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockInvoice] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await service.transitionToPaid(mockOptions);

      expect(result).toEqual(mockInvoice);
      expect(mockClient.query).toHaveBeenCalledTimes(3); // BEGIN, SELECT, COMMIT
      expect(mockClient.query).not.toHaveBeenCalledWith(
        expect.stringContaining('UPDATE invoices')
      );
      expect(auditService.logEvent).not.toHaveBeenCalled();
    });

    it('should throw INVOICE_NOT_FOUND if invoice not found', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // SELECT FOR UPDATE

      await expect(service.transitionToPaid(mockOptions)).rejects.toThrow('INVOICE_NOT_FOUND');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should throw INVALID_STATE_TRANSITION if transition not allowed', async () => {
      const mockInvoice = {
        id: 'inv-123',
        status: 'PARTIAL',
        payment_status: 'PARTIAL',
        paid_at: new Date(),
        amount_paid: 50000,
        paid_amount: 50000,
        payment_method: null,
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockInvoice] }); // SELECT FOR UPDATE

      (InvoiceStateValidator.validateTransition as jest.Mock).mockReturnValue(false);

      await expect(service.transitionToPaid(mockOptions)).rejects.toThrow('INVALID_STATE_TRANSITION');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should rollback on database error', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValue(new Error('DB_ERROR'));

      await expect(service.transitionToPaid(mockOptions)).rejects.toThrow('DB_ERROR');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });
});
