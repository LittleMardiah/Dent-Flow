import apiClient from '../axios';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  amount: number;
  status: 'UNPAID' | 'PAID' | 'OVERDUE';
  dueDate: string;
  createdAt: string;
  paidAt?: string;
  paymentMethod?: 'CASH' | 'TRANSFER' | 'GATEWAY';
  notes?: string;
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
  adminName: string;
}

export interface PaymentInput {
  amount: number;
  method: 'CASH' | 'TRANSFER';
  notes?: string;
}

export interface RevenueSummary {
  today: number;
  thisMonth: number;
  yearToDate: number;
  outstanding: number;
  totalInvoices: number;
  paidCount: number;
  unpaidCount: number;
}

export const invoicesApi = {
  // Get revenue summary
  getSummary: async (branchId: string): Promise<RevenueSummary> => {
    const response = await apiClient.get(`/invoices/summary?branchId=${branchId}`);
    return response.data.data;
  },

  // Get invoices with filters
  getInvoices: async (params: {
    branchId: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }): Promise<{ data: Invoice[]; total: number; page: number; totalPages: number }> => {
    const queryParams = new URLSearchParams();
    queryParams.append('branchId', params.branchId);
    if (params.status) queryParams.append('status', params.status);
    if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
    if (params.dateTo) queryParams.append('dateTo', params.dateTo);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    if (params.page) queryParams.append('page', String(params.page));
    if (params.limit) queryParams.append('limit', String(params.limit));

    const response = await apiClient.get(`/invoices?${queryParams.toString()}`);
    return response.data.data;
  },

  // Get single invoice detail
  getInvoice: async (id: string): Promise<Invoice> => {
    const response = await apiClient.get(`/invoices/${id}`);
    return response.data.data;
  },

  // Manual payment entry
  addPayment: async (id: string, data: PaymentInput): Promise<Invoice> => {
    const response = await apiClient.post(`/invoices/${id}/payments`, data);
    return response.data.data;
  },

  // Send payment reminder email
  sendReminder: async (id: string): Promise<void> => {
    await apiClient.post(`/invoices/${id}/send-reminder`);
  },

  // Download invoice PDF
  downloadPDF: async (id: string): Promise<Blob> => {
    const response = await apiClient.get(`/invoices/${id}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },
};
