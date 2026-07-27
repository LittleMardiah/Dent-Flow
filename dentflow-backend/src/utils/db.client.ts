import { Pool } from 'pg';
import { config } from '../config';
import { logger } from './logger';

// Buat pool dengan konfigurasi yang sudah terbukti berhasil di docker exec
// Kita tetap pakai pool, tapi dengan connection string yang sudah diverifikasi
export const pool = new Pool({
  connectionString: config.database.url,
  // Tambahkan parameter agar lebih stabil di Windows
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 10,
});

// Test koneksi saat startup
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    await pool.query('SELECT 1');
    logger.info('✅ Database connection successful');
    return true;
  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack });
    logger.warn('⚠️ Database connection failed. Using fallback mode for development.');
    return false;
  }
};
