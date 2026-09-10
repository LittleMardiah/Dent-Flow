import { InvoiceGenerationService } from '../../../src/services/invoiceGeneration.service';
import { Pool } from 'pg';
import { auditService } from '../../../src/services/audit.service';

jest.mock('pg');
jest.mock('../../../src/services/audit.service');

describe('InvoiceGenerationService', () => {
  let service: InvoiceGenerationService;
  let mockPool: jest.Mocked<Pool>;
  let mockClient: any;

  beforeEach(() => {
    mockPool = new Pool() as jest.Mocked<Pool>;
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    mockPool.connect = jest.fn().mockResolvedValue(mockClient);

    service = new InvoiceGenerationService();
    (service as any).pool = mockPool;

    jest.clearAllMocks();
  });

  describe('getTreatmentPrice', () => {
    it('should return price on exact match', async () => {
      (mockPool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ price: 150000 }] });
      const result = await service.getTreatmentPrice('Scaling');
      expect(result).toBe(150000);
    });

    it('should return price on partial match', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ price: 200000 }] });
      const result = await service.getTreatmentPrice('Scaling Gigi');
      expect(result).toBe(200000);
    });

    it('should return 0 if no match found', async () => {
      (mockPool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
      const result = await service.getTreatmentPrice('Unknown');
      expect(result).toBe(0);
    });

    it('should return 0 if treatment is empty', async () => {
      const result = await service.getTreatmentPrice('');
      expect(result).toBe(0);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should return 0 on database error', async () => {
      (mockPool.query as jest.Mock).mockRejectedValue(new Error('DB_ERROR'));
      const result = await service.getTreatmentPrice('Scaling');
      expect(result).toBe(0);
    });
  });

  describe('generateInvoiceForEncounter', () => {
    const mockEncounterId = 'enc-123';
    const mockBranchId = 'branch-456';
    const mockTreatment = 'Scaling';
    const mockBookingId = 'book-789';
    const mockPatientId = 'patient-001';

    it('should generate new invoice successfully', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [{ price: 150000 }] });

      // Urutan: BEGIN, SELECT encounter, SELECT existing, SELECT dp, SELECT number, INSERT, COMMIT
      (mockClient.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: mockEncounterId, booking_id: mockBookingId, patient_id: mockPatientId, status: 'IN_PROGRESS' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ dp_amount: 50000 }] })
        .mockResolvedValueOnce({ rows: [{ invoice_number: 'INV-A-20260817-001' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'inv-001', invoice_number: 'INV-A-20260817-001', amount_due: 200000, status: 'UNPAID' }] })
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      (auditService.logEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await service.generateInvoiceForEncounter(
        mockEncounterId,
        mockBranchId,
        mockTreatment
      );

      expect(result).toHaveProperty('id', 'inv-001');
      expect(result).toHaveProperty('amount_due', 200000);
      expect(auditService.logEvent).toHaveBeenCalledTimes(1);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should update existing invoice if already exists', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [{ price: 150000 }] });

      // Urutan: BEGIN, SELECT encounter, SELECT existing (found), SELECT dp, UPDATE, COMMIT
      (mockClient.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: mockEncounterId, booking_id: mockBookingId, patient_id: mockPatientId }] })
        .mockResolvedValueOnce({ rows: [{ id: 'inv-001', invoice_number: 'INV-A-20260817-001', amount_due: 100000 }] }) // existing
        .mockResolvedValueOnce({ rows: [{ dp_amount: 50000 }] })
        .mockResolvedValueOnce({ rows: [] }) // UPDATE
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      (auditService.logEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await service.generateInvoiceForEncounter(
        mockEncounterId,
        mockBranchId,
        mockTreatment
      );

      expect(result).toHaveProperty('amount_due', 100000); // returns original invoice (not updated)
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE invoices\s+SET amount_due = \$1/),
        [200000, 'inv-001']
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw ENCOUNTER_NOT_FOUND if encounter not found', async () => {
      (mockClient.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] });

      await expect(service.generateInvoiceForEncounter(
        mockEncounterId,
        mockBranchId,
        mockTreatment
      )).rejects.toThrow('ENCOUNTER_NOT_FOUND');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should handle missing booking dp (default 0)', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [{ price: 150000 }] });

      (mockClient.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: mockEncounterId, booking_id: null, patient_id: mockPatientId }] })
        .mockResolvedValueOnce({ rows: [] }) // no existing
        // booking_id null → query dp_amount di-SKIP oleh service
        .mockResolvedValueOnce({ rows: [{ invoice_number: 'INV-A-20260817-001' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'inv-001', amount_due: 150000 }] })
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      (auditService.logEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await service.generateInvoiceForEncounter(
        mockEncounterId,
        mockBranchId,
        mockTreatment
      );

      expect(result.amount_due).toBe(150000);
    });

    it('should handle missing treatment (amount = dp only)', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      (mockClient.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: mockEncounterId, booking_id: mockBookingId, patient_id: mockPatientId }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ dp_amount: 50000 }] })
        .mockResolvedValueOnce({ rows: [{ invoice_number: 'INV-A-20260817-001' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'inv-001', amount_due: 50000 }] })
        .mockResolvedValueOnce({ rows: [] });

      (auditService.logEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await service.generateInvoiceForEncounter(
        mockEncounterId,
        mockBranchId,
        undefined
      );

      expect(result.amount_due).toBe(50000);
    });
  });

  describe('completeEncounterAndGenerateInvoice', () => {
    const mockEncounterId = 'enc-123';
    const mockDoctorId = 'doc-456';
    const mockBranchId = 'branch-789';
    const mockDiagnosis = 'Karies';
    const mockTreatment = 'Filling';
    const mockNotes = 'OK';

    it('should complete encounter and generate invoice', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [{ price: 200000 }] });

      const mockEncounter = { id: mockEncounterId, status: 'COMPLETED', completed_at: new Date() };
      const mockInvoice = { id: 'inv-001', invoice_number: 'INV-A-20260817-001', amount_due: 200000 };

      // Outer transaction: BEGIN, UPDATE encounter
      // Inner transaction (generateInvoiceForEncounter): BEGIN, SELECT encounter, SELECT existing, SELECT dp, SELECT number, INSERT, COMMIT
      // Outer: COMMIT
      (mockClient.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // outer BEGIN
        .mockResolvedValueOnce({ rows: [mockEncounter] }) // outer UPDATE
        .mockResolvedValueOnce({ rows: [] }) // inner BEGIN
        .mockResolvedValueOnce({ rows: [{ id: mockEncounterId, booking_id: null, patient_id: 'patient-001' }] })
        .mockResolvedValueOnce({ rows: [] }) // no existing
        // booking_id null → query dp_amount di-SKIP oleh service
        .mockResolvedValueOnce({ rows: [{ invoice_number: 'INV-A-20260817-001' }] })
        .mockResolvedValueOnce({ rows: [mockInvoice] })
        .mockResolvedValueOnce({ rows: [] }) // inner COMMIT
        .mockResolvedValueOnce({ rows: [] }); // outer COMMIT

      (auditService.logEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await service.completeEncounterAndGenerateInvoice(
        mockEncounterId,
        mockDoctorId,
        mockBranchId,
        mockDiagnosis,
        mockTreatment,
        mockNotes
      );

      expect(result.encounter).toHaveProperty('status', 'COMPLETED');
      expect(result.invoice).toHaveProperty('id', 'inv-001');
      expect(result.invoice).toHaveProperty('invoice_number', 'INV-A-20260817-001');
      expect(auditService.logEvent).toHaveBeenCalledTimes(2);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw ENCOUNTER_NOT_FOUND_OR_NOT_OWNED if update fails', async () => {
      (mockClient.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // UPDATE no rows

      await expect(service.completeEncounterAndGenerateInvoice(
        mockEncounterId,
        mockDoctorId,
        mockBranchId,
        mockDiagnosis,
        mockTreatment,
        mockNotes
      )).rejects.toThrow('ENCOUNTER_NOT_FOUND_OR_NOT_OWNED');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });
});
