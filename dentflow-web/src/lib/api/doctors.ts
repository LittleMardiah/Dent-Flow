import apiClient from '../axios';

export interface Doctor {
  id: string;
  userId: string;
  fullName: string;
  email: string;                    // <--- TAMBAHKAN
  specialization: string;
  licenseNumber: string;
  isActive: boolean;
  branchId: string;
  queueCount?: number;
  schedule?: any[];
}

export interface DoctorFormData {
  fullName: string;
  email: string;                    // <--- SUDAH ADA
  specialization: string;
  licenseNumber: string;
  password?: string;
}

export const doctorsApi = {
  // Get all doctors in branch
  getDoctors: async (branchId: string): Promise<Doctor[]> => {
    const response = await apiClient.get(`/doctors?branchId=${branchId}`);
    return response.data.data || [];
  },

  // Get single doctor
  getDoctor: async (id: string): Promise<Doctor> => {
    const response = await apiClient.get(`/doctors/${id}`);
    return response.data.data;
  },

  // Create new doctor
  createDoctor: async (data: DoctorFormData & { branchId: string }): Promise<Doctor> => {
    const response = await apiClient.post('/doctors', data);
    return response.data.data;
  },

  // Update doctor
  updateDoctor: async (id: string, data: Partial<DoctorFormData>): Promise<Doctor> => {
    const response = await apiClient.put(`/doctors/${id}`, data);
    return response.data.data;
  },

  // Toggle doctor status (activate/deactivate)
  toggleStatus: async (id: string, isActive: boolean): Promise<Doctor> => {
    const response = await apiClient.patch(`/doctors/${id}/status`, { isActive });
    return response.data.data;
  },

  // Get doctor schedule
  getSchedule: async (id: string): Promise<any[]> => {
    const response = await apiClient.get(`/doctors/${id}/schedule`);
    return response.data.data || [];
  },

  // Update doctor schedule
  updateSchedule: async (id: string, schedule: any[]): Promise<any> => {
    const response = await apiClient.put(`/doctors/${id}/schedule`, { schedule });
    return response.data;
  },
};
