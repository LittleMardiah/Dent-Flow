'use client';

import { useState, useEffect, useCallback } from 'react';
import { patientApi, PatientDashboardData, BookingResponse } from '@/lib/api/patient';

export function usePatient() {
  const [dashboard, setDashboard] = useState<PatientDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await patientApi.getDashboard();
      setDashboard(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat dashboard');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const refresh = fetchDashboard;

  return {
    dashboard,
    isLoading,
    error,
    refresh,
  };
}
