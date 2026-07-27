import { DoctorScheduleService } from '../../../src/services/doctorSchedule.service';
import { Pool } from 'pg';

// Mock pg
const mockQuery = jest.fn();
jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    query: mockQuery,
    connect: jest.fn(() => ({
      query: mockQuery,
      release: jest.fn(),
    })),
  })),
}));

describe('DoctorScheduleService', () => {
  let service: DoctorScheduleService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DoctorScheduleService();
  });

  describe('getDoctorAvailability', () => {
    it('should return empty slots when doctor is on leave', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'leave-1' }] }); // leave check
      const slots = await service.getDoctorAvailability('doc-1', 'branch-1', new Date('2026-07-22'));
      expect(slots).toEqual([]);
    });

    it('should return empty slots when no schedule exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // no leave
      mockQuery.mockResolvedValueOnce({ rows: [] }); // no schedule
      const slots = await service.getDoctorAvailability('doc-1', 'branch-1', new Date('2026-07-22'));
      expect(slots).toEqual([]);
    });

    it('should return available slots excluding booked ones', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // no leave
      mockQuery.mockResolvedValueOnce({ rows: [{ session_start: '09:00', session_end: '12:00', slot_duration_minutes: 30 }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ booking_time: '09:30' }] }); // booked slot
      const slots = await service.getDoctorAvailability('doc-1', 'branch-1', new Date('2026-07-22'));
      expect(slots.length).toBe(6); // 3 hours / 30 min = 6 slots
      expect(slots[0].available).toBe(true); // 09:00 available
      expect(slots[1].available).toBe(false); // 09:30 booked
    });
  });

  describe('isSlotBooked', () => {
    it('should return true if slot is booked', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'booking-1' }] });
      const booked = await service.isSlotBooked('doc-1', new Date('2026-07-22T09:30:00'));
      expect(booked).toBe(true);
    });

    it('should return false if slot is not booked', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const booked = await service.isSlotBooked('doc-1', new Date('2026-07-22T09:30:00'));
      expect(booked).toBe(false);
    });
  });

  describe('setDoctorLeave', () => {
    it('should insert leave record', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // no conflict
      await service.setDoctorLeave('doc-1', 'branch-1', new Date('2026-07-22'), new Date('2026-07-23'), 'Sick', 'admin-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO doctor_leaves'),
        expect.arrayContaining(['doc-1', 'branch-1', '2026-07-22', '2026-07-23', 'Sick', 'admin-1'])
      );
    });
  });

  describe('removeDoctorLeave', () => {
    it('should delete leave record', async () => {
      await service.removeDoctorLeave('doc-1', new Date('2026-07-22'), new Date('2026-07-23'));
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM doctor_leaves'),
        expect.arrayContaining(['doc-1', '2026-07-22', '2026-07-23'])
      );
    });
  });
});
