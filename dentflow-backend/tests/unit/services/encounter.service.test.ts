import { EncounterService } from '../../../src/services/encounter.service';
import { Pool } from 'pg';
import { auditService } from '../../../src/services/audit.service';
import { InvoiceGenerationService } from '../../../src/services/invoiceGeneration.service';

jest.mock('pg');
jest.mock('../../../src/services/audit.service');
jest.mock('../../../src/services/invoiceGeneration.service');

describe('EncounterService', () => {
  let service: EncounterService;
  let mockPool: jest.Mocked<Pool>;
  let mockInvoiceService: jest.Mocked<InvoiceGenerationService>;

  beforeEach(() => {
    mockPool = new Pool() as jest.Mocked<Pool>;
    mockInvoiceService = new InvoiceGenerationService() as jest.Mocked<InvoiceGenerationService>;
    service = new EncounterService();
    (service as any).pool = mockPool;
    (service as any).invoiceService = mockInvoiceService;
    jest.clearAllMocks();
  });

  describe('startEncounter', () => {
    it('should create encounter from booking with CHECKED_IN status', async () => {
      const mockBooking = { id: 'b1', pasien_id: 'p1', status: 'CHECKED_IN', branch_id: 'A' };
      const mockEncounter = { id: 'enc1', booking_id: 'b1', patient_id: 'p1', doctor_id: 'doc1', branch_id: 'A', status: 'ONGOING', started_at: new Date() };
      
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockBooking] }) // SELECT booking
          .mockResolvedValueOnce({ rows: [] }) // SELECT existing encounter
          .mockResolvedValueOnce({ rows: [mockEncounter] }) // INSERT encounter
          .mockResolvedValueOnce(undefined), // COMMIT
        release: jest.fn(),
      };
      (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);
      (auditService.logEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await service.startEncounter('b1', 'doc1', 'A');
      expect(result.id).toBe('enc1');
      expect(result.status).toBe('ONGOING');
      expect(auditService.logEvent).toHaveBeenCalled();
    });

    it('should throw error if booking not found', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [] }), // SELECT booking returns empty
        release: jest.fn(),
      };
      (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);
      await expect(service.startEncounter('invalid', 'doc1', 'A')).rejects.toThrow('BOOKING_NOT_FOUND');
    });
  });

  describe('recordDiagnosis', () => {
    it('should update diagnosis and log audit', async () => {
      const mockEncounter = { id: 'enc1', status: 'ONGOING', branch_id: 'A', doctor_id: 'doc1', diagnosis: null, icd10_code: null };
      const updated = { ...mockEncounter, diagnosis: 'Karies', icd10_code: 'K02.0' };
      
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockEncounter] }) // SELECT encounter
          .mockResolvedValueOnce({ rows: [updated] }) // UPDATE
          .mockResolvedValueOnce(undefined), // COMMIT
        release: jest.fn(),
      };
      (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);
      (auditService.logEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await service.recordDiagnosis('enc1', 'Karies', 'K02.0', 'doc1');
      expect(result.diagnosis).toBe('Karies');
      expect(auditService.logEvent).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'ENCOUNTER_DIAGNOSIS_RECORDED',
      }));
    });
  });

  describe('recordTreatment', () => {
    it('should update treatment and log audit', async () => {
      const mockEncounter = { id: 'enc1', status: 'ONGOING', branch_id: 'A', doctor_id: 'doc1', treatment: null, notes: null };
      const updated = { ...mockEncounter, treatment: 'Filling', notes: 'OK' };
      
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockEncounter] }) // SELECT
          .mockResolvedValueOnce({ rows: [updated] }) // UPDATE
          .mockResolvedValueOnce(undefined), // COMMIT
        release: jest.fn(),
      };
      (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);
      (auditService.logEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await service.recordTreatment('enc1', 'Filling', 'OK', 'doc1');
      expect(result.treatment).toBe('Filling');
      expect(auditService.logEvent).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'ENCOUNTER_TREATMENT_RECORDED',
      }));
    });
  });

  describe('updateEncounter', () => {
    it('should update encounter fields', async () => {
      const mockEncounter = { id: 'enc1', status: 'ONGOING', branch_id: 'A', doctor_id: 'doc1', complaint: null, diagnosis: null };
      const updated = { ...mockEncounter, complaint: 'Sakit gigi', diagnosis: 'Karies' };
      
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockEncounter] }) // SELECT
          .mockResolvedValueOnce({ rows: [updated] }) // UPDATE
          .mockResolvedValueOnce(undefined), // COMMIT
        release: jest.fn(),
      };
      (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);
      (auditService.logEvent as jest.Mock).mockResolvedValue(undefined);

      // CORRECT: (id, data, doctorId)
      const result = await service.updateEncounter('enc1', { complaint: 'Sakit gigi', diagnosis: 'Karies' }, 'doc1');
      expect(result.complaint).toBe('Sakit gigi');
      expect(result.diagnosis).toBe('Karies');
      expect(auditService.logEvent).toHaveBeenCalled();
    });

    it('should throw error if encounter not found', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [] }), // SELECT returns empty
        release: jest.fn(),
      };
      (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);
      await expect(service.updateEncounter('invalid', { diagnosis: 'New' }, 'doc1')).rejects.toThrow('ENCOUNTER_NOT_FOUND');
    });

    it('should throw error if no fields to update', async () => {
      const mockEncounter = { id: 'enc1', status: 'ONGOING', branch_id: 'A', doctor_id: 'doc1' };
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockEncounter] }) // SELECT
          .mockResolvedValueOnce(undefined), // No UPDATE because no fields
        release: jest.fn(),
      };
      (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);
      // Service will throw NO_FIELDS_TO_UPDATE before executing UPDATE
      await expect(service.updateEncounter('enc1', {}, 'doc1')).rejects.toThrow('NO_FIELDS_TO_UPDATE');
    });
  });

  describe('completeEncounter', () => {
    it('should complete encounter and generate invoice', async () => {
      const mockEncounter = { id: 'enc1', status: 'ONGOING', branch_id: 'A', patient_id: 'p1' };
      const updated = { ...mockEncounter, status: 'COMPLETED', completed_at: new Date() };
      const mockInvoice = { id: 'inv1' };
      
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockEncounter] }) // SELECT
          .mockResolvedValueOnce({ rows: [updated] }) // UPDATE
          .mockResolvedValueOnce(undefined), // COMMIT
        release: jest.fn(),
      };
      (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);
      (auditService.logEvent as jest.Mock).mockResolvedValue(undefined);
      mockInvoiceService.generateInvoiceForEncounter = jest.fn().mockResolvedValue(mockInvoice);

      const result = await service.completeEncounter('enc1', 'doc1');
      expect(result.encounter.status).toBe('COMPLETED');
      expect(result.invoice).toEqual(mockInvoice);
      expect(auditService.logEvent).toHaveBeenCalledWith(expect.objectContaining({
        eventType: 'ENCOUNTER_COMPLETED',
      }));
    });
  });
});
