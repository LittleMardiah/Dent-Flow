import apiClient from '../axios';

export interface TVQueuePatient {
  id: string;
  queueNumber: number;
  patientName: string;
  status: 'WAITING' | 'BEING_CALLED' | 'IN_SERVICE' | 'COMPLETED';
}

export interface TVDisplayData {
  branchId: string;
  doctorId?: string;
  nowServing: TVQueuePatient | null;
  nextPatients: TVQueuePatient[];
  totalWaiting: number;
  updatedAt: string;
}

export const tvApi = {
  // Polling endpoint untuk TV display
  getQueueStatus: async (branchId: string, doctorId?: string): Promise<TVDisplayData> => {
    const params = new URLSearchParams();
    params.append('branch_id', branchId);
    if (doctorId) params.append('doctor_id', doctorId);
    const response = await apiClient.get(`/api/queue/status?${params.toString()}`);
    return response.data.data;
  },
};
