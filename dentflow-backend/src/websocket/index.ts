import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * Real-time WebSocket module (socket.io).
 *
 * - Ter-attach ke HTTP server yang sama (port 3001).
 * - Semua client boleh connect; jika membawa JWT yang valid,
 *   kita attach userId/branchId dan join ke room per cabang.
 * - Event penting: 'queue:updated' (dikirim broadcast per cabang saat antrian berubah).
 *
 * Frontend (dentflow-web) mengkonsumsi event ini di /tv-display dan admin/doctor queue.
 */

let io: SocketServer | null = null;

export interface QueueUpdatedPayload {
  branchId?: string;
  doctorId?: string;
  action?: string;
  timestamp: string;
}

export function initSocketIo(server: HttpServer): SocketServer {
  if (io) {
    return io;
  }

  io = new SocketServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.on('connection', (socket: Socket) => {
    const token = socket.handshake.auth?.token as string | undefined;

    let userId: string | undefined;
    let branchId: string | undefined;
    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwt.secret) as {
          userId?: string;
          branchId?: string;
        };
        userId = decoded.userId;
        branchId = decoded.branchId;
      } catch {
        userId = undefined;
        branchId = undefined;
      }
    }

    (socket as any).userId = userId;
    (socket as any).branchId = branchId;

    if (branchId) {
      socket.join(`branch:${branchId}`);
    }
    // Semua client juga join room publik agar event tanpa branch terkirim.
    socket.join('public');

    socket.on('subscribe:branch', (id: string) => {
      if (typeof id === 'string' && id) {
        socket.join(`branch:${id}`);
      }
    });

    socket.on('disconnect', () => {
      logger.debug(`Socket disconnected: ${socket.id}`);
    });
  });

  logger.info('✅ Socket.IO server initialized');
  return io;
}

export function getSocketIo(): SocketServer | null {
  return io;
}

/**
 * Broadcast queue:updated ke room per cabang (fallback: room publik).
 */
export function broadcastQueueUpdated(payload: {
  branchId?: string;
  doctorId?: string;
  action?: string;
}): void {
  if (!io) {
    return;
  }
  const data: QueueUpdatedPayload = {
    branchId: payload.branchId,
    doctorId: payload.doctorId,
    action: payload.action,
    timestamp: new Date().toISOString(),
  };

  if (payload.branchId) {
    io.to(`branch:${payload.branchId}`).emit('queue:updated', data);
    io.to('public').emit('queue:updated', data);
  } else {
    io.emit('queue:updated', data);
  }
}

/**
 * Broadcast tv:display:refresh (dipakai bila TV perlu auto-refresh penuh).
 */
export function broadcastTvDisplayRefresh(payload: {
  branchId?: string;
}): void {
  if (!io) {
    return;
  }
  const data = {
    branchId: payload.branchId,
    timestamp: new Date().toISOString(),
  };
  if (payload.branchId) {
    io.to(`branch:${payload.branchId}`).emit('tv:display:refresh', data);
    io.to('public').emit('tv:display:refresh', data);
  } else {
    io.emit('tv:display:refresh', data);
  }
}

/**
 * [TEST ONLY] Drop semua koneksi socket yang aktif.
 * Dipakai Cypress untuk memverifikasi polling fallback & auto-reconnect.
 */
export function dropAllSockets(): number {
  if (!io) {
    return 0;
  }
  let count = 0;
  for (const socket of io.sockets.sockets.values()) {
    socket.disconnect(true);
    count++;
  }
  return count;
}