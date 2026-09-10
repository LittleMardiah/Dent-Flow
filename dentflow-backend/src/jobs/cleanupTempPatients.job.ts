
import { logger } from '../utils/logger';
import { pool } from '../config/database';


/**
 * Cleanup Temporary Patients Job
 * Menghapus temporary profiles yang sudah berumur > 7 hari dan belum dikonversi.
 * 
 * Schedule: Setiap hari jam 03:00 (3 AM)
 */
export const cleanupTempPatientsJob = {
  name: 'cleanup-temp-patients',
  schedule: '0 3 * * *', // Every day at 03:00

  /**
   * Execute the job
   */
  async execute(): Promise<void> {
    try {
      logger.info('🔄 Running cleanup temporary patients job...');

      // Delete temporary patients that are:
      // 1. Not converted (converted_to_patient_id IS NULL)
      // 2. Created more than 7 days ago
      // 3. Not deleted (deleted_at IS NULL, if using soft delete)
      const result = await pool.query(
        `DELETE FROM temporary_patients
         WHERE converted_to_patient_id IS NULL
           AND created_at < NOW() - INTERVAL '7 days'
           AND deleted_at IS NULL
         RETURNING id, full_name, created_at`
      );

      const deletedCount = result.rowCount || 0;
      const deletedRecords = result.rows;

      if (deletedCount > 0) {
        logger.info(`✅ Cleanup completed: ${deletedCount} temporary patient(s) deleted`);
        logger.debug(`   Deleted records: ${JSON.stringify(deletedRecords.map(r => ({ id: r.id, name: r.full_name, created_at: r.created_at })))}`);
      } else {
        logger.info('✅ Cleanup completed: No expired temporary patients found');
      }

      // Also log to audit (optional - bisa ditambahkan ke audit_logs)
      // Kita skip dulu karena audit log biasanya untuk user action, bukan sistem cleanup
    } catch (error: any) {
      logger.error({ error: error.message, stack: error.stack }, '❌ Cleanup temporary patients job failed');
    }
  },
};

export default cleanupTempPatientsJob;
