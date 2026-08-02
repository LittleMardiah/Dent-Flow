import { redis } from '../../src/config/redis';
import { queueService } from '../../src/services/queue.service';

describe('Queue Number Uniqueness & Redis Atomic Operations (Rec #4)', () => {
  const branchId = 'branch-concurrency-001';
  const doctorId = 'doctor-concurrency-001';
  const testDate = new Date('2026-07-22');

  beforeAll(async () => {
    // Bersihkan key sebelum test
    await queueService.resetQueue(branchId, doctorId, testDate);
  });

  afterAll(async () => {
    // Bersihkan setelah test
    await queueService.resetQueue(branchId, doctorId, testDate);
    await redis.quit();
  });

  it('should generate sequential numbers (1, 2, 3, ...)', async () => {
    const num1 = await queueService.getNextQueueNumber(branchId, doctorId, testDate);
    expect(num1).toBe(1);

    const num2 = await queueService.getNextQueueNumber(branchId, doctorId, testDate);
    expect(num2).toBe(2);

    const num3 = await queueService.getNextQueueNumber(branchId, doctorId, testDate);
    expect(num3).toBe(3);
  });

  it('should reset queue for a specific doctor', async () => {
    // Generate a number first
    await queueService.getNextQueueNumber(branchId, doctorId, testDate);
    const current = await queueService.getCurrentQueueNumber(branchId, doctorId, testDate);
    expect(current).toBeGreaterThan(0);

    // Reset
    await queueService.resetQueue(branchId, doctorId, testDate);
    const afterReset = await queueService.getCurrentQueueNumber(branchId, doctorId, testDate);
    expect(afterReset).toBe(0);
  });

  it('should generate unique numbers under concurrent load (100 requests)', async () => {
    // Reset first
    await queueService.resetQueue(branchId, doctorId, testDate);

    // Simulate 100 concurrent requests
    const promises = [];
    const count = 100;
    for (let i = 0; i < count; i++) {
      promises.push(queueService.getNextQueueNumber(branchId, doctorId, testDate));
    }

    const results = await Promise.all(promises);
    // Sort results
    const sorted = [...results].sort((a, b) => a - b);

    // Expect numbers 1..100 all present
    expect(sorted).toHaveLength(count);
    for (let i = 1; i <= count; i++) {
      expect(sorted[i - 1]).toBe(i);
    }

    // Check no duplicates
    const unique = new Set(results);
    expect(unique.size).toBe(count);
  });

  it('should reset all queues for a date', async () => {
    // Create multiple queues for different doctors
    const doctorIds = ['doc-1', 'doc-2', 'doc-3'];
    for (const docId of doctorIds) {
      await queueService.getNextQueueNumber(branchId, docId, testDate);
    }

    // Reset all for date
    await queueService.resetAllQueuesForDate(testDate);

    // Verify all reset
    for (const docId of doctorIds) {
      const current = await queueService.getCurrentQueueNumber(branchId, docId, testDate);
      expect(current).toBe(0);
    }
  });

  it('should get current queue number without increment', async () => {
    await queueService.resetQueue(branchId, doctorId, testDate);
    // Generate 5 numbers
    for (let i = 1; i <= 5; i++) {
      await queueService.getNextQueueNumber(branchId, doctorId, testDate);
    }
    const current = await queueService.getCurrentQueueNumber(branchId, doctorId, testDate);
    expect(current).toBe(5);
  });

  it('should get queue stats', async () => {
    await queueService.resetQueue(branchId, doctorId, testDate);
    await queueService.getNextQueueNumber(branchId, doctorId, testDate);
    await queueService.getNextQueueNumber(branchId, doctorId, testDate);
    const stats = await queueService.getQueueStats(branchId, doctorId, testDate);
    expect(stats.currentNumber).toBe(2);
    expect(stats.totalWaiting).toBe(2);
  });
});
