import apiClient from '../axios';

export interface Doctor {
  id: string;
  fullName: string;
  specialization: string;
  branchId: string;
  isActive: boolean;
  rating?: number;
  photoUrl?: string;
}

export interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export interface BookingRequest {
  doctorId: string;
  slotId: string;
  notes?: string;
}

export interface BookingResponse {
  id: string;
  bookingCode: string;
  status: string;
  doctorName: string;
  specialization: string;
  branchName: string;
  slotStart: string;
  slotEnd: string;
  createdAt: string;
  paymentUrl?: string;
}

export interface PatientDashboardData {
  upcomingAppointment?: {
    id: string;
    doctorName: string;
    specialization: string;
    date: string;
    time: string;
  };
  recentBookings: Array<{
    id: string;
    doctorName: string;
    date: string;
    status: string;
  }>;
  healthTips: Array<{
    id: string;
    title: string;
    description: string;
    icon?: string;
  }>;
}

export const patientApi = {
  // Get dashboard data
  getDashboard: async (): Promise<PatientDashboardData> => {
    const response = await apiClient.get('/patient/dashboard');
    return response.data.data;
  },

  // Get available doctors
  getDoctors: async (branchId: string): Promise<Doctor[]> => {
    const response = await apiClient.get(`/doctors?branchId=${branchId}&available=true`);
    return response.data.data || [];
  },

  // Get time slots for a doctor on a specific date
  getSlots: async (doctorId: string, date: string): Promise<TimeSlot[]> => {
    const response = await apiClient.get(`/doctor/${doctorId}/slots?date=${date}`);
    return response.data.data || [];
  },

  // Create booking
  createBooking: async (data: BookingRequest): Promise<BookingResponse> => {
    const response = await apiClient.post('/bookings', data);
    return response.data.data;
  },

  // Get booking detail
  getBooking: async (id: string): Promise<BookingResponse> => {
    const response = await apiClient.get(`/bookings/${id}`);
    return response.data.data;
  },

  // Get payment URL (Midtrans redirect)
  getPaymentUrl: async (bookingId: string): Promise<{ paymentUrl: string }> => {
    const response = await apiClient.post(`/bookings/${bookingId}/payment`);
    return response.data.data;
  },
};
