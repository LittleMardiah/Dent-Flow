import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import { getErrorMessage, getErrorStack } from '../utils/error.util';

const pool = new Pool({ connectionString: config.database.url });

export const noShowDetectionJob = {
  name: 'no-show-detection',
  schedule: '*/30 * * * *',
  
  async execute(): Promise<void> {
    try {
      logger.info('🔄 Running NO-SHOW detection job...');
      
      // Query bookings yang sudah melewati session_end + grace period 15 menit
      const result = await pool.query(
        `UPDATE bookings 
         SET status = 'NO_SHOW', 
             no_show_at = NOW(), 
             updated_at = NOW()
         WHERE status = 'PAYMENT_CONFIRMED'
           AND session_end < NOW() - INTERVAL '15 minutes'
           AND checked_in_at IS NULL
         RETURNING id, patient_id, booking_code, session_start, session_end`
      );
      
      if (result.rows.length > 0) {
        logger.info(`✅ Marked ${result.rows.length} bookings as NO-SHOW`);
        
        // TODO: Send notifications to patients
        // TODO: Create audit logs
        // TODO: Update attendance statistics
      } else {
        logger.info('ℹ️ No NO-SHOW bookings found');
      }
      
      logger.info('✅ NO-SHOW detection job completed');
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const stack = getErrorStack(error);
      logger.error({ error: message, stack }, 'NO-SHOW detection job failed');
    }
  },
};
