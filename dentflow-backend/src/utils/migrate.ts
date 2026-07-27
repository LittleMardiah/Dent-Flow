import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { logger } from './logger';

const MIGRATIONS_TABLE = 'migrations';

const runMigrations = async () => {
  const pool = new Pool({ connectionString: config.database.url });
  
  try {
    // 1. Create migrations table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Get list of already applied migrations
    const appliedResult = await pool.query(
      `SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY id`
    );
    const applied = new Set(appliedResult.rows.map(row => row.name));

    // 3. Read all migration files
    const migrationsDir = path.join(__dirname, '../../migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      logger.warn('⚠️ No migration files found.');
      return;
    }

    logger.info(`📦 Found ${files.length} migration files.`);

    for (const file of files) {
      if (applied.has(file)) {
        logger.info(`⏭️ Skipping already applied migration: ${file}`);
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      
      logger.info(`🔄 Running migration: ${file}`);
      await pool.query(sql);
      
      // Record migration as applied
      await pool.query(
        `INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1)`,
        [file]
      );
      
      logger.info(`✅ Migration ${file} completed successfully.`);
    }

    logger.info('🎉 All migrations completed successfully!');
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, '❌ Migration failed');
    throw error;
  } finally {
    await pool.end();
  }
};

runMigrations();
