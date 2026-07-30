'use client';

import { useState, useEffect, useCallback } from 'react';
import { patientEmrApi, Encounter, EncounterDetail } from '@/lib/api/patientEmr';

export function usePatientEmr() {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [selectedEncounter, setSelectedEncounter] = useState<EncounterDetail | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (page: number = 1) => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await patientEmrApi.getHistory(page);
      setEncounters(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
      setCurrentPage(result.page);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat riwayat kunjungan');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchEncounterDetail = useCallback(async (id: string) => {
    try {
      setIsDetailLoading(true);
      const data = await patientEmrApi.getEncounter(id);
      setSelectedEncounter(data);
      return data;
    } catch (err: any) {
      setError(err.message || 'Gagal memuat detail kunjungan');
      throw err;
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      fetchHistory(page);
    }
  }, [fetchHistory, totalPages]);

  const refresh = useCallback(() => {
    fetchHistory(currentPage);
  }, [fetchHistory, currentPage]);

  // Initial load
  useEffect(() => {
    fetchHistory(1);
  }, [fetchHistory]);

  return {
    encounters,
    selectedEncounter,
    total,
    totalPages,
    currentPage,
    isLoading,
    isDetailLoading,
    error,
    fetchHistory,
    fetchEncounterDetail,
    goToPage,
    refresh,
  };
}
