'use client';

import { useState, useEffect, useCallback } from 'react';
import { doctorQueueApi, QueuePatient, PatientQuickView } from '@/lib/api/doctorQueue';
import { useWebSocketContext } from '@/context/WebSocketContext';

export function useDoctorQueue(doctorId: string) {
  const [queue, setQueue] = useState<QueuePatient[]>([]);
  const [currentPatient, setCurrentPatient] = useState<QueuePatient | null>(null);
  const [nextPatients, setNextPatients] = useState<QueuePatient[]>([]);
  const [waitingCount, setWaitingCount] = useState(0);
  const [selectedPatient, setSelectedPatient] = useState<PatientQuickView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isReadyNextLoading, setIsReadyNextLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { on } = useWebSocketContext();

  const fetchQueue = useCallback(async () => {
    if (!doctorId) return;
    try {
      setIsLoading(true);
      setError(null);
      const result = await doctorQueueApi.getQueue(doctorId);
      setQueue(result.data);
      setCurrentPatient(result.currentPatient);
      setNextPatients(result.nextPatients);
      setWaitingCount(result.waitingCount);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat antrian');
    } finally {
      setIsLoading(false);
    }
  }, [doctorId]);

  const readyNext = useCallback(async () => {
    if (!doctorId) return;
    try {
      setIsReadyNextLoading(true);
      const patient = await doctorQueueApi.readyNext(doctorId);
      // Refresh queue after calling next
      await fetchQueue();
      return patient;
    } catch (err: any) {
      setError(err.message || 'Gagal memanggil pasien berikutnya');
      throw err;
    } finally {
      setIsReadyNextLoading(false);
    }
  }, [doctorId, fetchQueue]);

  const getPatientQuickView = useCallback(async (patientId: string) => {
    try {
      setIsDetailLoading(true);
      const data = await doctorQueueApi.getPatientQuickView(patientId);
      setSelectedPatient(data);
      return data;
    } catch (err: any) {
      setError(err.message || 'Gagal memuat detail pasien');
      throw err;
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const createEncounter = useCallback(async (data: {
    bookingId: string;
    patientId: string;
    doctorId: string;
    complaint: string;
    diagnosis?: string;
    treatment: string;
    prescription?: string;
    notes?: string;
  }) => {
    try {
      const result = await doctorQueueApi.createEncounter(data);
      // Refresh queue after encounter
      await fetchQueue();
      return result;
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan EMR');
      throw err;
    }
  }, [doctorId, fetchQueue]);

  // WebSocket real-time updates
  useEffect(() => {
    if (!doctorId) return;

    const unsubscribe = on('queue:updated', (payload) => {
      if (payload?.doctorId === doctorId) {
        fetchQueue();
      }
    });

    return unsubscribe;
  }, [doctorId, on, fetchQueue]);

  // Initial fetch
  useEffect(() => {
    if (doctorId) {
      fetchQueue();
    }
  }, [doctorId, fetchQueue]);

  return {
    queue,
    currentPatient,
    nextPatients,
    waitingCount,
    selectedPatient,
    isLoading,
    isDetailLoading,
    isReadyNextLoading,
    error,
    fetchQueue,
    readyNext,
    getPatientQuickView,
    createEncounter,
    setSelectedPatient,
  };
}
