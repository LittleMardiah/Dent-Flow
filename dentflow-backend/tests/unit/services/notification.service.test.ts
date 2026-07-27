import { NotificationService } from '../../../src/services/notification.service';
import { Pool } from 'pg';

// Mock pg dengan satu shared mockQuery
const mockQuery = jest.fn();
jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    query: mockQuery,
    connect: jest.fn(() => ({
      query: mockQuery,
      release: jest.fn(),
    })),
  })),
}));

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationService();
  });

  describe('sendBookingConfirmation', () => {
    it('should send booking confirmation and log to notifications', async () => {
      const bookingId = 'booking-123';
      const patientId = 'patient-456';

      mockQuery.mockResolvedValueOnce({ rows: [{ patient_id: patientId }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'notif-1' }] });

      await service.sendBookingConfirmation(bookingId);

      // Check first call: SELECT patient_id
      expect(mockQuery).toHaveBeenNthCalledWith(1, 
        expect.stringContaining('SELECT patient_id FROM bookings'),
        [bookingId]
      );

      // Check second call: INSERT INTO notifications
      // Parameters: bookingId, patientId, type, content
      const callArgs = mockQuery.mock.calls[1];
      expect(callArgs[0]).toContain('INSERT INTO notifications');
      expect(callArgs[1][0]).toBe(bookingId);
      expect(callArgs[1][1]).toBe(patientId);
      expect(callArgs[1][2]).toBe('CONFIRMATION');
      expect(callArgs[1][3]).toContain('Booking Anda berhasil dibuat');
    });

    it('should throw BOOKING_NOT_FOUND if booking does not exist', async () => {
      const bookingId = 'booking-123';
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(service.sendBookingConfirmation(bookingId)).rejects.toThrow('BOOKING_NOT_FOUND');
    });
  });

  describe('sendReminderSMS', () => {
    it('should send reminder and log to notifications', async () => {
      const bookingId = 'booking-123';
      const patientId = 'patient-456';

      mockQuery.mockResolvedValueOnce({ rows: [{ patient_id: patientId }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'notif-2' }] });

      await service.sendReminderSMS(bookingId);

      const callArgs = mockQuery.mock.calls[1];
      expect(callArgs[0]).toContain('INSERT INTO notifications');
      expect(callArgs[1][0]).toBe(bookingId);
      expect(callArgs[1][1]).toBe(patientId);
      expect(callArgs[1][2]).toBe('REMINDER');
      expect(callArgs[1][3]).toContain('Pengingat: Anda memiliki janji temu besok');
    });
  });

  describe('sendAppointmentCancelledNotification', () => {
    it('should send cancellation notification and log to notifications', async () => {
      const bookingId = 'booking-123';
      const patientId = 'patient-456';

      mockQuery.mockResolvedValueOnce({ rows: [{ patient_id: patientId }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'notif-3' }] });

      await service.sendAppointmentCancelledNotification(bookingId);

      const callArgs = mockQuery.mock.calls[1];
      expect(callArgs[0]).toContain('INSERT INTO notifications');
      expect(callArgs[1][0]).toBe(bookingId);
      expect(callArgs[1][1]).toBe(patientId);
      expect(callArgs[1][2]).toBe('CANCELLATION');
      expect(callArgs[1][3]).toContain('telah dibatalkan');
    });
  });
});
