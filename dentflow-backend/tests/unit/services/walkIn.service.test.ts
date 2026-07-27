import { WalkInService } from '../../../src/services/walkIn.service';
import { Pool } from 'pg';
import { auditService } from '../../../src/services/audit.service';
import { QueueService } from '../../../src/services/queue.service';
import { PasswordService } from '../../../src/utils/password.utils';
import { JwtService } from '../../../src/utils/jwt.utils';

jest.mock('pg');
jest.mock('../../../src/services/audit.service');
jest.mock('../../../src/services/queue.service');
jest.mock('../../../src/utils/password.utils');
jest.mock('../../../src/utils/jwt.utils');

describe('WalkInService', () => {
  let service: WalkInService;
  let mockPool: jest.Mocked<Pool>;
  let mockQueueService: jest.Mocked<QueueService>;

  beforeEach(() => {
    mockPool = new Pool() as jest.Mocked<Pool>;
    mockQueueService = new QueueService() as jest.Mocked<QueueService>;
    service = new WalkInService();
    (service as any).pool = mockPool;
    (service as any).queueService = mockQueueService;
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
      const mockBooking = { id: 'booking-1' };
      const mockQueueNumber = 5;

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockTempPatient] }) // SELECT temp
          .mockResolvedValueOnce({ rows: [mockDoctor] }) // SELECT doctor
          // NO QUERY untuk queue number (diambil dari queueService)
          .mockResolvedValueOnce({ rows: [mockBooking] }) // INSERT booking
          .mockResolvedValueOnce({}) // INSERT queue
          .mockResolvedValueOnce(undefined), // COMMIT
        release: jest.fn(),
      };
      (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);
      mockQueueService.getNextQueueNumber = jest.fn().mockResolvedValue(mockQueueNumber);
      (auditService.logEvent as jest.Mock).mockResolvedValue(undefined);

      const result = await service.bookAppointment(
        'temp-1',
        'doc-1',
        'A',
        'slot-1',
        new Date('2026-07-25')
      );

      expect(result.bookingId).toBe('booking-1');
      expect(result.queueNumber).toBe(5);
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
      const mockPatient = { id: 'patient-1' };
      const mockToken = 'jwt-token';
      const mockRefreshToken = 'refresh-token';

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [mockTempPatient] })
          .mockResolvedValueOnce({ rows: [] }) // check email
          .mockResolvedValueOnce({ rows: [mockUser] })
          .mockResolvedValueOnce({ rows: [mockPatient] })
          .mockResolvedValueOnce({}) // update bookings
          .mockResolvedValueOnce({}) // update queues
          .mockResolvedValueOnce({}) // update temp_patients
          .mockResolvedValueOnce(undefined), // commit
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
  });
});
