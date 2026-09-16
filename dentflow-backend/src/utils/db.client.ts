import { getErrorMessage, getErrorStack } from "../utils/error.util";
import { pool } from '../config/database';
import { logger } from './logger';

// Consistent with config/database.ts: ONE shared pool untuk seluruh aplikasi.
export { pool };

// Test koneksi saat startup
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    await pool.query('SELECT 1');
    logger.info('✅ Database connection successful');
    return true;
  } catch (error: unknown) {
    logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) });
    logger.warn('⚠️ Database connection failed. Using fallback mode for development.');
    return false;
  }
};
