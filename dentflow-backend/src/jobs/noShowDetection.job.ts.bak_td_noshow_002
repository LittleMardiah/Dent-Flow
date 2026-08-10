import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import { getErrorMessage, getErrorStack } from '../utils/error.util';
import { NotificationService } from '../services/notification.service';

const pool = new Pool({ connectionString: config.database.url });

export const noShowDetectionJob = {
  name: 'no-show-detection',
  schedule: '*/30 * * * *',
  
  async execute(): Promise<void> {
    const notificationService = new NotificationService();
    
    try {
      logger.info('🔄 Running NO-SHOW detection job...');
      
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
        
        for (const row of result.rows) {
          try {
            await notificationService.sendNoShowNotification(
              row.id,
              row.patient_id,
              row.booking_code,
              row.session_start,
              row.session_end
            );
            logger.info(`📧 NO-SHOW notification sent for booking ${row.booking_code}`);
          } catch (notifError) {
            logger.error(
              { error: notifError },
              `Failed to send notification for booking ${row.booking_code}`
            );
          }
        }
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
