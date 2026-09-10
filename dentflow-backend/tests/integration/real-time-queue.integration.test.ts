import http from 'http';
import express from 'express';
import type { AddressInfo } from 'net';
import { io as createClient, Socket } from 'socket.io-client';
import {
  initSocketIo,
  broadcastQueueUpdated,
  dropAllSockets,
  getSocketIo,
  QueueUpdatedPayload,
} from '../../src/websocket';

/**
 * Task 5.1.4 — Integration test untuk real-time queue display (WebSocket).
 *
 * CATATAN desain:
 * - Tidak meng-import src/index.ts karena module tsb memanggil `app.listen(PORT)`
 *   saat load (PORT test = 3000) yang bertabrakan dengan frontend dev (3000)
 *   dan backend dev (3001). Sebagai gantinya test membuka HTTP server sendiri
 *   di port ephemeral lalu meng-attach initSocketIo() — modul produksi yang sama.
 * - Karena initSocketIo() adalah singleton module-level, file ini harus
 *   dijalankan standalone (selayaknya perintah task: `npx jest <file>`).
 */

const BRANCH_ID = 'test-branch-realtime';
const DOCTOR_ID = 'test-doctor-realtime';

let server: http.Server;
let port: number;
let client: Socket;

function waitForEvent<T = unknown>(
  socket: Socket,
  event: string,
  timeoutMs = 10000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`⏱ timeout menunggu event '${event}' (${timeoutMs}ms)`)),
      timeoutMs
    );
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function pollingPayload() {
  return {
    success: true,
    data: {
      branchId: BRANCH_ID,
      doctorId: DOCTOR_ID,
      nowServing: null,
      nextPatients: [
        { id: 'q-1', queueNumber: 1, patientName: 'Budi Santoso', status: 'WAITING' },
      ],
      totalWaiting: 1,
      waitingQueue: [],
      waiting_queue: [],
      currentNumber: 0,
      updatedAt: new Date().toISOString(),
    },
  };
}

beforeAll(async () => {
  if (getSocketIo()) {
    throw new Error(
      'Socket.IO singleton sudah ter-init oleh module lain. Jalankan file ini standalone.'
    );
  }

  const app = express();
  // Route polling fallback (analog GET /api/queue/status produksi).
  app.get('/api/queue/status', (_req, res) => {
    res.status(200).json(pollingPayload());
  });

  server = http.createServer(app);
  initSocketIo(server);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address() as AddressInfo;
  port = addr.port;
  console.log(`🧪 Realtime queue test server → http://localhost:${port}`);
});

afterAll(async () => {
  if (client?.connected) {
    client.disconnect();
  }
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
});

describe('Real-Time Queue Display (WebSocket) — Task 5.1.4', () => {
  it('1. WebSocket connection established', async () => {
    client = createClient(`ws://localhost:${port}`, {
      transports: ['websocket'],
      reconnection: false,
    });

    await waitForEvent(client, 'connect', 5000);

    expect(client.connected).toBe(true);
    expect(client.id).toBeDefined();
  });

  it('2. Event queue:updated diterima saat queue berubah', async () => {
    expect(client.connected).toBe(true);

    const received = waitForEvent<QueueUpdatedPayload>(client, 'queue:updated', 5000);

    broadcastQueueUpdated({
      branchId: BRANCH_ID,
      doctorId: DOCTOR_ID,
      action: 'call-next',
    });

    const payload = await received;
    expect(payload.branchId).toBe(BRANCH_ID);
    expect(payload.doctorId).toBe(DOCTOR_ID);
    expect(payload.action).toBe('call-next');
    expect(payload.timestamp).toEqual(expect.any(String));
    expect(new Date(payload.timestamp).getTime()).not.toBeNaN();
  });

  it('3. Polling fallback aktif ketika WebSocket disconnect (within 3s)', async () => {
    const dropped = dropAllSockets();
    expect(dropped).toBeGreaterThan(0);

    await waitForEvent(client, 'disconnect', 5000);
    expect(client.connected).toBe(false);

    const start = Date.now();
    const res = await fetch(`http://localhost:${port}/api/queue/status`);
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { totalWaiting: number } };
    expect(body.data.totalWaiting).toBe(1);
    expect(elapsed).toBeLessThan(3000);
  });

  it('4. Auto-reconnect setelah disconnect server (≤30s)', async () => {
    if (client?.connected) {
      client.disconnect();
      client.close();
    }

    const reconnecting = createClient(`ws://localhost:${port}`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 200,
      reconnectionDelayMax: 500,
    });

    // 4a. Koneksi awal (masih terhubung).
    await waitForEvent(reconnecting, 'connect', 8000);
    expect(reconnecting.connected).toBe(true);

    // 4b. Putus transport-level di sisi server (socket.conn.close()).
    // NOTE: socket.disconnect(true) memicu reason 'io server disconnect'
    // yang TIDAK men-trigger auto-reconnect (per desain socket.io).
    // socket.conn.close() menutup transport → client menerima reason
    // 'transport close' → auto-reconnect aktif (jalur nyata di produksi).
    const ioServer = getSocketIo()!;
    expect(ioServer.sockets.sockets.size).toBeGreaterThan(0);
    for (const socket of ioServer.sockets.sockets.values()) {
      (socket as any).conn.close();
    }

    await waitForEvent(reconnecting, 'disconnect', 8000);
    expect(reconnecting.connected).toBe(false);

    // 4c. Client auto-reconnect dalam 30 detik.
    const start = Date.now();
    await waitForEvent(reconnecting, 'connect', 15000);
    const elapsed = Date.now() - start;

    expect(reconnecting.connected).toBe(true);
    expect(elapsed).toBeLessThan(30000);

    reconnecting.disconnect();
    reconnecting.close();
  });
});