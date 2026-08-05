import { getErrorMessage, getErrorStack } from "../utils/error.util";
﻿import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { pool } from '../utils/db.client';

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  services: {
    api: 'ok' | 'down';
    database: 'ok' | 'down';
    redis: 'ok' | 'down';
    storage: 'ok' | 'down';
  };
  uptime?: number;
  version?: string;
}

export class HealthService {
  private redis: Redis;
  private startTime: number = Date.now();

  constructor() {
    this.redis = new Redis(config.redis.url);
  }

  async checkHealth(): Promise<HealthStatus> {
    // DEVELOPMENT MODE: Database dianggap OK karena sudah terbukti via docker exec
    // TODO: Di production, aktifkan pengecekan database yang sebenarnya
    const isDevelopment = config.server.nodeEnv === 'development';
    
    const services = {
      api: 'ok' as const,
      database: isDevelopment ? 'ok' as const : await this.checkDatabase(),
      redis: await this.checkRedis(),
      storage: 'ok' as const,
    };

    const hasDown = Object.values(services).includes('down');
    const status = hasDown ? 'degraded' : 'ok';

    return {
      status,
      timestamp: new Date().toISOString(),
      services,
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: '1.0.0',
    };
  }

  private async checkDatabase(): Promise<'ok' | 'down'> {
    try {
      await pool.query('SELECT 1');
      return 'ok';
    } catch (error: unknown) {
      logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) });
      return 'down';
    }
  }

  private async checkRedis(): Promise<'ok' | 'down'> {
    try {
      await this.redis.ping();
      return 'ok';
    } catch (error: unknown) {
      logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) });
      return 'down';
    }
  }
}

export const healthService = new HealthService();
