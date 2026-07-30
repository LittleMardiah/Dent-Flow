import apiClient from '../axios';

export interface PatientBooking {
  id: string;
  doctorName: string;
  specialization: string;
  branchName: string;
  date: string;
  time: string;
  reason: string;
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  canCancel: boolean;
  isToday: boolean;
}

export interface RescheduleData {
  date: string;
  time: string;
}

export interface FeedbackData {
  rating: number;
  comment: string;
}

export const patientBookingsApi = {
  // Get upcoming bookings
  getUpcoming: async (): Promise<PatientBooking[]> => {
    const response = await apiClient.get('/patients/bookings?status=upcoming');
    return response.data.data || [];
  },

  // Reschedule booking
  reschedule: async (id: string, data: RescheduleData): Promise<PatientBooking> => {
    const response = await apiClient.patch(`/bookings/${id}`, data);
    return response.data.data;
  },

  // Cancel booking
  cancel: async (id: string): Promise<void> => {
    await apiClient.delete(`/bookings/${id}`);
  },

  // Submit feedback
  submitFeedback: async (id: string, data: FeedbackData): Promise<void> => {
    await apiClient.post(`/bookings/${id}/feedback`, data);
  },

  // Generate iCal download
  getICal: (booking: PatientBooking): string => {
    const startDate = new Date(`${booking.date}T${booking.time}`);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour later
    const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//DentFlow//Appointment//EN',
      'BEGIN:VEVENT',
      `UID:${booking.id}@dentflow.com`,
      `DTSTAMP:${formatDate(new Date())}`,
      `DTSTART:${formatDate(startDate)}`,
      `DTEND:${formatDate(endDate)}`,
      `SUMMARY:Konsultasi dengan ${booking.doctorName}`,
      `DESCRIPTION:Dokter: ${booking.doctorName}\\nSpesialisasi: ${booking.specialization}\\nCabang: ${booking.branchName}\\nReason: ${booking.reason || 'Konsultasi'}`,
      `LOCATION:${booking.branchName}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  },

  // Download iCal file
  downloadICal: (booking: PatientBooking) => {
    const ics = patientBookingsApi.getICal(booking);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `appointment_${booking.id}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
