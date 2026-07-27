import { BookingService } from '../../../src/services/booking.service';
import { BookingRepository } from '../../../src/repositories/booking.repository';
import { auditService } from '../../../src/services/audit.service';

// Mock dependencies
jest.mock('../../../src/repositories/booking.repository');
jest.mock('../../../src/services/audit.service');

describe('BookingService', () => {
  let service: BookingService;
  let mockRepo: jest.Mocked<BookingRepository>;
  let mockPool: any;

  beforeEach(() => {
    mockRepo = new BookingRepository({} as any) as jest.Mocked<BookingRepository>;
    // Mock pool.query to simulate database queries for patient/doctor lookup
    mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [{ id: 'patient-rec-1' }] }), // default patient found
    };
    service = new BookingService(mockPool);
    // Override repo with mock
    (service as any).repo = mockRepo;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isSlotAvailable', () => {
    it('should return true if count < 4', async () => {
      mockRepo.countByDoctorAndSlot.mockResolvedValue(2);
      const result = await service.isSlotAvailable('doc1', 'A', '2026-07-22', '09:00:00');
      expect(result).toBe(true);
    });

    it('should return false if count >= 4', async () => {
      mockRepo.countByDoctorAndSlot.mockResolvedValue(4);
      const result = await service.isSlotAvailable('doc1', 'A', '2026-07-22', '09:00:00');
      expect(result).toBe(false);
    });
  });

  describe('createScheduledBooking', () => {
    it('should create booking when slot available and doctor scheduled', async () => {
      // Mock patient lookup
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'patient-rec-1' }] }); // getPatientIdFromUserId
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'doctor-rec-1' }] }); // getDoctorIdFromUserId
      mockRepo.countByDoctorAndSlot.mockResolvedValue(2);
      mockRepo.findByBookingCode.mockResolvedValue(null); // unique code
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'schedule-1' }] }); // schedule check
      mockRepo.create.mockResolvedValue({
        id: 'booking-1',
        patient_id: 'patient-rec-1',
        doctor_id: 'doctor-rec-1',
        branch_id: 'A',
        booking_date: '2026-07-22',
        booking_time: '09:00:00',
        status: 'PENDING',
        booking_code: 'ABC123',
        is_walk_in: false,
        temp_profile_flag: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);

      const slotDate = new Date('2026-07-22T09:00:00Z');
      const result = await service.createScheduledBooking(
        'user-1',
        'doctor-user-1',
        'A',
        slotDate,
        'Test notes'
      );

      expect(result).toHaveProperty('id');
      expect(result.status).toBe('PENDING');
      expect(result.booking_code).toBe('ABC123');
      expect(mockRepo.create).toHaveBeenCalled();
      expect(auditService.logEvent).toHaveBeenCalled();
    });

    it('should throw SLOT_NOT_AVAILABLE when slot is full', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'patient-rec-1' }] });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'doctor-rec-1' }] });
      mockRepo.countByDoctorAndSlot.mockResolvedValue(4);
      const slotDate = new Date('2026-07-22T09:00:00Z');
      await expect(
        service.createScheduledBooking('user-1', 'doctor-user-1', 'A', slotDate)
      ).rejects.toThrow('SLOT_NOT_AVAILABLE');
    });

    it('should throw DOCTOR_NOT_SCHEDULED when doctor has no schedule', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'patient-rec-1' }] });
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'doctor-rec-1' }] });
      mockRepo.countByDoctorAndSlot.mockResolvedValue(2);
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // no schedule
      const slotDate = new Date('2026-07-22T09:00:00Z');
      await expect(
        service.createScheduledBooking('user-1', 'doctor-user-1', 'A', slotDate)
      ).rejects.toThrow('DOCTOR_NOT_SCHEDULED');
    });
  });

  describe('cancelBooking', () => {
    it('should cancel booking if owned and cancellable', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'patient-rec-1' }] }); // getPatientIdFromUserId
      mockRepo.isOwnedByPatient.mockResolvedValue(true);
      mockRepo.findById.mockResolvedValue({
        id: 'booking-1',
        status: 'PENDING',
        patient_id: 'patient-rec-1',
        branch_id: 'A',
        booking_code: 'ABC123',
      } as any);
      mockRepo.softDelete.mockResolvedValue({
        id: 'booking-1',
        status: 'CANCELLED',
        cancelled_at: new Date().toISOString(),
      } as any);

      const result = await service.cancelBooking('booking-1', 'user-1');
      expect(result.status).toBe('CANCELLED');
      expect(auditService.logEvent).toHaveBeenCalled();
    });

    it('should throw BOOKING_NOT_OWNED if not owned', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'patient-rec-1' }] });
      mockRepo.isOwnedByPatient.mockResolvedValue(false);
      await expect(service.cancelBooking('booking-1', 'user-1')).rejects.toThrow('BOOKING_NOT_OWNED');
    });

    it('should throw BOOKING_CANNOT_CANCEL if status is COMPLETED', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'patient-rec-1' }] });
      mockRepo.isOwnedByPatient.mockResolvedValue(true);
      mockRepo.findById.mockResolvedValue({
        id: 'booking-1',
        status: 'COMPLETED',
        patient_id: 'patient-rec-1',
      } as any);
      await expect(service.cancelBooking('booking-1', 'user-1')).rejects.toThrow('BOOKING_CANNOT_CANCEL');
    });
  });

  describe('getPatientBookings', () => {
    it('should return bookings with filter', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'patient-rec-1' }] });
      mockRepo.findByPatient.mockResolvedValue({
        bookings: [{ id: 'b1' }] as any,
        total: 1,
      });
      const result = await service.getPatientBookings('user-1', { status: 'PENDING' });
      expect(result.bookings).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('getBookingDetail', () => {
    it('should return booking if owned', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'patient-rec-1' }] });
      mockRepo.findById.mockResolvedValue({
        id: 'b1',
        patient_id: 'patient-rec-1',
      } as any);
      const result = await service.getBookingDetail('b1', 'user-1');
      expect(result.id).toBe('b1');
    });

    it('should throw BOOKING_NOT_OWNED if not owned', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ id: 'patient-rec-1' }] });
      mockRepo.findById.mockResolvedValue({
        id: 'b1',
        patient_id: 'other-patient',
      } as any);
      await expect(service.getBookingDetail('b1', 'user-1')).rejects.toThrow('BOOKING_NOT_OWNED');
    });
  });

  describe('createWalkInBooking', () => {
    it('should throw WALK_IN_NOT_IMPLEMENTED', async () => {
      await expect(
        service.createWalkInBooking(
          { name: 'John Doe', phone: '08123456789', age: 30 },
          'doc-1',
          'A'
        )
      ).rejects.toThrow('WALK_IN_NOT_IMPLEMENTED');
    });
  });
});
