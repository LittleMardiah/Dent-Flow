import http from 'k6/http';
import crypto from 'k6/crypto';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
export const WS_URL = __ENV.WS_URL || 'ws://localhost:3001';

export const BRANCH_ID = __ENV.BRANCH_ID || '494a607c-d109-4330-a3a9-68f54326f0c7';
export const DOCTOR_ID = __ENV.DOCTOR_ID || 'd93eabaa-d68b-4886-af34-ab7088a08503';

export const ADMIN = __ENV.ADMIN_USER || 'admin_a';
export const ADMIN_PASS = __ENV.ADMIN_PASS || 'Admin123!';
export const DOCTOR = __ENV.DOCTOR_USER || 'dr_bm_a';
export const DOCTOR_PASS = __ENV.DOCTOR_PASS || 'Doctor123!';
export const PATIENT = __ENV.PATIENT_USER || 'patient_001';
export const PATIENT_PASS = __ENV.PATIENT_PASS || 'Patient123!';

export const PATIENT_IDS = [
  '83fd97b4-c702-4345-b3ef-53efb529dc4c',
  'ad584d27-1e98-4159-adcd-7eaef7382e3c',
  'd05a03fd-3cc9-4424-9129-6bb1879eb4cc',
  '84a5073a-0ed0-424d-9359-dcb5e3ba1555',
  'f41beff5-ff8f-4345-a757-774433c1a02c',
  '2a4182a8-1e23-412a-a121-c805b9ae17e1',
];

export const ENCOUNTER_IDS = [
  '50cba7df-fdf7-4e5f-9776-142ef7c58421',
  '99977ffe-f80a-429b-a59c-1980fdb0ed55',
  '15ea4f76-e048-4f21-bbe9-b03b86f1f5aa',
  '69177907-f748-4aae-b152-5f25c7ebd1c6',
  'd11e32da-7324-4cc4-a7a9-7a6abf428858',
];

export const INVOICE_IDS = [
  '030f5de1-4df5-4f32-8e2c-b3a702631f65',
  'e6281766-ccdd-43cd-a969-2f6d9f13606c',
  'e5cd02fe-921b-439c-b489-1e4b452477fb',
  '6f685ba5-f698-41e2-b1d1-3f6bcc08588c',
  'e83f93c1-3b2b-408a-8548-8606ad3546f5',
];

export const BOOKING_IDS = [
  'cdfcd099-9e01-4c4f-9f0e-ed7713c2d3dd',
  'a2b6a0f5-157f-455d-8eab-531c29e9d0dc',
  'f282ac61-60ff-4db2-80f4-ce3bf43d19f0',
  '52a96847-f10e-490e-9c95-e8b52c8a2282',
  '24551e9d-8bb6-4326-8402-8a3d6c902a7c',
  '219624c7-3fe1-44ad-86c0-e4c6870880e4',
];

export function login(username, password, role) {
  const res = http.post(
    BASE_URL + '/auth/' + role + '/login',
    JSON.stringify({ username, password }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  if (res.status !== 200) {
    throw new Error('Login failed for ' + username + ' status=' + res.status + ' body=' + res.body);
  }
  return res.json().data.token;
}

export function authHeaders(token) {
  return { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randId(prefix) {
  const bytes = crypto.randomBytes(16).array;
  return prefix + '-' + bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}