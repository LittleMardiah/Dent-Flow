import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface RealtimeEvent {
  type: 'queue:updated' | 'invoice:paid';
  payload: {
    branchId?: string;
    doctorId?: string;
    action?: string;
    queueId?: string;
    invoiceId?: string;
    ts: string;
  };
}

export interface UseRealtimeResult {
  isLive: boolean; // true kalau channel SUBSCRIBED
  lastEvent: RealtimeEvent | null;
  channelStatus: string; // raw status untuk debug
}

const THROTTLE_MS = 500;

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function buildRealtimeEvent(type: RealtimeEvent['type'], raw: unknown): RealtimeEvent {
  const source =
    typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    type,
    payload: {
      branchId: asString(source.branchId),
      doctorId: asString(source.doctorId),
      action: asString(source.action),
      queueId: asString(source.queueId),
      invoiceId: asString(source.invoiceId),
      ts: asString(source.ts) ?? new Date().toISOString(),
    },
  };
}

function buildReconnectEvent(): RealtimeEvent {
  return {
    type: 'queue:updated',
    payload: { action: 'reconnect', ts: new Date().toISOString() },
  };
}

export function useRealtime(
  branchId: string | undefined,
  onEvent?: (event: RealtimeEvent) => void
): UseRealtimeResult {
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [channelStatus, setChannelStatus] = useState<string>('DISABLED');
  const lastFireRef = useRef<number>(0);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const emit = useCallback((event: RealtimeEvent, force = false): void => {
    const now = Date.now();
    if (!force && now - lastFireRef.current < THROTTLE_MS) {
      return;
    }
    lastFireRef.current = now;
    setLastEvent(event);
    onEventRef.current?.(event);
  }, []);

  useEffect(() => {
    const handleOffline = () => setStatus('DISCONNECTED');
    const handleOnline = () => setStatus('CONNECTING');
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    if (!supabase || !branchId) {
      setLastEvent(null);
      setChannelStatus('DISABLED');
      return undefined;
    }

    const client = supabase;
    let disposed = false;
    let previousStatus = '';

    const channel = client.channel(`dentflow:branch:${branchId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'queue:updated' }, (message) => {
        if (disposed) return;
        emit(buildRealtimeEvent('queue:updated', message.payload));
      })
      .on('broadcast', { event: 'invoice:paid' }, (message) => {
        if (disposed) return;
        emit(buildRealtimeEvent('invoice:paid', message.payload));
      })
      .subscribe((status) => {
        if (disposed) return;
        setChannelStatus(status);
        console.debug('[realtime] channel status:', status);
        // Saat channel disconnected, isLive akan menjadi false (karena status !== SUBSCRIBED)
        // ini akan memaksa useTVDisplay beralih ke polling mode
        if (status === 'DISCONNECTED') {
          console.debug('[realtime] WebSocket disconnected detected');
        }
        if (previousStatus === 'CHANNEL_ERROR' && status === 'SUBSCRIBED') {
          emit(buildReconnectEvent(), true);
        }
        previousStatus = status;
      });

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);

      disposed = true;
      void client.removeChannel(channel);
    };
  }, [branchId, emit]);

  return {
    isLive: channelStatus === 'SUBSCRIBED',
    lastEvent,
    channelStatus,
  };
}