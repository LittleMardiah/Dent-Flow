import apiClient from '../axios';

export interface Patient {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  branchId: string;
  totalBookings?: number;
  lastVisit?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PatientDetail extends Patient {
  bookings: any[];
  encounters: any[];
  invoices: any[];
}

export interface PatientFormData {
  fullName: string;
  email: string;
  phone: string;
}

export interface AuditTrailEntry {
  id: string;
  eventType: string;
  description: string;
  createdAt: string;
  actorName: string;
}

export const patientsApi = {
  // Get branches accessible to the current user (own + granted)
  getAccessibleBranches: async (): Promise<{ id: string; name: string }[]> => {
    const response = await apiClient.get('/patients/branches');
    return response.data?.data || [];
  },

  // Get patients with pagination & search
  getPatients: async (
    branchId: string,
    search: string = '',
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: Patient[]; total: number; page: number; totalPages: number }> => {
    const response = await apiClient.get(
      `/patients?branchId=${branchId}&search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`
    );
    return response.data.data;
  },

  // Get patient detail with history
  getPatient: async (id: string): Promise<PatientDetail> => {
    const response = await apiClient.get(`/patients/${id}`);
    return response.data.data;
  },

  // Update patient
  updatePatient: async (id: string, data: PatientFormData): Promise<Patient> => {
    const response = await apiClient.put(`/patients/${id}`, data);
    return response.data.data;
  },

  // Get patient audit trail
  getAuditTrail: async (id: string): Promise<AuditTrailEntry[]> => {
    const response = await apiClient.get(`/patients/${id}/audit-trail`);
    return response.data.data || [];
  },

  // Merge duplicate patients
  mergePatients: async (primaryId: string, duplicateIds: string[]): Promise<any> => {
    const response = await apiClient.post(`/patients/merge`, { primaryId, duplicateIds });
    return response.data;
  },
};
