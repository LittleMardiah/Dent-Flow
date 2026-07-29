'use client';

import { useState, useEffect, useCallback } from 'react';
import { patientsApi, Patient, PatientDetail, PatientFormData, AuditTrailEntry } from '@/lib/api/patients';

interface UsePatientsOptions {
  branchId: string;
  search?: string;
  page?: number;
  limit?: number;
  autoFetch?: boolean;
}

export function usePatients({
  branchId,
  search = '',
  page = 1,
  limit = 20,
  autoFetch = true,
}: UsePatientsOptions) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(page);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<PatientDetail | null>(null);
  const [auditTrail, setAuditTrail] = useState<AuditTrailEntry[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const fetchPatients = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await patientsApi.getPatients(branchId, search, currentPage, limit);
      setPatients(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data pasien');
    } finally {
      setIsLoading(false);
    }
  }, [branchId, search, currentPage, limit]);

  useEffect(() => {
    if (autoFetch && branchId) {
      fetchPatients();
    }
  }, [autoFetch, branchId, search, currentPage, limit, fetchPatients]);

  const fetchPatientDetail = async (id: string) => {
    try {
      setIsDetailLoading(true);
      const data = await patientsApi.getPatient(id);
      setSelectedPatient(data);
      return data;
    } catch (err: any) {
      setError(err.message || 'Gagal memuat detail pasien');
      throw err;
    } finally {
      setIsDetailLoading(false);
    }
  };

  const fetchAuditTrail = async (id: string) => {
    try {
      const data = await patientsApi.getAuditTrail(id);
      setAuditTrail(data);
      return data;
    } catch (err: any) {
      setError(err.message || 'Gagal memuat audit trail');
      throw err;
    }
  };

  const updatePatient = async (id: string, data: PatientFormData) => {
    try {
      const updated = await patientsApi.updatePatient(id, data);
      setPatients((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
      if (selectedPatient?.id === id) {
        setSelectedPatient((prev) => prev ? { ...prev, ...updated } : null);
      }
      return updated;
    } catch (err: any) {
      throw new Error(err.message || 'Gagal mengupdate pasien');
    }
  };

  const mergePatients = async (primaryId: string, duplicateIds: string[]) => {
    try {
      const result = await patientsApi.mergePatients(primaryId, duplicateIds);
      await fetchPatients();
      return result;
    } catch (err: any) {
      throw new Error(err.message || 'Gagal merge pasien');
    }
  };

  const goToPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const refresh = fetchPatients;

  return {
    patients,
    total,
    totalPages,
    currentPage,
    isLoading,
    error,
    selectedPatient,
    auditTrail,
    isDetailLoading,
    fetchPatients,
    fetchPatientDetail,
    fetchAuditTrail,
    updatePatient,
    mergePatients,
    goToPage,
    refresh,
  };
}
