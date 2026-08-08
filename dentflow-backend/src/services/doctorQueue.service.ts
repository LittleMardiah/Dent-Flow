import { logger } from '../utils/logger';
import { EncounterService } from './encounter.service';
import { QueueManagementService } from './queueManagement.service';
import { QueuePatient, QueueStats } from './queueManagement.service';

export class DoctorQueueService {
  private queueManagement: QueueManagementService;
  private encounterService: EncounterService;

  constructor() {
    this.queueManagement = new QueueManagementService();
    this.encounterService = new EncounterService();
  }

  async getQueueForDoctor(doctorId: string, branchId: string): Promise<QueuePatient[]> {
    return this.queueManagement.getQueueForDoctor(doctorId, branchId);
  }

  async checkInPatient(queueId: string, doctorId: string): Promise<{ queue: any; encounter: any }> {
    const queue = await this.queueManagement.completePatient(queueId, doctorId);
    if (!queue) {
      throw new Error('QUEUE_NOT_FOUND');
    }
    const encounter = await this.encounterService.startEncounter(queue.booking_id, doctorId, queue.branch_id);
    return { queue, encounter };
  }

  async getQueueStats(doctorId: string, branchId: string): Promise<QueueStats> {
    return this.queueManagement.getQueueStats(doctorId, branchId);
  }

  async callNextPatient(doctorId: string, branchId: string): Promise<any> {
    return this.queueManagement.callNextPatient(doctorId, branchId);
  }

  async completePatient(queueId: string, doctorId: string): Promise<any> {
    return this.queueManagement.completePatient(queueId, doctorId);
  }
}

export const doctorQueueService = new DoctorQueueService();
