import { getErrorMessage, getErrorStack } from "../utils/error.util";
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

export class QueueService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(config.redis.url);
  }

  /**
   * Get next queue number for a doctor on a specific date
   * Uses Redis INCR atomic operation (Rec #4)
   * Key format: "queue:{branchId}:{doctorId}:{YYYYMMDD}"
   * Returns: sequential number starting from 1
   */
  async getNextQueueNumber(
    branchId: string,
    doctorId: string,
    date: Date = new Date()
  ): Promise<number> {
    const dateStr = this.formatDate(date);
    const key = `queue:${branchId}:${doctorId}:${dateStr}`;
    
    try {
      const number = await this.redis.incr(key);
      logger.info(`🔢 Queue number ${number} generated for doctor ${doctorId} on ${dateStr}`);
      return number;
    } catch (error: unknown) {
      logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) }, 'Failed to generate queue number');
      throw new Error('QUEUE_GENERATION_FAILED');
    }
  }

  /**
   * Get current queue number (without incrementing)
   * Returns: current number or 0 if none
   */
  async getCurrentQueueNumber(
    branchId: string,
    doctorId: string,
    date: Date = new Date()
  ): Promise<number> {
    const dateStr = this.formatDate(date);
    const key = `queue:${branchId}:${doctorId}:${dateStr}`;
    const value = await this.redis.get(key);
    return value ? parseInt(value, 10) : 0;
  }

  /**
   * Reset queue counter for a doctor on a specific date
   * Deletes the key (effectively resets to 0)
   */
  async resetQueue(
    branchId: string,
    doctorId: string,
    date: Date = new Date()
  ): Promise<void> {
    const dateStr = this.formatDate(date);
    const key = `queue:${branchId}:${doctorId}:${dateStr}`;
    await this.redis.del(key);
    logger.info(`🔄 Queue reset for doctor ${doctorId} on ${dateStr}`);
  }

  /**
   * Reset all queues for a specific date (for cron job)
   * Scans all keys with prefix "queue:*:*:{dateStr}" and deletes them
   */
  async resetAllQueuesForDate(date: Date = new Date()): Promise<void> {
    const dateStr = this.formatDate(date);
    const pattern = `queue:*:*:${dateStr}`;
    let cursor = '0';
    let deletedCount = 0;

    do {
      const result = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = result[0];
      const keys = result[1];
      if (keys.length > 0) {
        await this.redis.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== '0');

    logger.info(`🔄 Reset all queues for ${dateStr}: ${deletedCount} keys deleted`);
  }

  /**
   * Get queue statistics for a doctor (or branch if doctorId not provided)
   */
  async getQueueStats(
    branchId: string,
    doctorId?: string,
    date: Date = new Date()
  ): Promise<{
    currentNumber: number;
    totalWaiting: number;
  }> {
    // If doctorId is not provided, we need to aggregate all doctors in branch
    // For simplicity, we'll return 0 or aggregate later
    // TODO: Implement aggregation if doctorId not provided
    if (!doctorId) {
      // For now, return dummy
      return {
        currentNumber: 0,
        totalWaiting: 0,
      };
    }
    const currentNumber = await this.getCurrentQueueNumber(branchId, doctorId, date);
    // For simplicity, totalWaiting = currentNumber - completed (but we don't track completed in Redis)
    // We'll return currentNumber as approximation
    return {
      currentNumber,
      totalWaiting: currentNumber, // This will be refined with DB query later
    };
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }
}

// Singleton instance
export const queueService = new QueueService();