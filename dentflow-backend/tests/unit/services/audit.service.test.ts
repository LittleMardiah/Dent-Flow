import { AuditService, AuditLogPayload } from '../../../src/services/audit.service';
import { Pool } from 'pg';
import { AuditEventType } from '../../../src/models/audit.model';

jest.mock('pg');

describe('AuditService', () => {
  let service: AuditService;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    mockPool = new Pool() as jest.Mocked<Pool>;
    service = new AuditService();
    (service as any).pool = mockPool;
    jest.clearAllMocks();
  });

  describe('logEvent', () => {
    it('should insert audit log with correct data', async () => {
      const payload: AuditLogPayload = {
        branchId: 'A',
        userId: 'user1',
        eventType: AuditEventType.USER_LOGIN,
        entityType: 'USER',
        entityId: 'user1',
        description: 'User logged in',
        ipAddress: '127.0.0.1',
      };
      mockPool.query = jest.fn().mockResolvedValue({});

      await service.logEvent(payload);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([
          'A',
          'user1',
          'USER_LOGIN',
          'USER',
          'user1',
          null,
          null,
          null,
          'User logged in',
          '127.0.0.1',
        ])
      );
    });
  });

  describe('getEventLabel', () => {
    it('should return correct label for known event types', () => {
      expect(AuditService.getEventLabel('USER_LOGIN')).toBe('Pengguna Login');
      expect(AuditService.getEventLabel('BOOKING_CREATED')).toBe('Pemesanan Dibuat');
      expect(AuditService.getEventLabel('ENCOUNTER_STARTED')).toBe('Pemeriksaan Dibuat');
      expect(AuditService.getEventLabel('PAYMENT_CONFIRMED')).toBe('Pembayaran Dikonfirmasi');
    });

    it('should return event type itself if label not found', () => {
      expect(AuditService.getEventLabel('UNKNOWN_EVENT')).toBe('UNKNOWN_EVENT');
    });
  });

  describe('getEventsByBranch', () => {
    it('should return events with labels', async () => {
      const mockRows = [
        { id: '1', event_type: 'USER_LOGIN', branch_id: 'A', created_at: new Date() },
        { id: '2', event_type: 'BOOKING_CREATED', branch_id: 'A', created_at: new Date() },
      ];
      mockPool.query = jest.fn().mockResolvedValue({ rows: mockRows });

      const result = await service.getEventsByBranch('A', 10);
      expect(result).toHaveLength(2);
      expect(result[0].event_label).toBe('Pengguna Login');
      expect(result[1].event_label).toBe('Pemesanan Dibuat');
    });
  });

  describe('getEventsByEntity', () => {
    it('should return events for specific entity with labels', async () => {
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
