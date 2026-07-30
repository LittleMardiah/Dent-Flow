import apiClient from '../axios';

export interface TimeSlot {
  start: string;
  end: string;
}

export interface DaySchedule {
  day: string;
  isActive: boolean;
  slots: TimeSlot[];
  breaks?: TimeSlot[];
}

export interface DoctorSchedule {
  doctorId: string;
  schedule: DaySchedule[];
  daysOff?: string[];
  replacementDoctorId?: string;
}

export interface DoctorSettings {
  phone: string;
  email: string;
  licenseNumber: string;
  specialization: string;
  consultationFee: number;
  availabilityPreferences: {
    maxPatientsPerDay: number;
    alertIfOverbooking: boolean;
    bufferBetweenAppointments: number;
  };
}

export const doctorScheduleApi = {
  // Get doctor schedule
  getSchedule: async (doctorId: string): Promise<DoctorSchedule> => {
    const response = await apiClient.get(`/doctors/${doctorId}/schedule`);
    return response.data.data;
  },

  // Update doctor schedule
  updateSchedule: async (doctorId: string, data: Partial<DoctorSchedule>): Promise<DoctorSchedule> => {
    const response = await apiClient.put(`/doctors/${doctorId}/schedule`, data);
    return response.data.data;
  },

  // Update availability preferences
  updateAvailability: async (doctorId: string, data: DoctorSettings['availabilityPreferences']): Promise<any> => {
    const response = await apiClient.patch(`/doctors/${doctorId}/availability`, data);
    return response.data.data;
  },

  // Bulk assign days off
  setDaysOff: async (doctorId: string, daysOff: string[]): Promise<DoctorSchedule> => {
    const response = await apiClient.patch(`/doctors/${doctorId}/days-off`, { daysOff });
    return response.data.data;
  },

  // Get replacement doctor list
  getReplacementDoctors: async (doctorId: string): Promise<Array<{ id: string; fullName: string; specialization: string }>> => {
    const response = await apiClient.get(`/doctors/${doctorId}/replacements`);
    return response.data.data || [];
  },
};
