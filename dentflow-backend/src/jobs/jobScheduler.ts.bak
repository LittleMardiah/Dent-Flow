import cron from 'node-cron';
import { logger } from '../utils/logger';
import { getErrorMessage, getErrorStack } from '../utils/error.util';
import { noShowDetectionJob } from './noShowDetection.job';
import { resetQueueJob } from './resetQueue.job';
import { webhookRetryJob } from './webhookRetry.job';

export interface ScheduledJob {
  name: string;
  schedule: string;
  execute: () => Promise<void>;
}

export class JobScheduler {
  private jobs: Map<string, any> = new Map();
  private isInitialized: boolean = false;

  initialize(): void {
    if (this.isInitialized) {
      logger.warn('⚠️ Job scheduler already initialized');
      return;
    }

    const jobs: ScheduledJob[] = [
      noShowDetectionJob,
      resetQueueJob,
      webhookRetryJob,
    ];

    logger.info(`🚀 Initializing ${jobs.length} scheduled job(s)...`);

    for (const job of jobs) {
      try {
        const task = cron.schedule(job.schedule, async () => {
          try {
            await job.execute();
          } catch (error: unknown) {
            const message = getErrorMessage(error);
            const stack = getErrorStack(error);
            logger.error({ 
              error: message, 
              stack,
              job: job.name,
            });
          }
        });

        this.jobs.set(job.name, task);
        logger.info(`✅ Registered job: ${job.name} (${job.schedule})`);
      } catch (error: unknown) {
        const message = getErrorMessage(error);
        const stack = getErrorStack(error);
        logger.error({ 
          error: message, 
          stack,
          job: job.name,
        });
      }
    }

    this.isInitialized = true;
    logger.info('✅ Job scheduler initialized successfully');
  }

  stopAll(): void {
    for (const [name, task] of this.jobs) {
      task.stop();
      logger.info(`⏹️ Stopped job: ${name}`);
    }
    this.jobs.clear();
    this.isInitialized = false;
  }

  getStatus() {
    const jobs = Array.from(this.jobs.entries()).map(([name, task]) => ({
      name,
      running: task.getStatus() === 'running' || task.getStatus() === 'scheduled',
      status: task.getStatus(),
    }));

    return {
      initialized: this.isInitialized,
      totalJobs: this.jobs.size,
      jobs,
    };
  }
}

export const jobScheduler = new JobScheduler();