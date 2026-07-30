import apiClient from '../axios';

export interface PatientInvoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  amount: number;
  status: 'UNPAID' | 'PAID' | 'OVERDUE';
  paymentMethod?: 'CASH' | 'TRANSFER' | 'GATEWAY';
  paidAt?: string;
  paidAmount?: number;
  items?: InvoiceItem[];
  payments?: PaymentHistory[];
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface PaymentHistory {
  id: string;
  amount: number;
  method: string;
  paidAt: string;
  notes?: string;
}

export interface InvoicesResponse {
  data: PatientInvoice[];
  total: number;
  page: number;
  totalPages: number;
}

export const patientInvoicesApi = {
  // Get patient's invoices (paginated)
  getInvoices: async (
    page: number = 1,
    limit: number = 10,
    status?: string
  ): Promise<InvoicesResponse> => {
    const params = new URLSearchParams();
    params.append('page', String(page));
    params.append('limit', String(limit));
    if (status) params.append('status', status);
    const response = await apiClient.get(`/patients/invoices?${params.toString()}`);
    return response.data.data;
  },

  // Get single invoice detail
  getInvoice: async (id: string): Promise<PatientInvoice> => {
    const response = await apiClient.get(`/invoices/${id}`);
    return response.data.data;
  },

  // Pay invoice (redirect to Midtrans)
  payInvoice: async (id: string): Promise<{ redirectUrl: string }> => {
    const response = await apiClient.post(`/invoices/${id}/pay`);
    return response.data.data;
  },
};
