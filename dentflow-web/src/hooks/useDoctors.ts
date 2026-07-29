'use client';

import { useState, useEffect, useCallback } from 'react';
import { doctorsApi, Doctor, DoctorFormData } from '@/lib/api/doctors';

interface UseDoctorsOptions {
  branchId: string;
  autoFetch?: boolean;
}

export function useDoctors({ branchId, autoFetch = true }: UseDoctorsOptions) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDoctors = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await doctorsApi.getDoctors(branchId);
      setDoctors(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data dokter');
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    if (autoFetch && branchId) {
      fetchDoctors();
    }
  }, [autoFetch, branchId, fetchDoctors]);

  const createDoctor = async (data: DoctorFormData) => {
    try {
      const newDoctor = await doctorsApi.createDoctor({ ...data, branchId });
      setDoctors((prev) => [...prev, newDoctor]);
      return newDoctor;
    } catch (err: any) {
      throw new Error(err.message || 'Gagal menambah dokter');
    }
  };

  const updateDoctor = async (id: string, data: Partial<DoctorFormData>) => {
    try {
      const updated = await doctorsApi.updateDoctor(id, data);
      setDoctors((prev) => prev.map((d) => (d.id === id ? updated : d)));
      return updated;
    } catch (err: any) {
      throw new Error(err.message || 'Gagal mengupdate dokter');
    }
  };

  const toggleStatus = async (id: string) => {
    try {
      const doctor = doctors.find((d) => d.id === id);
      if (!doctor) throw new Error('Dokter tidak ditemukan');
      const updated = await doctorsApi.toggleStatus(id, !doctor.isActive);
      setDoctors((prev) => prev.map((d) => (d.id === id ? updated : d)));
      return updated;
    } catch (err: any) {
      throw new Error(err.message || 'Gagal mengubah status');
    }
  };

  const refresh = fetchDoctors;

  return {
    doctors,
    isLoading,
    error,
    createDoctor,
    updateDoctor,
    toggleStatus,
    refresh,
  };
}
