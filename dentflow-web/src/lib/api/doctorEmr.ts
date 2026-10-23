import apiClient from '../axios';

export interface VitalSigns {
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  temperature?: number;
  weight?: number;
  height?: number;
}

export interface PrescriptionItem {
  id?: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}

export interface EncounterData {
  bookingId: string;
  patientId: string;
  doctorId: string;
  complaint: string;
  diagnosis?: string;
  treatment: string;
  notes?: string;
  vitalSigns?: VitalSigns;
  prescriptions?: PrescriptionItem[];
}

export interface InventoryItem {
  id: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
}

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
] as const;

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export interface EncounterDocument {
  id: string;
  originalName: string;
  mime: string;
  sizeBytes: number;
  createdAt: string;
  url: string | null;
}

export const doctorEmrApi = {
  // Get inventory for autocomplete
  getInventory: async (): Promise<InventoryItem[]> => {
    const response = await apiClient.get('/inventory');
    return response.data.data || [];
  },

  // Get patient's past prescriptions
  getPatientPrescriptions: async (patientId: string): Promise<PrescriptionItem[]> => {
    const response = await apiClient.get(`/patients/${patientId}/prescriptions`);
    return response.data.data || [];
  },

  // Create encounter (EMR) - auto triggers invoice
  createEncounter: async (data: EncounterData): Promise<{ id: string; invoiceId?: string }> => {
    const response = await apiClient.post('/encounters', data);
    return response.data.data;
  },

  // Create prescription (can be called separately if needed)
  createPrescription: async (data: {
    patientId: string;
    doctorId: string;
    encounterId?: string;
    items: PrescriptionItem[];
    notes?: string;
  }): Promise<{ id: string }> => {
    const response = await apiClient.post('/prescriptions', data);
    return response.data.data;
  },

  // Upload an encounter document via multipart FormData
  uploadEncounterDocument: async (
    encounterId: string,
    file: File
  ): Promise<{ id: string; url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post(`/encounters/${encounterId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },

  // List documents of an encounter (with signed download URLs)
  listEncounterDocuments: async (encounterId: string): Promise<EncounterDocument[]> => {
    const response = await apiClient.get(`/encounters/${encounterId}/documents`);
    return response.data.data || [];
  },

};
