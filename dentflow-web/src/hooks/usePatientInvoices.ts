'use client';

import { useState, useEffect, useCallback } from 'react';
import { patientInvoicesApi, PatientInvoice } from '@/lib/api/patientInvoices';

export function usePatientInvoices() {
  const [invoices, setInvoices] = useState<PatientInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<PatientInvoice | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async (page: number = 1) => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await patientInvoicesApi.getInvoices(
        page,
        10,
        statusFilter || undefined
      );
      setInvoices(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setCurrentPage(result.page);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat invoice');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  const fetchInvoiceDetail = useCallback(async (id: string) => {
    try {
      setIsDetailLoading(true);
      const data = await patientInvoicesApi.getInvoice(id);
      setSelectedInvoice(data);
      return data;
    } catch (err: any) {
      setError(err.message || 'Gagal memuat detail invoice');
      throw err;
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const payInvoice = useCallback(async (id: string) => {
    try {
      setIsPaying(true);
      const { redirectUrl } = await patientInvoicesApi.payInvoice(id);
      // Redirect ke Midtrans
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
      return redirectUrl;
    } catch (err: any) {
      setError(err.message || 'Gagal memproses pembayaran');
      throw err;
    } finally {
      setIsPaying(false);
    }
  }, []);

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      fetchInvoices(page);
    }
  }, [fetchInvoices, totalPages]);

  const refresh = useCallback(() => {
    fetchInvoices(currentPage);
  }, [fetchInvoices, currentPage]);

  // Initial load
  useEffect(() => {
    fetchInvoices(1);
  }, [fetchInvoices]);

  return {
    invoices,
    selectedInvoice,
    total,
    totalPages,
    currentPage,
    statusFilter,
    isLoading,
    isDetailLoading,
    isPaying,
    error,
    fetchInvoices,
    fetchInvoiceDetail,
    payInvoice,
    setStatusFilter,
    goToPage,
    refresh,
  };
}
