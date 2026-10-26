'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { tvApi, TVDisplayData } from '@/lib/api/tv';
import { useRealtime, type RealtimeEvent } from '@/hooks/useRealtime';

type ConnectionStatus = 'connected' | 'polling' | 'offline';

interface UseTVDisplayOptions {
  branchId: string;
  doctorId?: string;
  pollInterval?: number;
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

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

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

  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    fetchData();
    pollIntervalRef.current = setInterval(fetchData, pollInterval * 1000);
    setStatus('polling');
  }, [fetchData, pollInterval]);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const { isLive } = useRealtime(
    branchId,
    useCallback(
      (event: RealtimeEvent) => {
        if (!mountedRef.current) return;
        if (event.type !== 'queue:updated') return;
        void fetchData();
      },
      [fetchData],
    ),
  );

  const isLiveRef = useRef(false);
  useEffect(() => {
    isLiveRef.current = isLive;
  }, [isLive]);

  useEffect(() => {
    if (!branchId) return;

    mountedRef.current = true;
    fetchData();
    startPolling();

    return () => {
      mountedRef.current = false;
      stopPolling();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [branchId, fetchData, startPolling, stopPolling]);

  useEffect(() => {
    if (isLive) {
      stopPolling();
      setStatus('connected');
      console.debug('[useTVDisplay] realtime live, polling stopped');
    } else {
      setStatus('polling');
      if (pollIntervalRef.current === null) {
        startPolling();
      }
    }
  }, [isLive, startPolling, stopPolling]);

  // Tambahan: watch isLive change to false (WS disconnect) dan pastikan polling aktif
  useEffect(() => {
    if (!isLive && status !== 'polling') {
      setStatus('polling');
      if (pollIntervalRef.current === null) {
        startPolling();
      }
    }
  }, [isLive, status]);

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
