import { queueService } from '../services/queue.service';
import { logger } from '../utils/logger';
import { getErrorMessage, getErrorStack } from '../utils/error.util';

export const resetQueueJob = {
  name: 'reset-queue',
  schedule: '0 0 * * *', // Every midnight

  async execute(): Promise<void> {
    try {
      logger.info('🔄 Running queue reset job...');

      await queueService.resetAllQueuesForDate();

      logger.info('✅ Queue reset job completed');
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const stack = getErrorStack(error);
      logger.error({ error: message, stack }, 'Queue reset job failed');
    }
  },
};
