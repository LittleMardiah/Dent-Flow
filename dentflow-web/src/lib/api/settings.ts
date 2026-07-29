import apiClient from '../axios';

export interface ClinicInfo {
  branchName: string;
  address: string;
  phone: string;
  email: string;
}

export interface BusinessHours {
  openTime: string;
  closeTime: string;
  breakStart?: string;
  breakEnd?: string;
  daysOpen: string[]; // ['monday', 'tuesday', ...]
}

export interface PaymentSettings {
  midtransClientKey: string;
  midtransServerKey: string;
  midtransWebhookUrl: string;
}

export interface NotificationSettings {
  emailReminders: boolean;
  smsGateway: boolean;
}

export interface Settings {
  clinic: ClinicInfo;
  hours: BusinessHours;
  payment: PaymentSettings;
  notifications: NotificationSettings;
}

export const settingsApi = {
  // Get settings
  getSettings: async (branchId: string): Promise<Settings> => {
    const response = await apiClient.get(`/settings?branchId=${branchId}`);
    return response.data.data;
  },

  // Update settings
  updateSettings: async (branchId: string, data: Partial<Settings>): Promise<Settings> => {
    const response = await apiClient.put(`/settings?branchId=${branchId}`, data);
    return response.data.data;
  },

  // Verify webhook
  verifyWebhook: async (branchId: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post(`/settings/verify-webhook?branchId=${branchId}`);
    return response.data;
  },
};
