import { Request, Response } from 'express';
import { NotificationService } from '../services/notification.service';
import { logger } from '../utils/logger';
import { getErrorMessage, getErrorStack } from '../utils/error.util';

export class NotificationHandler {
  constructor(private notificationService: NotificationService) {}

  /**
   * POST /api/admin/bookings/:id/send-reminder
   * Admin manually sends a reminder for a booking
   */
  sendReminder = async (req: Request, res: Response): Promise<void> => {
    try {
      const bookingId = req.params.id as string;
      const adminId = req.user?.userId;

      if (!adminId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      await this.notificationService.sendReminderSMS(bookingId);

      res.status(200).json({
        success: true,
        message: `Reminder sent for booking ${bookingId}`,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const stack = getErrorStack(error);
      logger.error({ error: message, stack });

      if (message === 'BOOKING_NOT_FOUND') {
        res.status(404).json({ success: false, error: 'BOOKING_NOT_FOUND', message: 'Booking not found' });
        return;
      }
      res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR', message: 'Server error' });
    }
  };

  /**
   * POST /api/admin/bookings/:id/send-confirmation
   * Admin resends confirmation
   */
  sendConfirmation = async (req: Request, res: Response): Promise<void> => {
    try {
      const bookingId = req.params.id as string;
      const adminId = req.user?.userId;

      if (!adminId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      await this.notificationService.sendBookingConfirmation(bookingId);

      res.status(200).json({
        success: true,
        message: `Confirmation sent for booking ${bookingId}`,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const stack = getErrorStack(error);
      logger.error({ error: message, stack });

      if (message === 'BOOKING_NOT_FOUND') {
        res.status(404).json({ success: false, error: 'BOOKING_NOT_FOUND', message: 'Booking not found' });
        return;
      }
      res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR', message: 'Server error' });
    }
  };
}
