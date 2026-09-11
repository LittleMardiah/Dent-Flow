import apiClient from '../axios';

export interface DoctorProfile {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  specialization: string;
  licenseNumber: string;
  isActive: boolean;
  branchId: string;
  branch?: {
    id: string;
    name: string;
  };
  phone?: string;
}

export interface DoctorProfileUpdate {
  phone?: string;
  email?: string;
}

export interface MyPatient {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  totalVisits: number;
  lastVisit?: string;
}

export interface EncounterItem {
  id: string;
  patientId: string;
  patientName: string;
  complaint: string;
  diagnosis?: string;
  treatment: string;
  status: 'DRAFT' | 'COMPLETED';
  createdAt: string;
}

export interface PaginatedEncounters {
  data: EncounterItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface EncounterParams {
  page?: number;
  limit?: number;
  status?: string;
  date_from?: string;
  date_to?: string;
}

export const doctorProfileApi = {
  getMyProfile: async (): Promise<DoctorProfile> => {
    const response = await apiClient.get('/doctors/me');
    return response.data.data;
  },

  updateMyProfile: async (data: DoctorProfileUpdate): Promise<DoctorProfile> => {
    const response = await apiClient.put('/doctors/me', data);
    return response.data.data;
  },

  getMyPatients: async (doctorId: string): Promise<MyPatient[]> => {
    const response = await apiClient.get(`/doctors/${doctorId}/patients`);
    return response.data.data || [];
  },

  getMyEncounters: async (params: EncounterParams = {}): Promise<PaginatedEncounters> => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.status) searchParams.set('status', params.status);
    if (params.date_from) searchParams.set('date_from', params.date_from);
    if (params.date_to) searchParams.set('date_to', params.date_to);

    const query = searchParams.toString();
    const response = await apiClient.get(`/encounters${query ? `?${query}` : ''}`);
    return response.data.data;
  },
};
