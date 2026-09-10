import { Pool } from 'pg';
import { config } from './index';

// SINGLE source of truth untuk koneksi DB.
// Semua handler/service/job yang dulu bikin Pool sendiri diarahkan ke sini
// agar total koneksi ke Postgres terkontrol (sebelumnya 30+ pool independen
// menjebol max_connections=100 saat load tinggi).
export const pool = new Pool({
  connectionString: config.database.url,
  max: 60,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});
