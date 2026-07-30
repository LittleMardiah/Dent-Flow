import apiClient from '../axios';

export interface QueuePatient {
  id: string;
  queueNumber: number;
  patientId: string;
  patientName: string;
  checkInTime: string;
  status: 'WAITING' | 'BEING_CALLED' | 'IN_SERVICE' | 'COMPLETED';
  waitTimeMinutes: number;
  reason?: string;
}

export interface PatientQuickView {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  age?: number;
  medicalConditions: string[];
  allergies: string[];
  lastVisit: string;
  totalVisits: number;
}

export interface QueueResponse {
  data: QueuePatient[];
  currentPatient: QueuePatient | null;
  nextPatients: QueuePatient[];
  waitingCount: number;
}

export const doctorQueueApi = {
  // Get today's queue for doctor
  getQueue: async (doctorId: string): Promise<QueueResponse> => {
    const response = await apiClient.get(`/doctors/${doctorId}/queue-today`);
    return response.data.data;
  },

  // Call next patient
  readyNext: async (doctorId: string): Promise<QueuePatient> => {
    const response = await apiClient.post(`/doctors/${doctorId}/ready-next`);
    return response.data.data;
  },

  // Get patient quick view
  getPatientQuickView: async (patientId: string): Promise<PatientQuickView> => {
    const response = await apiClient.get(`/patients/${patientId}/quick-view`);
    return response.data.data;
  },

  // Create encounter (EMR)
  createEncounter: async (data: {
    bookingId: string;
    patientId: string;
    doctorId: string;
    complaint: string;
    diagnosis?: string;
    treatment: string;
    prescription?: string;
    notes?: string;
  }): Promise<{ id: string; invoiceId?: string }> => {
    const response = await apiClient.post('/encounters', data);
    return response.data.data;
  },
};
