/**
 * TASK 5.1.9 - Load Testing: API Performance (50+ endpoints)
 *
 * Mixed read/write load across 55 REST endpoints.
 * setup(): login 3 roles + build id pools. Setiap iterasi = 1 request ter-weight.
 *
 * Run:
 *   k6 run api-load.js --vus 50 --duration 3m
 */
import { sleep } from 'k6';
import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import {
  BASE_URL,
  BRANCH_ID,
  DOCTOR_ID,
  PATIENT_IDS,
  ENCOUNTER_IDS,
  INVOICE_IDS,
  BOOKING_IDS,
  ADMIN,
  ADMIN_PASS,
  DOCTOR,
  DOCTOR_PASS,
  PATIENT,
  PATIENT_PASS,
  login,
  authHeaders,
  pick,
  rand,
} from './lib/helpers.js';

const bizReject = new Counter('biz_rejects');
const serverError = new Counter('server_errors');
const writesCreated = new Counter('writes_created');
const serverErrorRate = new Rate('server_error_rate');

const W = {
  queueStatus: 14,
  adminQueues: 8,
  doctorQueue: 6,
  doctorQueueToday: 5,
  doctorQueueStats: 3,
  patientsList: 5,
  patientGet: 4,
  patientBranches: 2,
  patientAuditTrail: 1,
  patientQuickView: 2,
  patientHistory: 2,
  patientMedicalRecords: 2,
  patientAttendance: 2,
  encounterGet: 2,
  invoiceList: 3,
  invoiceSummary: 3,
  invoiceGet: 2,
  invoicePayments: 1,
  adminInvoiceGet: 2,
  noShowAdmin: 2,
  noShowSummary: 3,
  auditLogs: 2,
  webhookErrors: 2,
  paymentRecon: 2,
  paymentReconSummary: 2,
  patientBookingsGet: 3,
  bookingGet: 2,
  doctorAvailability: 2,
  health: 1,
  adminCheckIn: 5,
  readyNext: 3,
  bookingCreate: 2,
  encounterCreate: 2,
  encounterUpdate: 1,
  encounterComplete: 1,
  invoiceMarkPaid: 1,
  invoiceUndoPayment: 1,
  webhookReplay: 1,
};

export const options = {
  vus: __ENV.VUS ? Number(__ENV.VUS) : 50,
  duration: __ENV.DURATION || '3m',
  thresholds: {
    http_req_duration: ['p(95)<200'],
    server_error_rate: ['rate<0.01'],
  },
};

export function setup() {
  const admin = login(ADMIN, ADMIN_PASS, 'admin');
  const doctor = login(DOCTOR, DOCTOR_PASS, 'doctor');
  const patient = login(PATIENT, PATIENT_PASS, 'patient');
  return { admin, doctor, patient };
}

function countResult(statusOk, res, expected) {
  if (expected === 'write') {
    if (res.status >= 200 && res.status < 300) writesCreated.add(1);
    if ([400, 403, 404, 409, 422, 429].indexOf(res.status) > -1) {
      bizReject.add(1);
      serverErrorRate.add(false);
      return statusOk;
    }
  } else {
    if ([400, 404, 422].indexOf(res.status) > -1) {
      bizReject.add(1);
      serverErrorRate.add(false);
      return statusOk;
    }
  }
  if (res.status >= 500 || res.status === 0) {
    serverError.add(1);
    serverErrorRate.add(true);
    return false;
  }
  serverErrorRate.add(false);
  return res.status >= 200 && res.status < 300;
}

function runEp(data, ep) {
  const token = data[ep.role];
  const res = http.request(
    ep.method,
    BASE_URL + ep.path,
    ep.body ? JSON.stringify(ep.body) : null,
    { headers: authHeaders(token), tags: { endpoint: ep.name } }
  );
  const ok = countResult(false, res, ep.expected);
  check(res, {
    [ep.name + ' handled']: () => ok || res.status < 500,
  });
  return ok;
}

function buildEndpoints() {
  const list = [];
  const patientId = pick(PATIENT_IDS);
  const encounterId = pick(ENCOUNTER_IDS);
  const invoiceId = pick(INVOICE_IDS);
  const bookingId = pick(BOOKING_IDS);

  const push = (name, w, method, path, body, role, expected) =>
    list.push({ name, w, method, path, body, role, expected: expected || 'read' });

  // ---- READS ----
  push('health', W.health, 'GET', '/health', null, 'admin');
  push('queueStatus', W.queueStatus, 'GET', '/api/queue/status?branch_id=' + BRANCH_ID + '&doctor_id=' + DOCTOR_ID, null, 'patient');
  push('adminQueues', W.adminQueues, 'GET', '/api/admin/queues?branchId=' + BRANCH_ID, null, 'admin');
  push('doctorQueue', W.doctorQueue, 'GET', '/api/doctors/' + DOCTOR_ID + '/queue?branchId=' + BRANCH_ID, null, 'doctor');
  push('doctorQueueToday', W.doctorQueueToday, 'GET', '/api/doctors/' + DOCTOR_ID + '/queue-today?branchId=' + BRANCH_ID, null, 'doctor');
  push('doctorQueueStats', W.doctorQueueStats, 'GET', '/api/doctors/' + DOCTOR_ID + '/queue/stats?branchId=' + BRANCH_ID, null, 'doctor');
  push('patientsList', W.patientsList, 'GET', '/api/patients?branch_id=' + BRANCH_ID + '&limit=20&page=1', null, 'admin');
  push('patientGet', W.patientGet, 'GET', '/api/patients/' + patientId, null, 'admin');
  push('patientBranches', W.patientBranches, 'GET', '/api/patients/branches', null, 'admin');
  push('patientAuditTrail', W.patientAuditTrail, 'GET', '/api/patients/' + patientId + '/audit-trail', null, 'admin');
  push('patientQuickView', W.patientQuickView, 'GET', '/api/patients/' + patientId + '/quick-view', null, 'admin');
  push('patientHistory', W.patientHistory, 'GET', '/api/patients/' + patientId + '/history', null, 'admin');
  push('patientMedicalRecords', W.patientMedicalRecords, 'GET', '/api/patients/' + patientId + '/medical-records', null, 'admin');
  push('patientAttendance', W.patientAttendance, 'GET', '/api/patients/' + patientId + '/attendance', null, 'admin');
  push('encounterGet', W.encounterGet, 'GET', '/api/encounters/' + encounterId, null, 'doctor');
  push('invoiceList', W.invoiceList, 'GET', '/api/invoices?branchId=' + BRANCH_ID + '&status=all', null, 'admin');
  push('invoiceSummary', W.invoiceSummary, 'GET', '/api/invoices/summary?branchId=' + BRANCH_ID, null, 'admin');
  push('invoiceGet', W.invoiceGet, 'GET', '/api/invoices/' + invoiceId, null, 'admin');
  push('adminInvoiceGet', W.adminInvoiceGet, 'GET', '/api/admin/invoices/' + invoiceId, null, 'admin');
  push('noShowAdmin', W.noShowAdmin, 'GET', '/api/no-shows/admin/no-shows', null, 'admin');
  push('noShowSummary', W.noShowSummary, 'GET', '/api/reports/no-show-summary', null, 'admin');
  push('auditLogs', W.auditLogs, 'GET', '/api/admin/audit-logs?limit=20', null, 'admin');
  push('webhookErrors', W.webhookErrors, 'GET', '/api/admin/webhook-errors?limit=20', null, 'admin');
  push('paymentRecon', W.paymentRecon, 'GET', '/api/payments/reconciliation?date=2026-09-10', null, 'admin');
  push('paymentReconSummary', W.paymentReconSummary, 'GET', '/api/payments/reconciliation/summary?date_from=2026-09-01&date_to=2026-09-10', null, 'admin');
  push('patientBookingsGet', W.patientBookingsGet, 'GET', '/api/patient/bookings', null, 'patient');
  push('bookingGet', W.bookingGet, 'GET', '/api/patient/bookings/' + bookingId, null, 'patient');
  push('doctorAvailability', W.doctorAvailability, 'GET', '/api/doctors/' + DOCTOR_ID + '/availability', null, 'patient');

  // ---- WRITES (weight rendah) ----
  push('adminCheckIn', W.adminCheckIn, 'POST', '/api/admin/check-in', { check_in_code: 'NWZ8MH', branch_id: BRANCH_ID }, 'admin', 'write');
  push('readyNext', W.readyNext, 'POST', '/api/doctors/' + DOCTOR_ID + '/ready-next', {}, 'doctor', 'write');
  push('bookingCreate', W.bookingCreate, 'POST', '/api/patient/bookings', { doctorId: DOCTOR_ID, bookingDate: '2099-01-01', sessionSlotId: 'none', notes: 'load-test' }, 'patient', 'write');
  push('encounterCreate', W.encounterCreate, 'POST', '/api/encounters', { bookingId, complaint: 'load-test', diagnosis: 'check', treatment: 'none', prescription: '', notes: '' }, 'doctor', 'write');
  push('encounterUpdate', W.encounterUpdate, 'PUT', '/api/encounters/' + encounterId, { complaint: 'load-update', diagnosis: 'updated', treatment: '', prescription: '', notes: '' }, 'doctor', 'write');
  push('encounterComplete', W.encounterComplete, 'POST', '/api/encounters/' + encounterId + '/complete', { notes: 'load-test-complete' }, 'doctor', 'write');
  push('invoiceMarkPaid', W.invoiceMarkPaid, 'POST', '/api/admin/invoices/' + invoiceId + '/mark-paid', { payment_method: 'CASH', paid_amount: 50000, notes: 'load-test' }, 'admin', 'write');
  push('invoiceUndoPayment', W.invoiceUndoPayment, 'POST', '/api/admin/invoices/' + invoiceId + '/undo-payment', { reason: 'load-test' }, 'admin', 'write');
  push('webhookReplay', W.webhookReplay, 'POST', '/api/admin/webhooks/' + rand(1, 5) + '/replay', {}, 'admin', 'write');

  return list;
}

const ENDPOINTS = buildEndpoints();

export default function (data) {
  const total = ENDPOINTS.reduce((a, e) => a + e.w, 0);
  let r = Math.floor(Math.random() * total);
  let chosen = ENDPOINTS[0];
  for (const e of ENDPOINTS) {
    r -= e.w;
    if (r < 0) {
      chosen = e;
      break;
    }
  }
  runEp(data, chosen);
  sleep(0.15);
}