'use client';

import { useState, useEffect, useCallback } from 'react';
import { auditApi, AuditLogEntry, AuditFilter } from '@/lib/api/audit';

interface UseAuditLogsOptions extends AuditFilter {
  branchId: string;
  autoFetch?: boolean;
}

export function useAuditLogs({
  branchId,
  action = '',
  dateFrom = '',
  dateTo = '',
  userId = '',
  search = '',
  page = 1,
  limit = 50,
  autoFetch = true,
}: UseAuditLogsOptions) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(page);
  const [actions, setActions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await auditApi.getLogs({
        branchId,
        action: action || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        userId: userId || undefined,
        search: search || undefined,
        page: currentPage,
        limit,
      });
      setLogs(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat audit log');
    } finally {
      setIsLoading(false);
    }
  }, [branchId, action, dateFrom, dateTo, userId, search, currentPage, limit]);

  const fetchActions = useCallback(async () => {
    try {
      const data = await auditApi.getActions(branchId);
      setActions(data);
    } catch (err: any) {
      console.error('Failed to fetch actions:', err);
    }
  }, [branchId]);

  const exportCSV = useCallback(async () => {
    try {
      setIsExporting(true);
      const blob = await auditApi.exportCSV({
        branchId,
        action: action || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        userId: userId || undefined,
        search: search || undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Gagal export CSV');
      throw err;
    } finally {
      setIsExporting(false);
    }
  }, [branchId, action, dateFrom, dateTo, userId, search]);

  const goToPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const refresh = useCallback(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (autoFetch && branchId) {
      fetchLogs();
      fetchActions();
    }
  }, [autoFetch, branchId, fetchLogs, fetchActions]);

  return {
    logs,
    total,
    totalPages,
    currentPage,
    actions,
    isLoading,
    isExporting,
    error,
    fetchLogs,
    exportCSV,
    goToPage,
    refresh,
  };
}
