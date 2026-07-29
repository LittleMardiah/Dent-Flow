import apiClient from '../axios';

export interface QueuePatient {
  id: string;
  queueNumber: number;
  patientName: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  serviceType: string;
  checkInTime: string;
  status: 'WAITING' | 'BEING_CALLED' | 'IN_SERVICE' | 'COMPLETED' | 'NO_SHOW';
  estimatedWaitTime?: number; // in minutes
}

export interface QueueResponse {
  data: QueuePatient[];
  total: number;
  nowServing?: QueuePatient;
}

export const queueApi = {
  // Get queue for a branch
  getQueue: async (branchId: string, doctorId?: string): Promise<QueueResponse> => {
    const params = new URLSearchParams({ branchId });
    if (doctorId) params.append('doctorId', doctorId);
    const response = await apiClient.get(`/admin/queues?${params.toString()}`);
    return response.data;
  },

  // Call next patient
  callNext: async (queueId: string): Promise<void> => {
    await apiClient.post(`/queues/${queueId}/call-next`);
  },

  // Complete patient (mark as done)
  completePatient: async (queueId: string): Promise<void> => {
    await apiClient.post(`/queues/${queueId}/complete`);
  },

  // Add walk-in patient
  addWalkIn: async (data: {
    name: string;
    phone: string;
    age?: number;
    doctorId: string;
    branchId: string;
    complaint?: string;
  }): Promise<{ queueNumber: number; bookingId: string }> => {
    const response = await apiClient.post('/admin/check-in/walk-in', data);
    return response.data;
  },

  // Export queue to CSV
  exportQueue: async (branchId: string): Promise<Blob> => {
    const response = await apiClient.get(`/admin/queues/export?branchId=${branchId}`, {
      responseType: 'blob',
    });
    return response.data;
  },
};
