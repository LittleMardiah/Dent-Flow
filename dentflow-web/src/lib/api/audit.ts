import apiClient from '../axios';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId?: string;
  changes?: any;
  ipAddress?: string;
  userAgent?: string;
  branchId: string;
}

export interface AuditFilter {
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const auditApi = {
  // Get audit logs with filters
  getLogs: async (params: AuditFilter & { branchId: string }): Promise<{
    data: AuditLogEntry[];
    total: number;
    page: number;
    totalPages: number;
  }> => {
    const queryParams = new URLSearchParams();
    queryParams.append('branchId', params.branchId);
    if (params.action) queryParams.append('action', params.action);
    if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
    if (params.dateTo) queryParams.append('dateTo', params.dateTo);
    if (params.userId) queryParams.append('userId', params.userId);
    if (params.search) queryParams.append('search', params.search);
    if (params.page) queryParams.append('page', String(params.page));
    if (params.limit) queryParams.append('limit', String(params.limit));

    const response = await apiClient.get(`/audit-logs?${queryParams.toString()}`);
    return response.data.data;
  },

  // Export audit logs to CSV
  exportCSV: async (params: AuditFilter & { branchId: string }): Promise<Blob> => {
    const queryParams = new URLSearchParams();
    queryParams.append('branchId', params.branchId);
    if (params.action) queryParams.append('action', params.action);
    if (params.dateFrom) queryParams.append('dateFrom', params.dateFrom);
    if (params.dateTo) queryParams.append('dateTo', params.dateTo);
    if (params.userId) queryParams.append('userId', params.userId);
    if (params.search) queryParams.append('search', params.search);

    const response = await apiClient.get(`/audit-logs/export?${queryParams.toString()}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Get list of unique actions for filter
  getActions: async (branchId: string): Promise<string[]> => {
    const response = await apiClient.get(`/audit-logs/actions?branchId=${branchId}`);
    return response.data.data || [];
  },
};
