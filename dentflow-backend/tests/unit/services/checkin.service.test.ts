import { CheckinService } from '../../../src/services/checkin.service';
import { Pool } from 'pg';
import redis from '../../../src/config/redis';
import { auditService } from '../../../src/services/audit.service';
import { getCurrentTime } from '../../../src/utils/time';

jest.mock('pg');
jest.mock('../../../src/config/redis', () => ({
  incr: jest.fn().mockResolvedValue(5),
}));
jest.mock('../../../src/services/audit.service');
jest.mock('../../../src/utils/time');

describe('CheckinService', () => {
  let service: CheckinService;
  let mockPool: jest.Mocked<Pool>;
  let mockClient: any;

  beforeEach(() => {
    mockPool = new Pool() as jest.Mocked<Pool>;
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    mockPool.connect = jest.fn().mockResolvedValue(mockClient);

    service = new CheckinService();
    (service as any).pool = mockPool;

    jest.clearAllMocks();
  });

  describe('checkinPatient', () => {
    const mockCheckInCode = 'ABC123';
    const mockBranchId = 'branch-789';
    const mockAdminId = 'admin-456';

    it('should checkin patient successfully', async () => {
      // Mock booking result
      const mockBooking = {
        id: 'booking-123',
        status: 'PAYMENT_CONFIRMED',
        patient_id: 'patient-123',
        doctor_id: 'doctor-456',
        session_start: '2026-07-15T09:00:00',
        session_end: '2026-07-15T12:00:00',
        checked_in_at: null,
        branch_id: mockBranchId,
      };

      // Mock getCurrentTime to return within session
      (getCurrentTime as jest.Mock).mockReturnValue(new Date('2026-07-15T10:00:00Z'));

      // Mock redis incr
      (redis.incr as jest.Mock).mockResolvedValue(5);

      // Mock audit log
      (auditService.logEvent as jest.Mock).mockResolvedValue(undefined);

      // Urutan query: BEGIN → SELECT booking → INSERT queues → UPDATE bookings → COMMIT
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockBooking] }) // SELECT booking
        .mockResolvedValueOnce({ rows: [] }) // INSERT queues
        .mockResolvedValueOnce({ rows: [] }) // UPDATE bookings
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await service.checkinPatient(
        mockCheckInCode,
        mockBranchId,
        mockAdminId
      );

      expect(result).toEqual({
        alreadyCheckedIn: false,
        queueNumber: 5,
        bookingId: 'booking-123',
        patientId: 'patient-123',
        doctorId: 'doctor-456',
      });
      expect(redis.incr).toHaveBeenCalledWith(`queue:${mockBranchId}:doctor-456`);
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw KODE_TIDAK_VALID if booking not found', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // SELECT booking (empty)

      await expect(service.checkinPatient(
        mockCheckInCode,
        mockBranchId,
        mockAdminId
      )).rejects.toThrow('KODE_TIDAK_VALID');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw BRANCH_TIDAK_SESUAI if branch mismatch', async () => {
      const mockBooking = {
        id: 'booking-123',
        status: 'PAYMENT_CONFIRMED',
        branch_id: 'branch-other',
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockBooking] }); // SELECT booking

      await expect(service.checkinPatient(
        mockCheckInCode,
        mockBranchId,
        mockAdminId
      )).rejects.toThrow('BRANCH_TIDAK_SESUAI');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw STATUS_TIDAK_VALID if status not PAYMENT_CONFIRMED or CONFIRMED', async () => {
      const mockBooking = {
        id: 'booking-123',
        status: 'PENDING_PAYMENT',
        branch_id: mockBranchId,
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockBooking] }); // SELECT booking

      await expect(service.checkinPatient(
        mockCheckInCode,
        mockBranchId,
        mockAdminId
      )).rejects.toThrow('STATUS_TIDAK_VALID');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return alreadyCheckedIn if already checked in', async () => {
      const mockBooking = {
        id: 'booking-123',
        status: 'PAYMENT_CONFIRMED',
        branch_id: mockBranchId,
        checked_in_at: '2026-07-15T10:00:00Z',
      };

      // Mock existing queue
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockBooking] }) // SELECT booking
        .mockResolvedValueOnce({ rows: [{ queue_number: 5 }] }); // SELECT existing queue

      const result = await service.checkinPatient(
        mockCheckInCode,
        mockBranchId,
        mockAdminId
      );

      expect(result).toEqual({
        alreadyCheckedIn: true,
        queueNumber: 5,
      });
      expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw SESI_BELUM_DIMULAI if before session start', async () => {
      const mockBooking = {
        id: 'booking-123',
        status: 'PAYMENT_CONFIRMED',
        branch_id: mockBranchId,
        checked_in_at: null,
        session_start: '2026-07-15T09:00:00',
        session_end: '2026-07-15T12:00:00',
      };

      (getCurrentTime as jest.Mock).mockReturnValue(new Date('2026-07-15T08:00:00Z'));

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockBooking] }); // SELECT booking

      await expect(service.checkinPatient(
        mockCheckInCode,
        mockBranchId,
        mockAdminId
      )).rejects.toThrow('SESI_BELUM_DIMULAI');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw SESI_SUDAH_BERAKHIR if after session end', async () => {
      const mockBooking = {
        id: 'booking-123',
        status: 'PAYMENT_CONFIRMED',
        branch_id: mockBranchId,
        checked_in_at: null,
        session_start: '2026-07-15T09:00:00',
        session_end: '2026-07-15T12:00:00',
      };

      (getCurrentTime as jest.Mock).mockReturnValue(new Date('2026-07-15T13:00:00Z'));

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockBooking] }); // SELECT booking

      await expect(service.checkinPatient(
        mockCheckInCode,
        mockBranchId,
        mockAdminId
      )).rejects.toThrow('SESI_SUDAH_BERAKHIR');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
