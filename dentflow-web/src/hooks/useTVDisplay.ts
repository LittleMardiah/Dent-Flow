'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { tvApi, TVDisplayData } from '@/lib/api/tv';
import { useWebSocketContext } from '@/context/WebSocketContext';

type ConnectionStatus = 'connected' | 'polling' | 'offline';

interface UseTVDisplayOptions {
  branchId: string;
  doctorId?: string;
  pollInterval?: number; // in seconds
}

export function useTVDisplay({
  branchId,
  doctorId,
  pollInterval = 3,
}: UseTVDisplayOptions) {
  const [data, setData] = useState<TVDisplayData | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('polling');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isConnected, on } = useWebSocketContext();
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  // Fetch data via polling
  const fetchData = useCallback(async () => {
    try {
      const result = await tvApi.getQueueStatus(branchId, doctorId);
      if (mountedRef.current) {
        setData(result);
        setLastUpdated(new Date());
        setError(null);
      }
      return result;
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message || 'Gagal memuat data antrian');
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [branchId, doctorId]);

  // Start polling
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    // Immediate fetch
    fetchData();
    pollIntervalRef.current = setInterval(fetchData, pollInterval * 1000);
    setStatus('polling');
  }, [fetchData, pollInterval]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Handle WebSocket events
  useEffect(() => {
    if (!branchId) return;

    // Subscribe to queue updates via WebSocket
    const unsubscribeQueue = on('queue:updated', (payload) => {
      if (payload?.branchId === branchId) {
        // Refresh data instantly via polling (or use WebSocket data directly)
        fetchData();
        setStatus('connected');
      }
    });

    // Subscribe to TV display refresh
    const unsubscribeTV = on('tv:display:refresh', (payload) => {
      if (payload?.branchId === branchId) {
        fetchData();
        setStatus('connected');
      }
    });

    return () => {
      unsubscribeQueue();
      unsubscribeTV();
    };
  }, [branchId, on, fetchData]);

  // Manage connection status & fallback
  useEffect(() => {
    if (isConnected) {
      // WebSocket connected - use it, but keep polling as backup
      setStatus('connected');
      stopPolling();
      // Still fetch once to ensure data
      fetchData();
      // But we also need polling fallback if WS dies
    } else {
      // WebSocket disconnected - switch to polling
      setStatus('polling');
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [isConnected, startPolling, stopPolling, fetchData]);

  // Initial fetch
  useEffect(() => {
    // Reset flag sebelum memulai fetch (penting utk React StrictMode / double-mount:
    // cleanup di bawah men-set mountedRef=false, harus di-reset true saat mount ulang).
    mountedRef.current = true;

    if (branchId) {
      fetchData();
      // Start polling anyway (fallback)
      startPolling();
    }

    return () => {
      mountedRef.current = false;
      stopPolling();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [branchId, fetchData, startPolling, stopPolling]);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    status,
    lastUpdated,
    isLoading,
    error,
    refresh,
  };
}
