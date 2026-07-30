import apiClient from '../axios';

export interface PatientProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  photoUrl?: string;
  branchId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
}

export interface PatientSettings {
  privacy: {
    shareDataWithDoctors: boolean;
  };
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  language: 'EN' | 'ID';
  medicalConditions: string[];
  allergies: string[];
}

export interface ChangePasswordData {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const patientProfileApi = {
  // Get profile
  getProfile: async (): Promise<PatientProfile> => {
    const response = await apiClient.get('/patients/profile');
    return response.data.data;
  },

  // Update profile
  updateProfile: async (data: Partial<PatientProfile>): Promise<PatientProfile> => {
    const response = await apiClient.put('/patients/profile', data);
    return response.data.data;
  },

  // Upload photo
  uploadPhoto: async (file: File): Promise<{ photoUrl: string }> => {
    const formData = new FormData();
    formData.append('photo', file);
    const response = await apiClient.patch('/patients/profile/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },

  // Get emergency contacts
  getEmergencyContacts: async (): Promise<EmergencyContact[]> => {
    const response = await apiClient.get('/patients/emergency-contacts');
    return response.data.data || [];
  },

  // Add emergency contact
  addEmergencyContact: async (data: Omit<EmergencyContact, 'id'>): Promise<EmergencyContact> => {
    const response = await apiClient.post('/patients/emergency-contacts', data);
    return response.data.data;
  },

  // Delete emergency contact
  deleteEmergencyContact: async (id: string): Promise<void> => {
    await apiClient.delete(`/patients/emergency-contacts/${id}`);
  },

  // Get settings
  getSettings: async (): Promise<PatientSettings> => {
    const response = await apiClient.get('/patients/settings');
    return response.data.data;
  },

  // Update settings
  updateSettings: async (data: Partial<PatientSettings>): Promise<PatientSettings> => {
    const response = await apiClient.patch('/patients/settings', data);
    return response.data.data;
  },

  // Change password
  changePassword: async (data: ChangePasswordData): Promise<void> => {
    await apiClient.post('/patients/change-password', data);
  },
};
