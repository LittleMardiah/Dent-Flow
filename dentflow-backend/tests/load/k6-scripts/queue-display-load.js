/**
 * TASK 5.1.8 - Load Testing: Queue Display Performance
 *
 * Simulasi TV display screen:
 *   - 1 persistent WebSocket (Socket.IO, auth via CONNECT packet) per VU
 *   - Polling GET /api/queue/status setiap 3 detik (fallback pattern dari frontend)
 *
 * Run:
 *   k6 run queue-display-load.js --vus 100 --duration 2m
 */
import { sleep } from 'k6';
import http from 'k6/http';
import ws from 'k6/ws';
import { check, group } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import {
  BASE_URL,
  WS_URL,
  BRANCH_ID,
  DOCTOR_ID,
  PATIENT,
  PATIENT_PASS,
  login,
  authHeaders,
} from './lib/helpers.js';

const pollLatency = new Trend('tv_poll_latency_ms', true);
const wsConnects = new Counter('ws_connects');
const wsDrops = new Counter('ws_drops');
const wsReconnects = new Counter('ws_reconnects');
const wsAuthOk = new Counter('ws_auth_ok');
const queueUpdatedEvents = new Counter('ws_queue_updated_events');

export const options = {
  vus: __ENV.VUS ? Number(__ENV.VUS) : 100,
  duration: __ENV.DURATION || '2m',
  thresholds: {
    tv_poll_latency_ms: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

export function setup() {
  const token = login(PATIENT, PATIENT_PASS, 'patient');
  return { token };
}

function pollQueueStatus(token) {
  const url =
    BASE_URL +
    '/api/queue/status?branch_id=' +
    BRANCH_ID +
    '&doctor_id=' +
    DOCTOR_ID;
  const res = http.get(url, { headers: authHeaders(token) });
  pollLatency.add(res.timings.duration);
  check(res, {
    'queue status 200': (r) => r.status === 200,
  });
  return res.status === 200;
}

function openScreen(token) {
  let authDone = false;

  ws.connect(
    WS_URL + '/socket.io/?EIO=4&transport=websocket',
    { tags: { name: 'wsTV', authed: Boolean(token) } },
    function (socket) {
      socket.on('open', function () {
        wsConnects.add(1);
      });

      socket.on('message', function (data) {
        if (typeof data !== 'string') return;
        if (data.startsWith('0')) {
          // engine.io open -> kirim Socket.IO CONNECT dengan auth token
          socket.send('40{"token":"' + token + '"}');
        }
        if (data.startsWith('40') && data.length > 2) {
          authDone = true;
          wsAuthOk.add(1);
          // polling fallback setiap 3 detik (pola sama dgn useTVDisplay)
          socket.setInterval(function () {
            pollQueueStatus(token);
          }, 3000);
        }
        if (data.startsWith('42')) {
          if (data.indexOf('queue:updated') > -1) {
            queueUpdatedEvents.add(1);
          }
        }
        if (data.startsWith('2')) {
          socket.send('3');
        }
      });

      socket.on('close', function () {
        wsDrops.add(1);
      });

      socket.on('error', function () {
        wsDrops.add(1);
      });

      socket.setTimeout(function () {
        if (!authDone) {
          socket.close(1000, 'auth-timeout');
        }
      }, 10000);
    }
  );

  return authDone;
}

export default function (data) {
  const token = data.token;
  let connected = false;

  group('tv-initial-fetch', function () {
    connected = pollQueueStatus(token);
  });

  group('tv-websocket', function () {
    connected = openScreen(token) || connected;
  });

  if (!connected) {
    wsReconnects.add(1);
    sleep(0.5);
  }
}