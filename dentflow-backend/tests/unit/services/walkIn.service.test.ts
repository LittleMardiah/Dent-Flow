import { WalkInService } from '../../../src/services/walkIn.service';
import { Pool } from 'pg';
import { auditService } from '../../../src/services/audit.service';
import { PasswordService } from '../../../src/utils/password.utils';
import { JwtService } from '../../../src/utils/jwt.utils';
import redis from '../../../src/config/redis';

jest.mock('pg');
jest.mock('../../../src/services/audit.service');
jest.mock('../../../src/utils/password.utils');
jest.mock('../../../src/utils/jwt.utils');
jest.mock('../../../src/config/redis', () => ({
  __esModule: true,
  default: {
    incr: jest.fn(),
  },
}));

describe('WalkInService', () => {
  let service: WalkInService;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    mockPool = new Pool() as jest.Mocked<Pool>;
    service = new WalkInService();
    (service as any).pool = mockPool;
    jest.clearAllMocks();
  });

  describe('createTemporaryProfile', () => {
    it('should create temporary profile successfully', async () => {
      const mockResult = {
        rows: [{
          id: 'temp-1',
          branch_id: 'A',
          full_name: 'John Doe',
          phone: '08123456789',
          age: 30,
          converted_to_patient_id: null,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        }],
      };
      mockPool.query = jest.fn().mockResolvedValue(mockResult);

      const result = await service.createTemporaryProfile({
        fullName: 'John Doe',
        phone: '08123456789',
        age: 30,
        branchId: 'A',
      });

      expect(result.id).toBe('temp-1');
      expect(result.fullName).toBe('John Doe');
      expect(mockPool.query).toHaveBeenCalled();
    });
  });

  describe('bookAppointment', () => {
    it('should book appointment and generate queue number', async () => {
      const mockTempPatient = { id: 'temp-1', branch_id: 'A', full_name: 'John Doe', phone: '08123456789' };
      const mockDoctor = { id: 'doc-1', is_active: true };
      const mockSchedule = { session_start: '09:00:00', session_end: '12:00:00', max_patients_per_session: 4 };
      const mockBooking = { id: 'booking-1' };
      const mockQueueNumber = 5;

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockTempPatient] }) // SELECT temp
          .mockResolvedValueOnce({ rows: [mockDoctor] }) // SELECT doctor user
          .mockResolvedValueOnce({ rows: [{ id: 'doc-rec-1' }] }) // SELECT doctor record
          .mockResolvedValueOnce({ rows: [mockSchedule] }) // SELECT schedule
          .mockResolvedValueOnce({ rows: [{ booked: '0' }] }) // count booking slot
          .mockResolvedValueOnce({ rows: [mockBooking] }) // INSERT booking
          .mockResolvedValueOnce({}) // INSERT queue
          .mockResolvedValueOnce(undefined), // COMMIT
        release: jest.fn(),
      };
      (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);
      (redis.incr as jest.Mock).mockResolvedValue(mockQueueNumber);
      (auditService.logEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await service.bookAppointment(
        'temp-1',
        'doc-1',
        'A',
        'slot-1',
        new Date('2026-07-25T09:00:00Z')
      );

      expect(result.bookingId).toBe('booking-1');
      expect(result.queueNumber).toBe(5);
      expect(redis.incr).toHaveBeenCalledWith('queue:A:doc-rec-1');
      expect(auditService.logEvent).toHaveBeenCalled();
    });

    it('should throw error if temp patient not found', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [] }), // SELECT temp returns empty
        release: jest.fn(),
      };
      (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);

      await expect(service.bookAppointment('invalid', 'doc-1', 'A', 'slot-1', new Date()))
        .rejects.toThrow('TEMP_PATIENT_NOT_FOUND');
    });

    it('should throw error if slot not available', async () => {
      const mockTempPatient = { id: 'temp-1', branch_id: 'A', full_name: 'John Doe', phone: '08123456789' };
      const mockDoctor = { id: 'doc-1', is_active: true };
      const mockSchedule = { session_start: '09:00:00', session_end: '12:00:00', max_patients_per_session: 4 };

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockTempPatient] }) // SELECT temp
          .mockResolvedValueOnce({ rows: [mockDoctor] }) // SELECT doctor user
          .mockResolvedValueOnce({ rows: [{ id: 'doc-rec-1' }] }) // SELECT doctor record
          .mockResolvedValueOnce({ rows: [mockSchedule] }) // SELECT schedule
          .mockResolvedValueOnce({ rows: [{ booked: '4' }] }), // count full
        release: jest.fn(),
      };
      (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);

      await expect(service.bookAppointment('temp-1', 'doc-1', 'A', 'slot-1', new Date()))
        .rejects.toThrow('SLOT_NOT_AVAILABLE');
    });
  });

  describe('convertTemporaryToPatient', () => {
    it('should convert temp to full patient successfully', async () => {
      const mockTempPatient = {
        id: 'temp-1',
        branch_id: 'A',
        full_name: 'John Doe',
        phone: '08123456789',
        converted_to_patient_id: null,
      };
      const mockUser = { id: 'user-1', branch_id: 'A' };
      const mockPatient = { id: 'patient-rec-1' };
      const mockToken = 'jwt-token';
      const mockRefreshToken = 'refresh-token';

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockTempPatient] }) // SELECT temp
          .mockResolvedValueOnce({ rows: [] }) // check email
          .mockResolvedValueOnce({ rows: [] }) // check username (no collision)
          .mockResolvedValueOnce({ rows: [mockUser] }) // INSERT users
          .mockResolvedValueOnce({ rows: [mockPatient] }) // INSERT patients
          .mockResolvedValueOnce({}) // UPDATE bookings
          .mockResolvedValueOnce({}) // UPDATE temporary_patients
          .mockResolvedValueOnce(undefined), // COMMIT
        release: jest.fn(),
      };
      (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);
      (PasswordService.hashPassword as jest.Mock).mockResolvedValue('hashed');
      (JwtService.generateToken as jest.Mock).mockReturnValue(mockToken);
      (JwtService.generateRefreshToken as jest.Mock).mockReturnValue(mockRefreshToken);
      (auditService.logEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await service.convertTemporaryToPatient(
        'temp-1',
        'john@test.com',
        'Password123!'
      );

      expect(result.patientId).toBe('user-1');
      expect(result.token).toBe(mockToken);
      expect(result.refreshToken).toBe(mockRefreshToken);
      expect(auditService.logEvent).toHaveBeenCalled();
    });

    it('should throw error if already converted', async () => {
      const mockTempPatient = {
        id: 'temp-1',
        branch_id: 'A',
        converted_to_patient_id: 'user-1',
      };
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockTempPatient] }),
        release: jest.fn(),
      };
      (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);

      await expect(service.convertTemporaryToPatient('temp-1', 'john@test.com', 'pass'))
        .rejects.toThrow('TEMP_PATIENT_ALREADY_CONVERTED');
    });

    it('should throw error if email already exists', async () => {
      const mockTempPatient = {
        id: 'temp-1',
        branch_id: 'A',
        converted_to_patient_id: null,
      };
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockTempPatient] }) // SELECT temp
          .mockResolvedValueOnce({ rows: [{ id: 'existing-user' }] }), // email exists
        release: jest.fn(),
      };
      (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);

      await expect(service.convertTemporaryToPatient('temp-1', 'john@test.com', 'pass'))
        .rejects.toThrow('EMAIL_ALREADY_EXISTS');
    });
  });
});