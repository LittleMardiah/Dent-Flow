import io from 'socket.io-client';
import { QueryClient } from '@tanstack/react-query';

// Event types (dari TDD Section 5)
export type WebSocketEvent =
  | { type: 'queue:updated'; data: any }
  | { type: 'slot:availability'; data: any }
  | { type: 'tv:display:refresh'; data: any }
  | { type: 'invoice:paid'; data: any }
  | { type: 'appointment:confirmed'; data: any }
  | { type: 'connect' }
  | { type: 'disconnect' }
  | { type: 'connect_error' };

type EventCallback = (data: any) => void;

class WebSocketService {
  private socket: any = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventHandlers: Map<string, EventCallback[]> = new Map();
  private queryClient: QueryClient | null = null;

  constructor(queryClient?: QueryClient) {
    if (queryClient) {
      this.queryClient = queryClient;
    }
  }

  connect(token: string): void {
    if (this.socket?.connected) {
      console.log('🔌 WebSocket already connected');
      return;
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 
                  process.env.NEXT_PUBLIC_API_URL?.replace('http', 'ws') || 
                  'ws://localhost:3001';

    console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);

    this.socket = io(wsUrl, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionAttempts: this.maxReconnectAttempts,
      transports: ['websocket', 'polling'],
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emitEvent('connect', null);
      this.showToast('WebSocket Terhubung', 'success');
    });

    this.socket.on('disconnect', (reason: any) => {
      console.warn(`🔴 WebSocket disconnected: ${reason}`);
      this.isConnected = false;
      this.emitEvent('disconnect', { reason });
      this.showToast('Koneksi WebSocket terputus, beralih ke polling', 'warning');
    });

    this.socket.on('connect_error', (error: any) => {
      console.error('❌ WebSocket connection error:', error);
      this.isConnected = false;
      this.emitEvent('connect_error', { error });
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.warn('⚠️ Max reconnect attempts reached, falling back to polling');
        this.showToast('WebSocket gagal terkoneksi, menggunakan polling', 'warning');
      }
    });

    // Register event handlers dari TDD Section 5
    this.socket.on('queue:updated', (data: any) => {
      console.log('📋 Queue updated:', data);
      this.emitEvent('queue:updated', data);
      if (this.queryClient) {
        this.queryClient.invalidateQueries({ queryKey: ['queue-display'] });
        this.queryClient.invalidateQueries({ queryKey: ['queue'] });
      }
    });

    this.socket.on('slot:availability', (data: any) => {
      console.log('📅 Slot availability changed:', data);
      this.emitEvent('slot:availability', data);
      if (this.queryClient) {
        this.queryClient.invalidateQueries({ queryKey: ['slots'] });
      }
    });

    this.socket.on('tv:display:refresh', (data: any) => {
      console.log('📺 TV display refresh:', data);
      this.emitEvent('tv:display:refresh', data);
      if (this.queryClient) {
        this.queryClient.invalidateQueries({ queryKey: ['tv-display'] });
      }
    });

    this.socket.on('invoice:paid', (data: any) => {
      console.log('💰 Invoice paid:', data);
      this.emitEvent('invoice:paid', data);
      if (this.queryClient) {
        this.queryClient.invalidateQueries({ queryKey: ['invoices'] });
      }
    });

    this.socket.on('appointment:confirmed', (data: any) => {
      console.log('✅ Appointment confirmed:', data);
      this.emitEvent('appointment:confirmed', data);
      if (this.queryClient) {
        this.queryClient.invalidateQueries({ queryKey: ['bookings'] });
        this.queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      console.log('🔌 WebSocket disconnected manually');
    }
  }

  on(event: WebSocketEvent['type'], callback: EventCallback): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(callback);
    
    return () => {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        const index = handlers.indexOf(callback);
        if (index !== -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  private emitEvent(event: WebSocketEvent['type'], data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((callback) => {
        try {
          callback(data);
        } catch (err) {
          console.error(`Error in event handler for ${event}:`, err);
        }
      });
    }
  }

  private showToast(message: string, type: 'success' | 'warning' | 'error'): void {
    const event = new CustomEvent('websocket-toast', {
      detail: { message, type },
    });
    window.dispatchEvent(event);
  }

  get isConnectedState(): boolean {
    return this.isConnected;
  }

  get socketInstance(): any {
    return this.socket;
  }
}

// Singleton instance
let webSocketService: WebSocketService | null = null;

export const getWebSocketService = (queryClient?: QueryClient): WebSocketService => {
  if (!webSocketService) {
    webSocketService = new WebSocketService(queryClient);
  }
  return webSocketService;
};

export const useWebSocket = (queryClient?: QueryClient) => {
  return getWebSocketService(queryClient);
};
