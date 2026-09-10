import { BookingService } from '../../../src/services/booking.service';
import { Pool } from 'pg';
import { slotAvailabilityService } from '../../../src/services/slotAvailability.service';
import { auditService } from '../../../src/services/audit.service';

jest.mock('pg');
jest.mock('../../../src/services/slotAvailability.service');
jest.mock('../../../src/services/audit.service');
jest.mock('../../../src/services/notification.service', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendBookingConfirmation: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('BookingService', () => {
  let service: BookingService;
  let mockPool: jest.Mocked<Pool>;
  let mockClient: any;

  beforeEach(() => {
    mockPool = new Pool() as jest.Mocked<Pool>;
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    mockPool.connect = jest.fn().mockResolvedValue(mockClient);

    service = new BookingService();
    (service as any).pool = mockPool;

    jest.clearAllMocks();
  });

  describe('createScheduledBooking', () => {
    const mockPatientId = 'patient-123';
    const mockDoctorUserId = 'doctor-456';
    const mockBranchId = 'branch-789';
    const mockBookingDate = new Date('2026-07-15');
    const mockSessionSlotId = 'slot-001';

    it('should create a booking successfully (patient exists)', async () => {
      // Urutan query: BEGIN → patient SELECT → doctor SELECT → schedule SELECT → booking INSERT → COMMIT
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'patient-rec-123' }] }) // patient exists
        .mockResolvedValueOnce({ rows: [{ id: 'doctor-rec-456' }] }) // doctor exists
        .mockResolvedValueOnce({ rows: [{ session_start: '09:00:00', session_end: '12:00:00', max_patients_per_session: 4 }] }) // schedule
        .mockResolvedValueOnce({ rows: [{ id: 'booking-123' }] }) // insert booking
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      (slotAvailabilityService.checkSlotAvailability as jest.Mock).mockResolvedValue(true);
      (auditService.logEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await service.createScheduledBooking(
        mockPatientId,
        mockDoctorUserId,
        mockBranchId,
        mockBookingDate,
        mockSessionSlotId
      );

      expect(result).toHaveProperty('bookingId', 'booking-123');
      expect(result).toHaveProperty('bookingCode');
      expect(result.bookingCode).toHaveLength(6);
      expect(mockClient.query).toHaveBeenCalledTimes(6); // 6 query termasuk BEGIN + COMMIT
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should insert patient if not exists', async () => {
      // Urutan: BEGIN → patient SELECT (empty) → patient INSERT → doctor SELECT → schedule SELECT → booking INSERT → COMMIT
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // patient not found
        .mockResolvedValueOnce({ rows: [{ id: 'patient-rec-123' }] }) // insert patient
        .mockResolvedValueOnce({ rows: [{ id: 'doctor-rec-456' }] }) // doctor exists
        .mockResolvedValueOnce({ rows: [{ session_start: '09:00:00', session_end: '12:00:00', max_patients_per_session: 4 }] }) // schedule
        .mockResolvedValueOnce({ rows: [{ id: 'booking-123' }] }) // insert booking
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      (slotAvailabilityService.checkSlotAvailability as jest.Mock).mockResolvedValue(true);
      (auditService.logEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await service.createScheduledBooking(
        mockPatientId,
        mockDoctorUserId,
        mockBranchId,
        mockBookingDate,
        mockSessionSlotId
      );

      expect(result).toHaveProperty('bookingId', 'booking-123');
      // Cek bahwa INSERT patient dipanggil
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO patients'),
        expect.arrayContaining([mockPatientId, mockBranchId])
      );
      expect(mockClient.query).toHaveBeenCalledTimes(7); // 7 query termasuk BEGIN + COMMIT
    });

    it('should throw DOCTOR_NOT_FOUND if doctor not available', async () => {
      // Urutan: BEGIN → patient SELECT → doctor SELECT (empty) → ROLLBACK
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'patient-rec-123' }] }) // patient exists
        .mockResolvedValueOnce({ rows: [] }); // doctor not found

      await expect(service.createScheduledBooking(
        mockPatientId,
        mockDoctorUserId,
        mockBranchId,
        mockBookingDate,
        mockSessionSlotId
      )).rejects.toThrow('DOCTOR_NOT_FOUND');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw DOCTOR_NOT_SCHEDULED if schedule not found', async () => {
      // Urutan: BEGIN → patient SELECT → doctor SELECT → schedule SELECT (empty) → ROLLBACK
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'patient-rec-123' }] }) // patient exists
        .mockResolvedValueOnce({ rows: [{ id: 'doctor-rec-456' }] }) // doctor exists
        .mockResolvedValueOnce({ rows: [] }); // schedule not found

      await expect(service.createScheduledBooking(
        mockPatientId,
        mockDoctorUserId,
        mockBranchId,
        mockBookingDate,
        mockSessionSlotId
      )).rejects.toThrow('DOCTOR_NOT_SCHEDULED');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw SLOT_NOT_AVAILABLE if slot is full', async () => {
      // Urutan: BEGIN → patient SELECT → doctor SELECT → schedule SELECT → ROLLBACK
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'patient-rec-123' }] }) // patient exists
        .mockResolvedValueOnce({ rows: [{ id: 'doctor-rec-456' }] }) // doctor exists
        .mockResolvedValueOnce({ rows: [{ session_start: '09:00:00', session_end: '12:00:00', max_patients_per_session: 4 }] }); // schedule

      (slotAvailabilityService.checkSlotAvailability as jest.Mock).mockResolvedValue(false);

      await expect(service.createScheduledBooking(
        mockPatientId,
        mockDoctorUserId,
        mockBranchId,
        mockBookingDate,
        mockSessionSlotId
      )).rejects.toThrow('SLOT_NOT_AVAILABLE');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback on database error', async () => {
      // Urutan: BEGIN → patient SELECT → doctor SELECT → error → ROLLBACK
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'patient-rec-123' }] }) // patient exists
        .mockResolvedValueOnce({ rows: [{ id: 'doctor-rec-456' }] }) // doctor exists
        .mockRejectedValue(new Error('DB_ERROR')); // error di schedule

      await expect(service.createScheduledBooking(
        mockPatientId,
        mockDoctorUserId,
        mockBranchId,
        mockBookingDate,
        mockSessionSlotId
      )).rejects.toThrow('DB_ERROR');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
