import apiClient from '../axios';

export interface Encounter {
  id: string;
  date: string;
  doctorName: string;
  branchName: string;
  reason: string;
  status: 'COMPLETED' | 'CANCELLED';
  fee?: number;
  paymentStatus?: 'UNPAID' | 'PAID';
}

export interface EncounterDetail extends Encounter {
  chiefComplaint: string;
  treatmentNotes: string;
  prescription?: string;
  invoiceId?: string;
  // DIAGNOSIS is NOT included - privacy for patients
}

export interface EncountersResponse {
  data: Encounter[];
  total: number;
  page: number;
  totalPages: number;
}

export const patientEmrApi = {
  // Get patient's encounter history (paginated)
  getHistory: async (page: number = 1, limit: number = 10): Promise<EncountersResponse> => {
    const response = await apiClient.get(`/patient/emr-history?page=${page}&limit=${limit}`);
    return response.data.data;
  },

  // Get single encounter detail (patient-safe - no diagnosis)
  getEncounter: async (id: string): Promise<EncounterDetail> => {
    const response = await apiClient.get(`/patient/emr/${id}`);
    return response.data.data;
  },
};
