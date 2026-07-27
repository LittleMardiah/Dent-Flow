import { logger } from '../utils/logger';

/**
 * NO-SHOW Detection Job
 * Menandai booking yang tidak check-in sampai sesi berakhir sebagai NO-SHOW.
 * 
 * Logika lengkap akan diimplementasikan di Week 3.
 * Saat ini hanya placeholder untuk memastikan job scheduler berjalan.
 */
export const noShowDetectionJob = {
  name: 'no-show-detection',
  schedule: '*/30 * * * *', // Every 30 minutes (cron expression)
  
  /**
   * Execute the job
   */
  async execute(): Promise<void> {
    try {
      logger.info('🔄 Running NO-SHOW detection job...');
      
      // TODO: Implement NO-SHOW detection logic in Week 3
      // 1. Query bookings where status = 'PAYMENT_CONFIRMED' 
      //    AND session_end < NOW() AND checked_in_at IS NULL
      // 2. Update status to 'NO_SHOW'
      // 3. Create audit log (APPOINTMENT_NO_SHOW)
      // 4. Send notification to patient
      
      logger.info('✅ NO-SHOW detection job completed (placeholder)');
    } catch (error: any) {
      logger.error({ error: error.message, stack: error.stack });
    }
  },
};
