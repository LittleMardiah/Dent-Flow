/**
 * EXTREME BREAKING POINT TEST (Task 5.1.8 & 5.1.9)
 *
 * Push sistem sampai saturation: 500+ concurrent VUs.
 * Setiap VU = 1 WebSocket persistent + polling queue/status 2s + write berkala
 * (check-in admin utk 2/3 VU, ready-next doktor utk 1/3 VU).
 *
 * Run:
 *   k6 run extreme-test.js --vus 500 --duration 5m --stage 10s:100,30s:300,60s:500,30s:300,10s:100
 */
import { sleep } from 'k6';
import http from 'k6/http';
import ws from 'k6/ws';
import { check } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import {
  BASE_URL,
  WS_URL,
  BRANCH_ID,
  DOCTOR_ID,
  ADMIN,
  ADMIN_PASS,
  DOCTOR,
  DOCTOR_PASS,
  login,
  authHeaders,
} from './lib/helpers.js';

const wsConnects = new Counter('ws_connects');
const wsAuthOk = new Counter('ws_auth_ok');
const wsDrops = new Counter('ws_drops');
const wsReconnects = new Counter('ws_reconnects');
const httpTopLatency = new Trend('http_top_latency_ms', true);
const writesSent = new Counter('writes_sent');
const serverErrorRate = new Rate('server_error_rate');

export const options = {
  stages: [
    { duration: '10s', target: 100 },
    { duration: '30s', target: 300 },
    { duration: '60s', target: 500 },
    { duration: '30s', target: 300 },
    { duration: '10s', target: 100 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.35'],
    server_error_rate: ['rate<0.10'],
  },
};

export function setup() {
  const admin = login(ADMIN, ADMIN_PASS, 'admin');
  const doctor = login(DOCTOR, DOCTOR_PASS, 'doctor');
  return { admin, doctor };
}

function pollQueueStatus(token) {
  const url =
    BASE_URL +
    '/api/queue/status?branch_id=' +
    BRANCH_ID +
    '&doctor_id=' +
    DOCTOR_ID;
  const res = http.get(url, {
    headers: authHeaders(token),
    tags: { name: 'extreme_queue_status' },
  });
  httpTopLatency.add(res.timings.duration);
  serverErrorRate.add(res.status >= 500 || res.status === 0);
  return res.status;
}

function doWrite(token, role) {
  const res =
    role === 'doctor'
      ? http.post(
          BASE_URL + '/api/doctors/' + DOCTOR_ID + '/ready-next',
          JSON.stringify({}),
          { headers: authHeaders(token), tags: { name: 'extreme_ready_next' } }
        )
      : http.post(
          BASE_URL + '/api/admin/check-in',
          JSON.stringify({ check_in_code: 'NWZ8MH', branch_id: BRANCH_ID }),
          { headers: authHeaders(token), tags: { name: 'extreme_checkin' } }
        );
  writesSent.add(1);
  serverErrorRate.add(res.status >= 500 || res.status === 0);
  return res.status;
}

function holdSocketWithLoad(data, token, role) {
  const connectStart = Date.now();
  let self = { authOk: false, poll: 0 };

  ws.connect(
    WS_URL + '/socket.io/?EIO=4&transport=websocket',
    { tags: { name: 'extremeWS' } },
    function (socket) {
      socket.on('open', function () {
        wsConnects.add(1);
      });
      socket.on('message', function (msg) {
        if (typeof msg !== 'string') return;
        if (msg.startsWith('0')) {
          socket.send('40{"token":"' + token + '"}');
        }
        if (msg.startsWith('40') && msg.length > 2) {
          self.authOk = true;
          wsAuthOk.add(1);
          socket.setInterval(function () {
            self.poll++;
            pollQueueStatus(token);
            // 1 write tiap ~10 poll (≈20 detik) -> beban write rendah tapi nyata
            if (self.poll % 10 === 0) {
              const st = doWrite(token, role);
              check(null, { 'write handled (not 5xx)': () => st < 500 });
            }
          }, 2000);
        }
        if (msg.startsWith('2')) {
          socket.send('3');
        }
      });
      socket.on('close', function () {});
      socket.on('error', function () {});
      socket.setTimeout(function () {
        if (!self.authOk) socket.close(1000, 'auth-timeout');
      }, 10000);
    }
  );

  return self;
}

export default function (data) {
  const isDoctor = __VU % 3 === 0;
  const token = isDoctor ? data.doctor : data.admin;
  const role = isDoctor ? 'doctor' : 'admin';

  while (true) {
    const self = holdSocketWithLoad(data, token, role);

    if (!self.authOk) {
      wsDrops.add(1);
      wsReconnects.add(1);
      sleep(1); // backoff singkat sebelum reconnect (hindari reconnect-storm)
      continue;
    }
  }
}