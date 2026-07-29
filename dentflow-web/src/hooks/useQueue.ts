'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { queueApi, QueuePatient, QueueResponse } from '@/lib/api/queue';
import { useAuth } from '@/context/AuthContext';

// WebSocket event types
type QueueEvent = 
  | { type: 'QUEUE_UPDATED'; data: QueuePatient[] }
  | { type: 'PATIENT_CALLED'; data: QueuePatient }
  | { type: 'PATIENT_COMPLETED'; data: { queueId: string } };

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
  refreshInterval = 5 
}: UseQueueOptions) {
  const [queue, setQueue] = useState<QueuePatient[]>([]);
  const [nowServing, setNowServing] = useState<QueuePatient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Setup WebSocket connection
  const setupWebSocket = useCallback(() => {
    if (!user?.branchId) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    const ws = new WebSocket(`${wsUrl}/ws/queue?branchId=${branchId}&token=${localStorage.getItem('dentflow_token')}`);

    ws.onopen = () => {
      console.log('✅ WebSocket connected for queue');
      setIsLive(true);
      // Stop polling when WebSocket is connected
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const payload: QueueEvent = JSON.parse(event.data);
        switch (payload.type) {
          case 'QUEUE_UPDATED':
            setQueue(payload.data);
            setLastUpdated(new Date());
            break;
          case 'PATIENT_CALLED':
            // Update queue: mark patient as BEING_CALLED
            setQueue((prev) =>
              prev.map((p) =>
                p.id === payload.data.id ? { ...p, status: 'BEING_CALLED' } : p
              )
            );
            setNowServing(payload.data);
            setLastUpdated(new Date());
            break;
          case 'PATIENT_COMPLETED':
            // Remove patient from queue
            setQueue((prev) => prev.filter((p) => p.id !== payload.data.queueId));
            setLastUpdated(new Date());
            break;
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      console.log('🔴 WebSocket disconnected, switching to polling');
      setIsLive(false);
      // Fallback to polling
      if (autoRefresh && !pollIntervalRef.current) {
        pollIntervalRef.current = setInterval(fetchQueue, refreshInterval * 1000);
      }
      // Attempt to reconnect after 5 seconds
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        setupWebSocket();
      }, 5000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      ws.close();
    };

    wsRef.current = ws;
  }, [branchId, user?.branchId, autoRefresh, refreshInterval, fetchQueue]);

  // Initial fetch and WebSocket setup
  useEffect(() => {
    fetchQueue();

    if (autoRefresh) {
      setupWebSocket();
    }

    return () => {
      // Cleanup
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [fetchQueue, autoRefresh, setupWebSocket]);

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
