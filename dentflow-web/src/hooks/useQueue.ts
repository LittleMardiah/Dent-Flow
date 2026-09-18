'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { queueApi, QueuePatient } from '@/lib/api/queue';
import { useRealtime, type RealtimeEvent } from '@/hooks/useRealtime';

interface UseQueueOptions {
  branchId: string;
  doctorId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // in seconds (fallback polling)
}

export function useQueue({
  branchId,
  doctorId,
  autoRefresh = true,
  refreshInterval = 5,
}: UseQueueOptions) {
  const [queue, setQueue] = useState<QueuePatient[]>([]);
  const [nowServing, setNowServing] = useState<QueuePatient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await queueApi.getQueue(branchId, doctorId);
      setQueue(response.data);
      setNowServing(response.nowServing || null);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat antrian');
    } finally {
      setIsLoading(false);
    }
  }, [branchId, doctorId]);

  // Realtime: trigger REST refetch on queue events (debounced 500ms inside useRealtime).
  const { isLive } = useRealtime(
    branchId,
    useCallback(
      (event: RealtimeEvent) => {
        if (event.type !== 'queue:updated') return;
        void fetchQueue();
      },
      [fetchQueue],
    ),
  );

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Fallback polling 5s: preserves existing REST polling when realtime is not live.
  useEffect(() => {
    if (isLive || !autoRefresh) {
      stopPolling();
      return undefined;
    }
    if (pollIntervalRef.current) return undefined;
    pollIntervalRef.current = setInterval(fetchQueue, refreshInterval * 1000);
    return stopPolling;
  }, [isLive, autoRefresh, refreshInterval, fetchQueue, stopPolling]);

  // Initial fetch
  useEffect(() => {
    fetchQueue();

    return () => {
      stopPolling();
    };
  }, [fetchQueue, stopPolling]);

  // Manual refresh
  const refresh = useCallback(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Call next patient
  const callNext = useCallback(async (queueId: string) => {
    try {
      await queueApi.callNext(queueId);
      // Optimistic update
      setQueue((prev) =>
        prev.map((p) =>
          p.id === queueId ? { ...p, status: 'BEING_CALLED' } : p
        )
      );
    } catch (err: any) {
      setError(err.message || 'Gagal memanggil pasien');
      throw err;
    }
  }, []);

  // Complete patient
  const completePatient = useCallback(async (queueId: string) => {
    try {
      await queueApi.completePatient(queueId);
      // Optimistic update: remove from queue
      setQueue((prev) => prev.filter((p) => p.id !== queueId));
    } catch (err: any) {
      setError(err.message || 'Gagal menyelesaikan pasien');
      throw err;
    }
  }, []);

  // Add walk-in
  const addWalkIn = useCallback(async (data: {
    name: string;
    phone: string;
    age?: number;
    doctorId: string;
    branchId: string;
    complaint?: string;
  }) => {
    try {
      const result = await queueApi.addWalkIn(data);
      // Refresh queue to show new patient
      await fetchQueue();
      return result;
    } catch (err: any) {
      setError(err.message || 'Gagal menambahkan walk-in');
      throw err;
    }
  }, [fetchQueue]);

  // Export CSV
  const exportCSV = useCallback(async () => {
    try {
      const blob = await queueApi.exportQueue(branchId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `queue_${branchId}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Gagal mengekspor CSV');
      throw err;
    }
  }, [branchId]);

  return {
    queue,
    nowServing,
    isLoading,
    error,
    isLive,
    lastUpdated,
    refresh,
    callNext,
    completePatient,
    addWalkIn,
    exportCSV,
  };
}