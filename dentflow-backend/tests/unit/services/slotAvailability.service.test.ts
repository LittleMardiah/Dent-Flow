import { SlotAvailabilityService } from '../../../src/services/slotAvailability.service';
import { Pool } from 'pg';

jest.mock('pg');

describe('SlotAvailabilityService', () => {
  let service: SlotAvailabilityService;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    mockPool = new Pool() as jest.Mocked<Pool>;
    service = new SlotAvailabilityService();
    (service as any).pool = mockPool;
    jest.clearAllMocks();
  });

  describe('checkSlotAvailability', () => {
    it('should return true if slot is available (booked < max)', async () => {
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({ rows: [{ booked: '2' }] })
        .mockResolvedValueOnce({ rows: [{ max_patients_per_session: 4 }] });

      const result = await service.checkSlotAvailability(
        'doctor-123',
        '2026-07-15T09:00:00',
        '2026-07-15T10:00:00',
        new Date('2026-07-15T00:00:00Z')
      );
      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it('should return false if slot is full (booked >= max)', async () => {
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({ rows: [{ booked: '5' }] })
        .mockResolvedValueOnce({ rows: [{ max_patients_per_session: 4 }] });

      const result = await service.checkSlotAvailability(
        'doctor-123',
        '2026-07-15T09:00:00',
        '2026-07-15T10:00:00',
        new Date('2026-07-15T00:00:00Z')
      );
      expect(result).toBe(false);
    });

    it('should use default max=4 if schedule not found', async () => {
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({ rows: [{ booked: '2' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.checkSlotAvailability(
        'doctor-123',
        '2026-07-15T09:00:00',
        '2026-07-15T10:00:00',
        new Date('2026-07-15T00:00:00Z')
      );
      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it('should throw error if database error occurs', async () => {
      mockPool.query = jest.fn().mockRejectedValue(new Error('DB_ERROR'));
      await expect(service.checkSlotAvailability(
        'doctor-123',
        '2026-07-15T09:00:00',
        '2026-07-15T10:00:00',
        new Date('2026-07-15T00:00:00Z')
      )).rejects.toThrow('DB_ERROR');
    });
  });

  describe('getAvailableSlots', () => {
    it('should return available slots', async () => {
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{
            session_start: '09:00:00',
            session_end: '12:00:00',
            slot_duration_minutes: 30,
            max_patients_per_session: 4,
          }]
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.getAvailableSlots(
        'doctor-123',
        'branch-456',
        new Date('2026-07-15T00:00:00Z')
      );
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(6);
      expect(result.every(s => s.available === true)).toBe(true);
    });

    it('should return empty array if doctor on leave', async () => {
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({ rows: [{ id: 'leave1' }] });

      const result = await service.getAvailableSlots(
        'doctor-123',
        'branch-456',
        new Date('2026-07-15T00:00:00Z')
      );
      expect(result).toEqual([]);
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it('should return empty array if no schedule found', async () => {
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.getAvailableSlots(
        'doctor-123',
        'branch-456',
        new Date('2026-07-15T00:00:00Z')
      );
      expect(result).toEqual([]);
    });

    it('should mark booked slots as unavailable', async () => {
      mockPool.query = jest.fn()
        .mockResolvedValueOnce({ rows: [] }) // no leave
        .mockResolvedValueOnce({
          rows: [{
            session_start: '09:00:00',
            session_end: '12:00:00',
            slot_duration_minutes: 30,
            max_patients_per_session: 1,  // <-- set to 1 so a single booking fills the slot
          }]
        })
        .mockResolvedValueOnce({
          rows: [
            { session_start: '2026-07-15 09:30:00', session_end: '2026-07-15 10:00:00' }
          ]
        });

      const result = await service.getAvailableSlots(
        'doctor-123',
        'branch-456',
        new Date('2026-07-15T00:00:00Z')
      );
      const bookedSlot = result.find(s => s.start === '09:30');
      expect(bookedSlot).toBeDefined();
      expect(bookedSlot?.available).toBe(false);
      const otherSlot = result.find(s => s.start === '09:00');
      expect(otherSlot?.available).toBe(true);
    });
  });
});
