import { queueService } from '../services/queue.service';
import { logger } from '../utils/logger';
import { getErrorMessage, getErrorStack } from '../utils/error.util';

export const resetQueueJob = {
  name: 'reset-queue',
  schedule: '0 0 * * *', // Every midnight
  
  async execute(): Promise<void> {
    try {
      logger.info('🔄 Running queue reset job...');
      
      const result = await queueService.resetAllQueuesForDate();
      
      if (result && result.success) {
        logger.info(`✅ Queue reset completed: ${result.message}`);
      } else {
        logger.info('✅ Queue reset completed (no queues to reset)');
      }
      
      logger.info('✅ Queue reset job completed');
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const stack = getErrorStack(error);
      logger.error({ error: message, stack }, 'Queue reset job failed');
    }
  },
};
