import { getErrorMessage, getErrorStack } from "../utils/error.util";
import { Pool } from 'pg';

import { logger } from '../utils/logger';
import { pool } from '../config/database';

export class NotificationService {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  /**
   * Core method: log notification to database
   */
  private async logNotification(
    bookingId: string,
    userId: string,
    type: 'CONFIRMATION' | 'REMINDER' | 'CANCELLATION',
    content: string
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO notifications (booking_id, patient_id, type, status, sent_at, content)
         VALUES ($1, $2, $3, 'SENT', NOW(), $4)
         RETURNING id`,
        [bookingId, userId, type, content]
      );
      logger.info({
        msg: `📧 Notification logged: ${type} for booking ${bookingId}`,
        notificationId: result.rows[0].id
      });
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
      `SELECT p.user_id FROM bookings b JOIN patients p ON p.id = b.patient_id WHERE b.id = $1`,
      [bookingId]
    );
    if (result.rows.length === 0) {
      throw new Error('BOOKING_NOT_FOUND');
    }
    return result.rows[0].user_id;
  }

  /**
   * Send booking confirmation notification
   */
  async sendBookingConfirmation(bookingId: string): Promise<void> {
    const patientId = await this.getPatientIdFromBooking(bookingId);
    const content = `Booking Anda telah dikonfirmasi. Kode booking: ${bookingId}. Terima kasih!`;
    await this.logNotification(bookingId, patientId, 'CONFIRMATION', content);
  }

  /**
   * Send reminder SMS notification
   */
  async sendReminderSMS(bookingId: string): Promise<void> {
    const patientId = await this.getPatientIdFromBooking(bookingId);
    const content = `Pengingat: Anda memiliki janji temu hari ini. Kode booking: ${bookingId}`;
    await this.logNotification(bookingId, patientId, 'REMINDER', content);
  }

  /**
   * Send appointment cancelled notification
   */
  async sendAppointmentCancelledNotification(bookingId: string): Promise<void> {
    const patientId = await this.getPatientIdFromBooking(bookingId);
    const content = `Booking Anda telah dibatalkan. Kode booking: ${bookingId}`;
    await this.logNotification(bookingId, patientId, 'CANCELLATION', content);
  }

  /**
   * Send NO-SHOW notification to patient and admin
   */
  async sendNoShowNotification(
    bookingId: string,
    patientId: string,
    bookingCode: string,
    sessionStart: Date,
    sessionEnd: Date
  ): Promise<void> {
    const patientRes = await this.pool.query(
      `SELECT user_id, full_name FROM patients WHERE id = $1`,
      [patientId]
    );
    if (patientRes.rows.length === 0) {
      throw new Error('PATIENT_NOT_FOUND');
    }
    const userId = patientRes.rows[0].user_id;
    const patientName = patientRes.rows[0].full_name || 'Pasien';

    const patientContent = `Anda terdaftar sebagai NO-SHOW untuk booking ${bookingCode} pada sesi ${sessionStart} - ${sessionEnd}. Silakan hubungi klinik untuk informasi lebih lanjut.`;
    await this.logNotification(bookingId, userId, 'CANCELLATION', patientContent);

    const branchRes = await this.pool.query(
      `SELECT branch_id FROM bookings WHERE id = $1`,
      [bookingId]
    );
    const branchId = branchRes.rows[0]?.branch_id;
    if (branchId) {
      const adminRes = await this.pool.query(
        `SELECT id FROM users WHERE branch_id = $1 AND role = 'ADMIN_BRANCH' LIMIT 1`,
        [branchId]
      );
      if (adminRes.rows.length > 0) {
        const adminId = adminRes.rows[0].id;
        const adminContent = `Pasien ${patientName} (${bookingCode}) tidak hadir pada sesi ${sessionStart} - ${sessionEnd}. Status: NO-SHOW.`;
        await this.logNotification(bookingId, adminId, 'CANCELLATION', adminContent);
      }
    }
  }

  /**
   * Send webhook failure alert to admin (simplified version)
   */
  async sendWebhookFailureAlert(
    webhookId: string,
    orderId: string,
    retryCount: number,
    lastError: string,
    branchId?: string,
    invoiceId?: string,
    bookingId?: string
  ): Promise<void> {
    const content = `Webhook permanently failed: ${webhookId}, Order: ${orderId}, Retry: ${retryCount}/3, Error: ${lastError}, Branch: ${branchId || "N/A"}, Invoice: ${invoiceId || "N/A"}, Booking: ${bookingId || "N/A"}`;

    // Log to console
    logger.error({
      msg: '🚨 Webhook permanent failure alert',
      webhookId,
      orderId,
      retryCount,
      lastError,
      branchId,
      invoiceId,
      bookingId,
    });

    // Send Slack if configured (simple)
    const slackUrl = process.env.SLACK_WEBHOOK_URL;
    if (slackUrl) {
      try {
        await fetch(slackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 Webhook Permanently Failed\nWebhook: ${webhookId}\nOrder: ${orderId}\nRetry: ${retryCount}/3\nError: ${lastError}`,
          }),
        });
        logger.info({ msg: '✅ Slack alert sent for webhook failure' });
      } catch (error) {
        logger.error({ error: getErrorMessage(error) }, 'Failed to send Slack alert');
      }
    }
  }
}

export const notificationService = new NotificationService();
