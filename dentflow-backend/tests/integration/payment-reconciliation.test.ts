// 🔥 SET ENV SEBELUM IMPORT APP
process.env.MIDTRANS_SERVER_KEY = 'test-key';

import { app } from "../../src/index";
import request from 'supertest';
import { pool } from '../../src/config/database';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getOrCreateTestBranch, getOrCreateTestDoctor, getOrCreateTestPatient } from '../helpers/testHelpers';

describe('Payment Reconciliation Endpoint (TD-PAY-014)', () => {
  let adminToken: string;
  let adminUsername: string;
  let branchId: string;
  let patientId: string;
  let patientUsername: string; // 👈 TAMBAHAN
  let doctorId: string;
  let bookingId1: string;
  let encounterId1: string;
  let invoiceId1: string;
  let invoiceNumber1: string;
  let bookingId2: string;
  let encounterId2: string;
  let invoiceId2: string;
  let invoiceNumber2: string;

  beforeAll(async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Branch
      branchId = await getOrCreateTestBranch('Reconciliation Test Branch');

      // 2. Admin
      adminUsername = `reconcile_admin_${uuidv4().slice(0, 8)}`;
      const adminPasswordHash = await bcrypt.hash('Admin123!', 10);
      await client.query(
        `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
         VALUES (gen_random_uuid(), $1, 'ADMIN_BRANCH', $2, $3, $4, true)`,
        [branchId, `${adminUsername}@clinic.com`, adminUsername, adminPasswordHash]
      );

      // 3. Doctor & Patient
      const doctorUserId = uuidv4();
      doctorId = await getOrCreateTestDoctor(branchId, doctorUserId);
      patientId = await getOrCreateTestPatient(branchId);

      // 👇 Ambil username patient yang baru dibuat
      const userRes = await client.query(
        `SELECT username FROM users WHERE id = (SELECT user_id FROM patients WHERE id = $1)`,
        [patientId]
      );
      patientUsername = userRes.rows[0].username;

      // 4. BOOKING & ENCOUNTER 1 (paid)
      bookingId1 = uuidv4();
      await client.query(
        `INSERT INTO bookings (id, branch_id, patient_id, doctor_id, booking_date, booking_time, status, booking_code, dp_amount)
         VALUES ($1, $2, $3, $4, CURRENT_DATE, '09:00:00', 'PAYMENT_CONFIRMED', $5, 50000)`,
        [bookingId1, branchId, patientId, doctorId, `RECONCILE-${uuidv4().slice(0, 6)}`]
      );
      const encRes1 = await client.query(
        `INSERT INTO encounters (id, branch_id, booking_id, doctor_id, patient_id, status, started_at, treatment)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'COMPLETED', NOW(), 'Scaling')
         RETURNING id`,
        [branchId, bookingId1, doctorId, patientId]
      );
      encounterId1 = encRes1.rows[0].id;

      invoiceNumber1 = `INV-RECONCILE-PAID-${uuidv4().slice(0, 6)}`;
      const invRes1 = await client.query(
        `INSERT INTO invoices (id, branch_id, encounter_id, patient_id, booking_id, invoice_number, amount_due, amount_paid, paid_amount, payment_status, status)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 50000, 0, NULL, 'UNPAID', 'UNPAID')
         RETURNING id`,
        [branchId, encounterId1, patientId, bookingId1, invoiceNumber1]
      );
      invoiceId1 = invRes1.rows[0].id;

      // 5. BOOKING & ENCOUNTER 2 (unpaid)
      bookingId2 = uuidv4();
      await client.query(
        `INSERT INTO bookings (id, branch_id, patient_id, doctor_id, booking_date, booking_time, status, booking_code, dp_amount)
         VALUES ($1, $2, $3, $4, CURRENT_DATE, '09:00:00', 'PAYMENT_CONFIRMED', $5, 50000)`,
        [bookingId2, branchId, patientId, doctorId, `RECONCILE-${uuidv4().slice(0, 6)}`]
      );
      const encRes2 = await client.query(
        `INSERT INTO encounters (id, branch_id, booking_id, doctor_id, patient_id, status, started_at, treatment)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'COMPLETED', NOW(), 'Scaling')
         RETURNING id`,
        [branchId, bookingId2, doctorId, patientId]
      );
      encounterId2 = encRes2.rows[0].id;

      invoiceNumber2 = `INV-RECONCILE-UNPAID-${uuidv4().slice(0, 6)}`;
      const invRes2 = await client.query(
        `INSERT INTO invoices (id, branch_id, encounter_id, patient_id, booking_id, invoice_number, amount_due, amount_paid, paid_amount, payment_status, status)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 50000, 0, NULL, 'UNPAID', 'UNPAID')
         RETURNING id`,
        [branchId, encounterId2, patientId, bookingId2, invoiceNumber2]
      );
      invoiceId2 = invRes2.rows[0].id;

      await client.query('COMMIT');
      console.log('✅ Setup data committed.');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Setup failed:', error);
      throw error;
    } finally {
      client.release();
    }

    // Login admin
    const loginRes = await request(app)
      .post('/auth/admin/login')
      .send({ username: adminUsername, password: 'Admin123!' });
    if (loginRes.status !== 200) {
      console.error('Admin login failed:', loginRes.body);
      throw new Error('Admin login failed');
    }
    adminToken = loginRes.body.data.token;
    console.log('✅ Admin logged in.');

    // Send webhook to pay invoice 1
    const serverKey = process.env.MIDTRANS_SERVER_KEY || 'test-key';
    const statusCode = '200';
    const grossAmount = '50000';
    const orderId = invoiceNumber1;
    const webhookIdTemp = `webhook-reconcile-${uuidv4()}`;
    const payload = {
      status_code: statusCode,
      order_id: orderId,
      transaction_status: 'capture',
      gross_amount: grossAmount,
      transaction_id: `txn-${uuidv4().slice(0, 8)}`
    };
    const raw = orderId + statusCode + grossAmount + serverKey;
    const signature = crypto.createHmac('sha256', serverKey).update(raw).digest('hex');

    const webhookRes = await request(app)
      .post('/webhooks/midtrans')
      .set('x-midtrans-signature', signature)
      .set('x-midtrans-webhook-id', webhookIdTemp)
      .send(payload);

    if (webhookRes.status !== 200) {
      console.error('Webhook failed:', webhookRes.body);
      throw new Error('Webhook failed');
    }
    console.log('✅ Webhook sent.');
        // CEK STATE INVOICE 1
    const cekInv = await client.query(
      `SELECT id, invoice_number, payment_status, paid_amount, amount_paid, status FROM invoices WHERE id = $1`,
      [invoiceId1]
    );
    console.log('🔍 INVOICE 1 AFTER WEBHOOK:', JSON.stringify(cekInv.rows[0], null, 2));
  });

  afterAll(async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM payment_webhooks WHERE branch_id = $1', [branchId]);
      await client.query('DELETE FROM invoices WHERE branch_id = $1', [branchId]);
      await client.query('DELETE FROM encounters WHERE branch_id = $1', [branchId]);
      await client.query('DELETE FROM bookings WHERE branch_id = $1', [branchId]);
      await client.query('DELETE FROM patients WHERE branch_id = $1', [branchId]);
      await client.query('DELETE FROM doctors WHERE branch_id = $1', [branchId]);
      await client.query('DELETE FROM users WHERE branch_id = $1', [branchId]);
      await client.query('DELETE FROM audit_logs WHERE branch_id = $1', [branchId]);
      await client.query('DELETE FROM branches WHERE id = $1', [branchId]);
      await client.query('COMMIT');
      console.log('✅ Cleanup complete.');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Cleanup failed:', error);
    } finally {
      client.release();
      await pool.end();
    }
  });

  it('should return reconciliation data for a specific date', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await request(app)
      .get(`/api/payments/reconciliation?date=${today}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    const paidInvoice = res.body.data.find((row: any) => row.invoice_status === 'PAID');
    expect(paidInvoice).toBeDefined();
    expect(paidInvoice.webhook_status).toBe('PROCESSED');
  });

  it('should return reconciliation summary for a date range', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await request(app)
      .get(`/api/payments/reconciliation/summary?date_from=${today}&date_to=${today}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('total_invoices');
    expect(res.body.data).toHaveProperty('total_amount');
    expect(res.body.data).toHaveProperty('total_paid');
    expect(res.body.data).toHaveProperty('unpaid_count');
    expect(Number(res.body.data.total_invoices)).toBeGreaterThanOrEqual(2);
    expect(Number(res.body.data.total_paid)).toBe(50000);
    expect(Number(res.body.data.unpaid_count)).toBeGreaterThanOrEqual(1);
  });

  it('should return 401 for unauthenticated request', async () => {
    const res = await request(app)
      .get(`/api/payments/reconciliation?date=${new Date().toISOString().split('T')[0]}`);
    expect(res.status).toBe(401);
  });

  it('should return 403 for non-admin user', async () => {
    const patientLogin = await request(app)
      .post('/auth/patient/login')
      .send({ username: patientUsername, password: 'Patient123!' });
    expect(patientLogin.status).toBe(200);
    const patientToken = patientLogin.body.data.token;

    const res = await request(app)
      .get(`/api/payments/reconciliation?date=${new Date().toISOString().split('T')[0]}`)
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(403);
  });
});