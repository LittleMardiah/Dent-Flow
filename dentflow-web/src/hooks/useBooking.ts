'use client';

import { useState, useCallback } from 'react';
import { patientApi, Doctor, TimeSlot, BookingRequest, BookingResponse } from '@/lib/api/patient';

export interface BookingStep {
  step: 'select-doctor' | 'select-slot' | 'confirm' | 'payment';
}

export function useBooking(branchId: string) {
  const [step, setStep] = useState<BookingStep['step']>('select-doctor');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [booking, setBooking] = useState<BookingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Fetch available doctors
  const fetchDoctors = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await patientApi.getDoctors(branchId);
      setDoctors(data);
      return data;
    } catch (err: any) {
      setError(err.message || 'Gagal memuat daftar dokter');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  // Fetch slots for selected doctor and date
  const fetchSlots = useCallback(async (doctorId: string, date: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await patientApi.getSlots(doctorId, date);
      setSlots(data);
      return data;
    } catch (err: any) {
      setError(err.message || 'Gagal memuat slot waktu');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Select doctor and fetch slots
  const selectDoctor = useCallback(async (doctor: Doctor, date?: string) => {
    setSelectedDoctor(doctor);
    const targetDate = date || selectedDate;
    setSelectedDate(targetDate);
    await fetchSlots(doctor.id, targetDate);
    setStep('select-slot');
  }, [selectedDate, fetchSlots]);

  // Select slot and move to confirm
  const selectSlot = useCallback((slot: TimeSlot) => {
    setSelectedSlot(slot);
    setStep('confirm');
  }, []);

  // Confirm booking
  const confirmBooking = useCallback(async (notes?: string) => {
    if (!selectedDoctor || !selectedSlot) {
      setError('Pilih dokter dan slot terlebih dahulu');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await patientApi.createBooking({
        doctorId: selectedDoctor.id,
        slotId: selectedSlot.id,
        notes,
      });
      setBooking(data);
      setStep('payment');
      return data;
    } catch (err: any) {
      setError(err.message || 'Gagal membuat booking');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [selectedDoctor, selectedSlot]);

  // Get payment URL and redirect
  const processPayment = useCallback(async (bookingId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const { paymentUrl } = await patientApi.getPaymentUrl(bookingId);
      if (paymentUrl) {
        // Redirect to Midtrans payment page
        window.location.href = paymentUrl;
      }
      return paymentUrl;
    } catch (err: any) {
      setError(err.message || 'Gagal memproses pembayaran');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Reset booking flow
  const resetBooking = useCallback(() => {
    setStep('select-doctor');
    setSelectedDoctor(null);
    setSelectedSlot(null);
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setBooking(null);
    setSlots([]);
    setError(null);
  }, []);

  // Go back one step
  const goBack = useCallback(() => {
    if (step === 'select-slot') {
      setStep('select-doctor');
      setSelectedSlot(null);
    } else if (step === 'confirm') {
      setStep('select-slot');
    } else if (step === 'payment') {
      setStep('confirm');
    }
  }, [step]);

  // Poll slots every 5 seconds (real-time availability)
  const startPolling = useCallback(() => {
    if (!selectedDoctor) return;
    setIsPolling(true);
    const interval = setInterval(() => {
      fetchSlots(selectedDoctor.id, selectedDate);
    }, 5000);
    return () => {
      clearInterval(interval);
      setIsPolling(false);
    };
  }, [selectedDoctor, selectedDate, fetchSlots]);

  return {
    step,
    doctors,
    selectedDoctor,
    slots,
    selectedSlot,
    selectedDate,
    booking,
    isLoading,
    error,
    isPolling,
    fetchDoctors,
    selectDoctor,
    selectSlot,
    setSelectedDate,
    confirmBooking,
    processPayment,
    resetBooking,
    goBack,
    startPolling,
  };
}
