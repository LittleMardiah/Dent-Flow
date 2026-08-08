import { DoctorQueueService } from '../../../src/services/doctorQueue.service';
import { QueueManagementService } from '../../../src/services/queueManagement.service';
import { EncounterService } from '../../../src/services/encounter.service';
import { auditService } from '../../../src/services/audit.service';

jest.mock('../../../src/services/queueManagement.service');
jest.mock('../../../src/services/encounter.service');
jest.mock('../../../src/services/audit.service');

describe('DoctorQueueService', () => {
  let service: DoctorQueueService;
  let mockQueueManagement: jest.Mocked<QueueManagementService>;
  let mockEncounterService: jest.Mocked<EncounterService>;

  beforeEach(() => {
    mockQueueManagement = new QueueManagementService() as jest.Mocked<QueueManagementService>;
    mockEncounterService = new EncounterService() as jest.Mocked<EncounterService>;
    service = new DoctorQueueService();
    (service as any).queueManagement = mockQueueManagement;
    (service as any).encounterService = mockEncounterService;
  });

  afterEach(() => jest.clearAllMocks());

  describe('getQueueForDoctor', () => {
    it('should return queue sorted by queue_number', async () => {
      const mockRows = [
        { queueId: 'q1', queueNumber: 1, bookingId: 'b1', patientId: 'p1', patientName: 'John', bookingTime: new Date(), checkInTime: new Date(), calledAt: null, status: 'WAITING' },
        { queueId: 'q2', queueNumber: 2, bookingId: 'b2', patientId: 'p2', patientName: 'Jane', bookingTime: new Date(), checkInTime: new Date(), calledAt: null, status: 'WAITING' },
      ];
      mockQueueManagement.getQueueForDoctor = jest.fn().mockResolvedValue(mockRows);

      const result = await service.getQueueForDoctor('doc1', 'A');
      expect(result).toHaveLength(2);
      expect(result[0].queueNumber).toBe(1);
      expect(result[1].queueNumber).toBe(2);
      expect(mockQueueManagement.getQueueForDoctor).toHaveBeenCalledWith('doc1', 'A');
    });

    it('should return empty array if no queue', async () => {
      mockQueueManagement.getQueueForDoctor = jest.fn().mockResolvedValue([]);
      const result = await service.getQueueForDoctor('doc1', 'A');
      expect(result).toEqual([]);
    });
  });

  describe('checkInPatient', () => {
    it('should update queue to BEING_CALLED and create encounter', async () => {
      const mockQueue = { id: 'q1', doctor_id: 'doc1', booking_id: 'b1', branch_id: 'A', status: 'WAITING' };
      const mockEncounter = { id: 'enc1', booking_id: 'b1' };
      mockQueueManagement.completePatient = jest.fn().mockResolvedValue(mockQueue);
      mockEncounterService.startEncounter = jest.fn().mockResolvedValue(mockEncounter);

      const result = await service.checkInPatient('q1', 'doc1');
      expect(result.queue).toEqual(mockQueue);
      expect(result.encounter).toEqual(mockEncounter);
      expect(mockQueueManagement.completePatient).toHaveBeenCalledWith('q1', 'doc1');
      expect(mockEncounterService.startEncounter).toHaveBeenCalledWith('b1', 'doc1', 'A');
    });

    it('should throw error if queue not found', async () => {
      mockQueueManagement.completePatient = jest.fn().mockResolvedValue(null);
      await expect(service.checkInPatient('q1', 'doc1')).rejects.toThrow('QUEUE_NOT_FOUND');
    });
  });

  describe('getQueueStats', () => {
    it('should return correct statistics', async () => {
      const mockStats = { totalWaiting: 3, totalBeingCalled: 1, totalCompleted: 2, averageWaitTimeMinutes: 5 };
      mockQueueManagement.getQueueStats = jest.fn().mockResolvedValue(mockStats);

      const result = await service.getQueueStats('doc1', 'A');
      expect(result).toEqual(mockStats);
      expect(mockQueueManagement.getQueueStats).toHaveBeenCalledWith('doc1', 'A');
    });

    it('should return zeros if no data', async () => {
      const mockStats = { totalWaiting: 0, totalBeingCalled: 0, totalCompleted: 0, averageWaitTimeMinutes: 0 };
      mockQueueManagement.getQueueStats = jest.fn().mockResolvedValue(mockStats);
      const result = await service.getQueueStats('doc1', 'A');
      expect(result).toEqual(mockStats);
    });
  });

  describe('callNextPatient', () => {
    it('should call queueManagement.callNextPatient', async () => {
      mockQueueManagement.callNextPatient = jest.fn().mockResolvedValue({ id: 'q1' });
      const result = await service.callNextPatient('doc1', 'A');
      expect(result).toEqual({ id: 'q1' });
      expect(mockQueueManagement.callNextPatient).toHaveBeenCalledWith('doc1', 'A');
    });
  });

  describe('completePatient', () => {
    it('should call queueManagement.completePatient', async () => {
      mockQueueManagement.completePatient = jest.fn().mockResolvedValue({ id: 'q1' });
      const result = await service.completePatient('q1', 'doc1');
      expect(result).toEqual({ id: 'q1' });
      expect(mockQueueManagement.completePatient).toHaveBeenCalledWith('q1', 'doc1');
    });
  });
});
