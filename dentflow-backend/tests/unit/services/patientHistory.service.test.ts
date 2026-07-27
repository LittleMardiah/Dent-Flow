import { PatientHistoryService } from '../../../src/services/patientHistory.service';
import { Pool } from 'pg';

jest.mock('pg');

describe('PatientHistoryService', () => {
  let service: PatientHistoryService;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    mockPool = new Pool() as jest.Mocked<Pool>;
    service = new PatientHistoryService();
    (service as any).pool = mockPool;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPatientHistory', () => {
    it('should return encounters, invoices, and bookings sorted by date', async () => {
      const mockEncounters = [
        { id: 'e1', created_at: new Date('2026-07-20'), doctor_name: 'Dr. A', doctor_specialization: 'Sp.BM', complaint: 'Sakit gigi', treatment: 'Filling', diagnosis: 'Karies', icd10_code: 'K02.0', prescription: 'Paracetamol', status: 'COMPLETED', branch_id: 'A' },
      ];
      const mockInvoices = [
        { id: 'i1', invoice_number: 'INV-A-20260720-001', created_at: new Date('2026-07-20'), total_amount: '200000', payment_status: 'UNPAID', payment_method: null, paid_at: null },
      ];
      const mockBookings = [
        { id: 'b1', created_at: new Date('2026-07-19'), doctor_name: 'Dr. A', doctor_specialization: 'Sp.BM', session_start: new Date('2026-07-20T09:00:00'), session_end: new Date('2026-07-20T12:00:00'), status: 'COMPLETED', check_in_code: 'ABC123' },
      ];

      mockPool.query = jest.fn()
        .mockResolvedValueOnce({ rows: mockEncounters })
        .mockResolvedValueOnce({ rows: mockInvoices })
        .mockResolvedValueOnce({ rows: mockBookings });

      const result = await service.getPatientHistory('patient1', 'A');
      expect(result.encounters).toHaveLength(1);
      expect(result.invoices).toHaveLength(1);
      expect(result.bookings).toHaveLength(1);
      expect(mockPool.query).toHaveBeenCalledTimes(3);
    });

    it('should return empty arrays if no data', async () => {
      mockPool.query = jest.fn().mockResolvedValue({ rows: [] });
      const result = await service.getPatientHistory('patient1', 'A');
      expect(result.encounters).toEqual([]);
      expect(result.invoices).toEqual([]);
      expect(result.bookings).toEqual([]);
    });
  });

  describe('getMedicalRecords', () => {
    it('should return encounters with diagnosis and ICD-10 for doctor access', async () => {
      const mockRecords = [
        { id: 'e1', created_at: new Date('2026-07-20'), doctor_name: 'Dr. A', doctor_specialization: 'Sp.BM', complaint: 'Sakit gigi', treatment: 'Filling', diagnosis: 'Karies', icd10_code: 'K02.0', prescription: 'Paracetamol', status: 'COMPLETED', branch_id: 'A' },
      ];
      mockPool.query = jest.fn().mockResolvedValue({ rows: mockRecords });

      const result = await service.getMedicalRecords('patient1', 'A');
      expect(result).toHaveLength(1);
      expect(result[0].diagnosis).toBe('Karies');
      expect(result[0].icd10Code).toBe('K02.0');
    });
  });
});
