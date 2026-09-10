/**
 * EXTREME HTTP CRUSH (breaking point hunter)
 * Pure HTTP — no WS. Heavy read/report mix + high write ratio to saturate
 * Postgres pool & Node event loop. Cari titik degradasi nyata.
 *
 * Run:
 *   k6 run extreme-http-test.js --vus 1200 --duration 2m
 */
import { sleep } from 'k6';
import http from 'k6/http';
import { Rate } from 'k6/metrics';
import {
  BASE_URL,
  BRANCH_ID,
  DOCTOR_ID,
  ADMIN,
  ADMIN_PASS,
  DOCTOR,
  DOCTOR_PASS,
  PATIENT,
  PATIENT_PASS,
  login,
  authHeaders,
} from './lib/helpers.js';

const serverErrorRate = new Rate('server_error_rate');

export const options = {
  vus: __ENV.VUS ? Number(__ENV.VUS) : 1200,
  duration: __ENV.DURATION || '2m',
  thresholds: {
    server_error_rate: ['rate<0.15'],
  },
};

export function setup() {
  return {
    admin: login(ADMIN, ADMIN_PASS, 'admin'),
    doctor: login(DOCTOR, DOCTOR_PASS, 'doctor'),
    patient: login(PATIENT, PATIENT_PASS, 'patient'),
  };
}

const eps = [
  { name: 'tv_status', w: 18, m: 'GET', p: '/api/queue/status?branch_id=' + BRANCH_ID + '&doctor_id=' + DOCTOR_ID, r: 'patient', b: null },
  { name: 'no_show_summary', w: 10, m: 'GET', p: '/api/reports/no-show-summary?branchId=' + BRANCH_ID + '&limit=50', r: 'admin', b: null },
  { name: 'invoice_summary', w: 10, m: 'GET', p: '/api/invoices/summary?branchId=' + BRANCH_ID, r: 'admin', b: null },
  { name: 'payment_recon', w: 8, m: 'GET', p: '/api/payments/reconciliation?date=2026-09-10', r: 'admin', b: null },
  { name: 'admin_queues', w: 8, m: 'GET', p: '/api/admin/queues?branchId=' + BRANCH_ID, r: 'admin', b: null },
  { name: 'audit_logs', w: 7, m: 'GET', p: '/api/admin/audit-logs?limit=50', r: 'admin', b: null },
  { name: 'invoices_list', w: 7, m: 'GET', p: '/api/invoices?branchId=' + BRANCH_ID + '&status=all', r: 'admin', b: null },
  { name: 'patients_list', w: 7, m: 'GET', p: '/api/patients?branch_id=' + BRANCH_ID + '&limit=50&page=1', r: 'admin', b: null },
  { name: 'checkin', w: 12, m: 'POST', p: '/api/admin/check-in', r: 'admin', b: { check_in_code: 'NWZ8MH', branch_id: BRANCH_ID } },
  { name: 'ready_next', w: 8, m: 'POST', p: '/api/doctors/' + DOCTOR_ID + '/ready-next', r: 'doctor', b: {} },
  { name: 'invoice_mark_paid', w: 5, m: 'POST', p: '/api/admin/invoices/030f5de1-4df5-4f32-8e2c-b3a702631f65/mark-paid', r: 'admin', b: { payment_method: 'CASH', paid_amount: 50000, notes: 'crush' } },
];

export default function (data) {
  const total = eps.reduce((a, e) => a + e.w, 0);
  let r = Math.floor(Math.random() * total);
  let ep = eps[0];
  for (const e of eps) {
    r -= e.w;
    if (r < 0) {
      ep = e;
      break;
    }
  }
  const res = http.request(ep.m, BASE_URL + ep.p, ep.b ? JSON.stringify(ep.b) : null, {
    headers: authHeaders(data[ep.r]),
    tags: { name: ep.name },
  });
  const serverErr = res.status >= 500 || res.status === 0;
  serverErrorRate.add(serverErr);
}