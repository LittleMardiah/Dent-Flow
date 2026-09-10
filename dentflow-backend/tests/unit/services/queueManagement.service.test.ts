import { QueueManagementService } from '../../../src/services/queueManagement.service';
import { QueueService } from '../../../src/services/queue.service';
import { Pool } from 'pg';

jest.mock('pg');
jest.mock('../../../src/services/queue.service', () => ({
  QueueService: jest.fn().mockImplementation(() => ({
    resetAllQueuesForDate: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe('QueueManagementService', () => {
  let service: QueueManagementService;
  let mockPool: jest.Mocked<Pool>;
  let mockClient: any;
  let mockQueueService: jest.Mocked<QueueService>;

  beforeEach(() => {
    mockPool = new Pool() as jest.Mocked<Pool>;
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    mockPool.connect = jest.fn().mockResolvedValue(mockClient);
    mockQueueService = new QueueService() as jest.Mocked<QueueService>;

    service = new QueueManagementService();
    (service as any).pool = mockPool;
    (service as any).queueService = mockQueueService;

    jest.clearAllMocks();
  });

  describe('getQueueForDoctor', () => {
    it('should return mapped queue patients for a doctor', async () => {
      const mockRows = [
        {
          queue_id: 'queue-1',
          queue_number: 3,
          booking_id: 'booking-1',
          patient_id: 'patient-1',
          patient_name: 'Budi',
          booking_time: new Date('2026-08-17T09:00:00'),
          check_in_time: new Date('2026-08-17T08:45:00'),
          called_at: null,
          status: 'WAITING',
        },
      ];
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: mockRows });

      const result = await service.getQueueForDoctor('doctor-1', 'branch-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        queueId: 'queue-1',
        queueNumber: 3,
        bookingId: 'booking-1',
        patientId: 'patient-1',
        patientName: 'Budi',
        bookingTime: mockRows[0].booking_time,
        checkInTime: mockRows[0].check_in_time,
        calledAt: null,
        status: 'WAITING',
      });
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM queues q'),
        ['doctor-1', 'branch-1']
      );
    });

    it('should return empty array when no queue', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await service.getQueueForDoctor('doctor-1', 'branch-1');

      expect(result).toEqual([]);
    });
  });

  describe('getQueueStats', () => {
    it('should return computed stats', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [{ waiting: 5, being_called: 1, completed: 3, avg_wait_seconds: 600 }],
      });

      const result = await service.getQueueStats('doctor-1', 'branch-1');

      expect(result).toEqual({
        totalWaiting: 5,
        totalBeingCalled: 1,
        totalCompleted: 3,
        averageWaitTimeMinutes: 10,
      });
    });

    it('should default to 0 when stats are null', async () => {
      (mockPool.query as jest.Mock).mockResolvedValue({
        rows: [{ waiting: null, being_called: null, completed: null, avg_wait_seconds: null }],
      });

      const result = await service.getQueueStats('doctor-1', 'branch-1');

      expect(result).toEqual({
        totalWaiting: 0,
        totalBeingCalled: 0,
        totalCompleted: 0,
        averageWaitTimeMinutes: 0,
      });
    });
  });

  describe('callNextPatient', () => {
    it('should call next waiting patient and commit', async () => {
      const mockPatient = {
        id: 'queue-1',
        queue_number: 3,
        status: 'BEING_CALLED',
        called_at: new Date(),
      };
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockPatient] }) // UPDATE ... RETURNING
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await service.callNextPatient('doctor-1', 'branch-1');

      expect(result).toMatchObject({ id: 'queue-1', status: 'BEING_CALLED' });
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'BEING_CALLED'"),
        ['doctor-1', 'branch-1']
      );
    });

    it('should return null when no waiting patient', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // UPDATE no rows
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await service.callNextPatient('doctor-1', 'branch-1');

      expect(result).toBeNull();
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('DB_ERROR'));

      await expect(service.callNextPatient('doctor-1', 'branch-1')).rejects.toThrow('DB_ERROR');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('completePatient', () => {
    it('should complete patient and commit', async () => {
      const mockCompleted = { id: 'queue-1', status: 'COMPLETED' };
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockCompleted] }) // UPDATE ... RETURNING
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await service.completePatient('queue-1', 'doctor-1');

      expect(result).toMatchObject({ id: 'queue-1', status: 'COMPLETED' });
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'COMPLETED'"),
        ['queue-1', 'doctor-1']
      );
    });

    it('should return null when queue not found or not owned', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // UPDATE no rows
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await service.completePatient('queue-1', 'doctor-1');

      expect(result).toBeNull();
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('DB_ERROR'));

      await expect(service.completePatient('queue-1', 'doctor-1')).rejects.toThrow('DB_ERROR');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('resetAllQueuesForDate', () => {
    it('should delegate to queueService', async () => {
      const date = new Date('2026-08-17');
      (mockQueueService.resetAllQueuesForDate as jest.Mock).mockResolvedValue(undefined);

      await service.resetAllQueuesForDate(date);

      expect(mockQueueService.resetAllQueuesForDate).toHaveBeenCalledWith(date);
    });
  });
});