import Redis from 'ioredis';
import { config } from '.';
import { logger } from '../utils/logger';

export const redis = new Redis(config.redis.url);

redis.on('connect', () => {
  logger.info('✅ Redis connected');
});

redis.on('error', (err) => {
  logger.error({ error: err.message }, '❌ Redis connection error');
});

export default redis;
