import { AuditService, AuditLogPayload } from '../../../src/services/audit.service';
import { Pool } from 'pg';
import { AuditEventType } from '../../../src/models/audit.model';

jest.mock('pg');

describe('AuditService - EMR Events', () => {
  let service: AuditService;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    mockPool = new Pool() as jest.Mocked<Pool>;
    service = new AuditService();
    (service as any).pool = mockPool;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('EMR Audit Events', () => {
    it('should log ENCOUNTER_STARTED event with correct label', async () => {
      const payload: AuditLogPayload = {
        branchId: 'A',
        userId: 'doctor1',
        eventType: AuditEventType.ENCOUNTER_STARTED,
        entityType: 'ENCOUNTER',
        entityId: 'enc1',
        description: 'Pemeriksaan dimulai untuk pasien',
      };
      mockPool.query = jest.fn().mockResolvedValue({});

      await service.logEvent(payload);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          'A',
          'doctor1',
          'ENCOUNTER_STARTED',
          'ENCOUNTER',
          'enc1',
          null,
          null,
          null,
          'Pemeriksaan dimulai untuk pasien',
          null,
        ])
      );
    });

    it('should log ENCOUNTER_DIAGNOSIS_RECORDED with old and new values', async () => {
      const payload: AuditLogPayload = {
        branchId: 'A',
        userId: 'doctor1',
        eventType: AuditEventType.ENCOUNTER_DIAGNOSIS_RECORDED,
        entityType: 'ENCOUNTER',
        entityId: 'enc1',
        oldValues: { diagnosis: null, icd10Code: null },
        newValues: { diagnosis: 'Karies', icd10Code: 'K02.0' },
        description: 'Diagnosis dicatat',
      };
      mockPool.query = jest.fn().mockResolvedValue({});

      await service.logEvent(payload);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          'A',
          'doctor1',
          'ENCOUNTER_DIAGNOSIS_RECORDED',
          'ENCOUNTER',
          'enc1',
          null,
          JSON.stringify({ diagnosis: null, icd10Code: null }),
          JSON.stringify({ diagnosis: 'Karies', icd10Code: 'K02.0' }),
          'Diagnosis dicatat',
          null,
        ])
      );
    });

    it('should log ENCOUNTER_TREATMENT_RECORDED with old and new values', async () => {
      const payload: AuditLogPayload = {
        branchId: 'A',
        userId: 'doctor1',
        eventType: AuditEventType.ENCOUNTER_TREATMENT_RECORDED,
        entityType: 'ENCOUNTER',
        entityId: 'enc1',
        oldValues: { treatment: null, notes: null },
        newValues: { treatment: 'Filling', notes: 'OK' },
        description: 'Pengobatan dicatat',
      };
      mockPool.query = jest.fn().mockResolvedValue({});

      await service.logEvent(payload);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          'A',
          'doctor1',
          'ENCOUNTER_TREATMENT_RECORDED',
          'ENCOUNTER',
          'enc1',
          null,
          JSON.stringify({ treatment: null, notes: null }),
          JSON.stringify({ treatment: 'Filling', notes: 'OK' }),
          'Pengobatan dicatat',
          null,
        ])
      );
    });

    it('should log ENCOUNTER_COMPLETED with old and new status', async () => {
      const payload: AuditLogPayload = {
        branchId: 'A',
        userId: 'doctor1',
        eventType: AuditEventType.ENCOUNTER_COMPLETED,
        entityType: 'ENCOUNTER',
        entityId: 'enc1',
        oldValues: { status: 'ONGOING' },
        newValues: { status: 'COMPLETED' },
        description: 'Pemeriksaan selesai',
      };
      mockPool.query = jest.fn().mockResolvedValue({});

      await service.logEvent(payload);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          'A',
          'doctor1',
          'ENCOUNTER_COMPLETED',
          'ENCOUNTER',
          'enc1',
          null,
          JSON.stringify({ status: 'ONGOING' }),
          JSON.stringify({ status: 'COMPLETED' }),
          'Pemeriksaan selesai',
          null,
        ])
      );
    });
  });

  describe('Audit Label Mapping', () => {
    it('should return correct label for EMR events', () => {
      expect(AuditService.getEventLabel('ENCOUNTER_STARTED')).toBe('Pemeriksaan Dibuat');
      expect(AuditService.getEventLabel('ENCOUNTER_DIAGNOSIS_RECORDED')).toBe('Diagnosis Dicatat');
      expect(AuditService.getEventLabel('ENCOUNTER_TREATMENT_RECORDED')).toBe('Pengobatan Dicatat');
      expect(AuditService.getEventLabel('ENCOUNTER_COMPLETED')).toBe('Pemeriksaan Selesai');
    });
  });

  describe('getEventsByEntity', () => {
    it('should return events for a specific entity with labels', async () => {
      const mockRows = [
        { id: '1', event_type: 'ENCOUNTER_STARTED', entity_type: 'ENCOUNTER', entity_id: 'enc1', created_at: new Date() },
        { id: '2', event_type: 'ENCOUNTER_COMPLETED', entity_type: 'ENCOUNTER', entity_id: 'enc1', created_at: new Date() },
      ];
      mockPool.query = jest.fn().mockResolvedValue({ rows: mockRows });

      const result = await service.getEventsByEntity('ENCOUNTER', 'enc1');
      expect(result).toHaveLength(2);
      expect(result[0].event_label).toBe('Pemeriksaan Dibuat');
      expect(result[1].event_label).toBe('Pemeriksaan Selesai');
    });
  });
});
