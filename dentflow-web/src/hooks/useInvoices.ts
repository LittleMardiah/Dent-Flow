'use client';

import { useState, useEffect, useCallback } from 'react';
import { invoicesApi, Invoice, RevenueSummary, PaymentInput } from '@/lib/api/invoices';

interface UseInvoicesOptions {
  branchId: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  autoFetch?: boolean;
}

export function useInvoices({
  branchId,
  status = '',
  dateFrom = '',
  dateTo = '',
  sortBy = 'createdAt',
  sortOrder = 'desc',
  page = 1,
  limit = 20,
  autoFetch = true,
}: UseInvoicesOptions) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(page);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await invoicesApi.getSummary(branchId);
      setSummary(data);
    } catch (err: any) {
      console.error('Failed to fetch summary:', err);
    }
  }, [branchId]);

  const fetchInvoices = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await invoicesApi.getInvoices({
        branchId,
        status: status || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy,
        sortOrder,
        page: currentPage,
        limit,
      });
      setInvoices(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data invoice');
    } finally {
      setIsLoading(false);
    }
  }, [branchId, status, dateFrom, dateTo, sortBy, sortOrder, currentPage, limit]);

  const fetchInvoiceDetail = useCallback(async (id: string) => {
    try {
      setIsDetailLoading(true);
      const data = await invoicesApi.getInvoice(id);
      setSelectedInvoice(data);
      return data;
    } catch (err: any) {
      setError(err.message || 'Gagal memuat detail invoice');
      throw err;
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const addPayment = useCallback(async (id: string, data: PaymentInput) => {
    try {
      const updated = await invoicesApi.addPayment(id, data);
      // Update the invoice in the list
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === id ? updated : inv))
      );
      // Update selected invoice if open
      if (selectedInvoice?.id === id) {
        setSelectedInvoice(updated);
      }
      // Refresh summary
      await fetchSummary();
      return updated;
    } catch (err: any) {
      throw new Error(err.message || 'Gagal input pembayaran');
    }
  }, [selectedInvoice, fetchSummary]);

  const sendReminder = useCallback(async (id: string) => {
    try {
      await invoicesApi.sendReminder(id);
    } catch (err: any) {
      throw new Error(err.message || 'Gagal mengirim reminder');
    }
  }, []);

  const downloadPDF = useCallback(async (id: string) => {
    try {
      const blob = await invoicesApi.downloadPDF(id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice_${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      throw new Error(err.message || 'Gagal download PDF');
    }
  }, []);

  const goToPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const refresh = useCallback(() => {
    fetchSummary();
    fetchInvoices();
  }, [fetchSummary, fetchInvoices]);

  useEffect(() => {
    if (autoFetch && branchId) {
      fetchSummary();
      fetchInvoices();
    }
  }, [autoFetch, branchId, fetchSummary, fetchInvoices]);

  return {
    invoices,
    summary,
    selectedInvoice,
    total,
    totalPages,
    currentPage,
    isLoading,
    isDetailLoading,
    error,
    fetchInvoices,
    fetchInvoiceDetail,
    addPayment,
    sendReminder,
    downloadPDF,
    goToPage,
    refresh,
  };
}
