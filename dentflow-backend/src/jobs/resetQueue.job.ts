import { logger } from '../utils/logger';
import { queueService } from '../services/queue.service';

export const resetQueueJob = {
  name: 'reset-queue',
  schedule: '0 0 * * *', // Every day at midnight UTC
  
  async execute(): Promise<void> {
    try {
      logger.info('🔄 Running reset queue job...');
      const today = new Date();
      await queueService.resetAllQueuesForDate(today);
      logger.info('✅ Reset queue job completed successfully');
    } catch (error: any) {
      logger.error({ error: error.message, stack: error.stack }, '❌ Reset queue job failed');
    }
  },
};
