import { getErrorMessage, getErrorStack } from "../utils/error.util";
import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

export class NotificationService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({ connectionString: config.database.url });
  }

  /**
   * Core method: log notification to database
   * (simulated send, actual SMS/email will be implemented in Phase 3)
   */
  private async logNotification(
    bookingId: string,
    patientId: string,
    type: 'CONFIRMATION' | 'REMINDER' | 'CANCELLATION',
    content: string
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO notifications (booking_id, patient_id, type, status, sent_at, content)
         VALUES ($1, $2, $3, 'SENT', NOW(), $4)
         RETURNING id`,
        [bookingId, patientId, type, content]
      );
      logger.info(`📧 Notification logged: ${type} for booking ${bookingId} (id: ${result.rows[0].id})`);
    } catch (error: unknown) {
      logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) }, 'Failed to log notification');
      throw new Error('NOTIFICATION_LOG_FAILED');
    } finally {
      client.release();
    }
  }

  /**
   * Get patient_id from booking_id
   */
  private async getPatientIdFromBooking(bookingId: string): Promise<string> {
    const result = await this.pool.query(
      'SELECT patient_id FROM bookings WHERE id = $1',
      [bookingId]
    );
    if (result.rows.length === 0) {
      throw new Error('BOOKING_NOT_FOUND');
    }
    return result.rows[0].patient_id;
  }

  /**
   * Send booking confirmation notification
   * Called after booking is created (will be integrated in Phase 3)
   */
  async sendBookingConfirmation(bookingId: string): Promise<void> {
    try {
      const patientId = await this.getPatientIdFromBooking(bookingId);
      const content = `Booking Anda berhasil dibuat. Kode booking: ${bookingId}. Silakan datang sesuai jadwal.`;
      await this.logNotification(bookingId, patientId, 'CONFIRMATION', content);
      logger.info(`✅ Booking confirmation sent for booking ${bookingId}`);
    } catch (error: unknown) {
      logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) }, `Failed to send booking confirmation for ${bookingId}`);
      throw error;
    }
  }

  /**
   * Send reminder SMS/Email
   * Called manually by admin or scheduled (Phase 3)
   */
  async sendReminderSMS(bookingId: string): Promise<void> {
    try {
      const patientId = await this.getPatientIdFromBooking(bookingId);
      const content = `Pengingat: Anda memiliki janji temu besok. Kode booking: ${bookingId}. Jangan lupa datang!`;
      await this.logNotification(bookingId, patientId, 'REMINDER', content);
      logger.info(`✅ Reminder sent for booking ${bookingId}`);
    } catch (error: unknown) {
      logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) }, `Failed to send reminder for ${bookingId}`);
      throw error;
    }
  }

  /**
   * Send appointment cancelled notification
   * Called when booking is cancelled (will be integrated in Phase 3)
   */
  async sendAppointmentCancelledNotification(bookingId: string): Promise<void> {
    try {
      const patientId = await this.getPatientIdFromBooking(bookingId);
      const content = `Booking Anda dengan kode ${bookingId} telah dibatalkan. Jika ada pertanyaan, hubungi klinik.`;
      await this.logNotification(bookingId, patientId, 'CANCELLATION', content);
      logger.info(`✅ Cancellation notification sent for booking ${bookingId}`);
    } catch (error: unknown) {
      logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) }, `Failed to send cancellation for ${bookingId}`);
      throw error;
    }
  }
}
