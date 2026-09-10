import { InvoiceService } from '../../../src/services/invoice.service';
import { Pool } from 'pg';
import { auditService } from '../../../src/services/audit.service';
import { InvoiceStateValidator } from '../../../src/services/invoiceStateValidator.service';

jest.mock('pg');
jest.mock('../../../src/services/audit.service');

describe('InvoiceService', () => {
  let service: InvoiceService;
  let mockPool: jest.Mocked<Pool>;
  let mockClient: any;

  beforeEach(() => {
    mockPool = new Pool() as jest.Mocked<Pool>;
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    mockPool.connect = jest.fn().mockResolvedValue(mockClient);

    service = new InvoiceService();
    (service as any).pool = mockPool;

    jest.clearAllMocks();
  });

  describe('markPaid', () => {
    const mockInvoiceId = 'inv-123';
    const mockAdminId = 'admin-456';
    const mockPaymentMethod = 'CASH';
    const mockPaidAmount = 150000;

    it('should mark UNPAID invoice as PAID successfully', async () => {
      // Urutan query: BEGIN, SELECT FOR UPDATE, UPDATE, COMMIT
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: mockInvoiceId, status: 'UNPAID', payment_status: 'UNPAID', branch_id: 'branch-789' }] }) // SELECT
        .mockResolvedValueOnce({ rows: [{ id: mockInvoiceId, status: 'PAID', payment_status: 'PAID', paid_at: new Date(), amount_paid: mockPaidAmount, paid_amount: mockPaidAmount, payment_method: mockPaymentMethod }] }) // UPDATE
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      (auditService.logEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await service.markPaid(
        mockInvoiceId,
        mockAdminId,
        mockPaymentMethod,
        mockPaidAmount
      );

      expect(result).toHaveProperty('status', 'PAID');
      expect(result).toHaveProperty('amount_paid', mockPaidAmount);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(auditService.logEvent).toHaveBeenCalledTimes(1);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return existing invoice if already PAID (idempotent)', async () => {
      const paidInvoice = { id: mockInvoiceId, status: 'PAID', payment_status: 'PAID', branch_id: 'branch-789' };
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [paidInvoice] }) // SELECT
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await service.markPaid(
        mockInvoiceId,
        mockAdminId,
        mockPaymentMethod,
        mockPaidAmount
      );

      expect(result).toEqual(paidInvoice);
      expect(mockClient.query).toHaveBeenCalledTimes(3); // BEGIN, SELECT, COMMIT
      expect(auditService.logEvent).not.toHaveBeenCalled();
    });

    it('should throw INVOICE_NOT_FOUND if invoice does not exist', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // SELECT (empty)

      await expect(service.markPaid(
        mockInvoiceId,
        mockAdminId,
        mockPaymentMethod,
        mockPaidAmount
      )).rejects.toThrow('INVOICE_NOT_FOUND');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw INVALID_STATE_TRANSITION if transition not allowed', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: mockInvoiceId, status: 'REFUNDED', payment_status: 'REFUNDED', branch_id: 'branch-789' }] }); // SELECT

      await expect(service.markPaid(
        mockInvoiceId,
        mockAdminId,
        mockPaymentMethod,
        mockPaidAmount
      )).rejects.toThrow('INVALID_STATE_TRANSITION');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback on database error', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: mockInvoiceId, status: 'UNPAID', branch_id: 'branch-789' }] }) // SELECT
        .mockRejectedValue(new Error('DB_ERROR')); // UPDATE fails

      await expect(service.markPaid(
        mockInvoiceId,
        mockAdminId,
        mockPaymentMethod,
        mockPaidAmount
      )).rejects.toThrow('DB_ERROR');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('undoPayment', () => {
    const mockInvoiceId = 'inv-123';
    const mockAdminId = 'admin-456';
    const mockReason = 'Wrong amount';

    it('should undo PAID invoice to UNPAID successfully', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: mockInvoiceId, status: 'PAID', branch_id: 'branch-789' }] }) // SELECT
        .mockResolvedValueOnce({ rows: [{ id: mockInvoiceId, status: 'UNPAID', payment_status: 'UNPAID', paid_at: null, amount_paid: 0, paid_amount: null }] }) // UPDATE
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      (auditService.logEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await service.undoPayment(mockInvoiceId, mockAdminId, mockReason);

      expect(result).toHaveProperty('status', 'UNPAID');
      expect(result).toHaveProperty('amount_paid', 0);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(auditService.logEvent).toHaveBeenCalledTimes(1);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw INVOICE_NOT_FOUND if invoice does not exist', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // SELECT (empty)

      await expect(service.undoPayment(mockInvoiceId, mockAdminId, mockReason))
        .rejects.toThrow('INVOICE_NOT_FOUND');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw INVOICE_NOT_PAID if invoice is not PAID', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: mockInvoiceId, status: 'UNPAID' }] }); // SELECT

      await expect(service.undoPayment(mockInvoiceId, mockAdminId, mockReason))
        .rejects.toThrow('INVOICE_NOT_PAID');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback on database error', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: mockInvoiceId, status: 'PAID', branch_id: 'branch-789' }] }) // SELECT
        .mockRejectedValue(new Error('DB_ERROR')); // UPDATE fails

      await expect(service.undoPayment(mockInvoiceId, mockAdminId, mockReason))
        .rejects.toThrow('DB_ERROR');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getInvoiceById', () => {
    const mockInvoiceId = 'inv-123';

    it('should return invoice if found', async () => {
      const invoice = { id: mockInvoiceId, status: 'UNPAID', amount_due: 200000 };
      mockPool.query = jest.fn().mockResolvedValue({ rows: [invoice] });

      const result = await service.getInvoiceById(mockInvoiceId);

      expect(result).toEqual(invoice);
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM invoices WHERE id = $1',
        [mockInvoiceId]
      );
    });

    it('should throw INVOICE_NOT_FOUND if invoice not found', async () => {
      mockPool.query = jest.fn().mockResolvedValue({ rows: [] });

      await expect(service.getInvoiceById(mockInvoiceId))
        .rejects.toThrow('INVOICE_NOT_FOUND');

      expect(mockPool.query).toHaveBeenCalled();
    });
  });
});
