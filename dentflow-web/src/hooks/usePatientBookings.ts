'use client';

import { useState, useEffect, useCallback } from 'react';
import { patientBookingsApi, PatientBooking, RescheduleData, FeedbackData } from '@/lib/api/patientBookings';

export function usePatientBookings() {
  const [bookings, setBookings] = useState<PatientBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchUpcoming = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await patientBookingsApi.getUpcoming();
      setBookings(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat janji temu');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reschedule = useCallback(async (id: string, data: RescheduleData) => {
    try {
      setIsRescheduling(true);
      const updated = await patientBookingsApi.reschedule(id, data);
      setBookings((prev) => prev.map((b) => (b.id === id ? updated : b)));
      return updated;
    } catch (err: any) {
      setError(err.message || 'Gagal mengubah jadwal');
      throw err;
    } finally {
      setIsRescheduling(false);
    }
  }, []);

  const cancel = useCallback(async (id: string) => {
    try {
      setIsCancelling(true);
      await patientBookingsApi.cancel(id);
      setBookings((prev) => prev.filter((b) => b.id !== id));
    } catch (err: any) {
      setError(err.message || 'Gagal membatalkan janji temu');
      throw err;
    } finally {
      setIsCancelling(false);
    }
  }, []);

  const submitFeedback = useCallback(async (id: string, data: FeedbackData) => {
    try {
      await patientBookingsApi.submitFeedback(id, data);
      // Mark as completed (or update status)
      setBookings((prev) => prev.map((b) => 
        b.id === id ? { ...b, status: 'COMPLETED' } : b
      ));
    } catch (err: any) {
      setError(err.message || 'Gagal mengirim feedback');
      throw err;
    }
  }, []);

  const downloadICal = useCallback((booking: PatientBooking) => {
    patientBookingsApi.downloadICal(booking);
  }, []);

  useEffect(() => {
    fetchUpcoming();
  }, [fetchUpcoming]);

  return {
    bookings,
    isLoading,
    error,
    isRescheduling,
    isCancelling,
    fetchUpcoming,
    reschedule,
    cancel,
    submitFeedback,
    downloadICal,
  };
}
