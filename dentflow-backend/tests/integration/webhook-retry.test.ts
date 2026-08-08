// 🔥 SET ENV SEBELUM IMPORT APP
process.env.MIDTRANS_SERVER_KEY = 'test-key';

import { app } from "../../src/index";
import request from 'supertest';
import { pool } from '../../src/config/database';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { webhookRetryJob } from '../../src/jobs/webhookRetry.job';

describe('Webhook Retry Integration (Full)', () => {
  let branchId: string;
  let patientId: string;
  let patientUserId: string;
  let doctorId: string;
  let doctorUserId: string;
  let bookingId: string;
  let encounterId: string;
  let invoiceId: string;
  let invoiceNumber: string;
  let webhookId: string;
  let adminToken: string;
  let adminUsername: string;

  // Helper untuk membuat booking & encounter baru
  async function createBookingEncounter() {
    const client = await pool.connect();
    try {
      const newBookingId = uuidv4();
      await client.query(
        `INSERT INTO bookings (id, branch_id, patient_id, doctor_id, booking_date, booking_time, status, booking_code, dp_amount)
         VALUES ($1, $2, $3, $4, CURRENT_DATE, '09:00:00', 'PAYMENT_CONFIRMED', $5, 50000)`,
        [newBookingId, branchId, patientId, doctorId, `RETRY-${uuidv4().slice(0, 6)}`]
      );
      const encRes = await client.query(
        `INSERT INTO encounters (id, branch_id, booking_id, doctor_id, patient_id, status, started_at, treatment)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'COMPLETED', NOW(), 'Scaling')
         RETURNING id`,
        [branchId, newBookingId, doctorId, patientId]
      );
      return { bookingId: newBookingId, encounterId: encRes.rows[0].id };
    } finally {
      client.release();
    }
  }

  beforeAll(async () => {
    console.log('🔧 [beforeAll] Starting setup...');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Branch
      const branchRes = await client.query(
        `INSERT INTO branches (id, name, phone, address, is_active)
         VALUES (gen_random_uuid(), 'Webhook Retry Test', '021-1234567', 'Jl. Test', true)
         RETURNING id`
      );
      branchId = branchRes.rows[0].id;
      console.log(`✅ Branch created: ${branchId}`);

      // 2. Admin
      adminUsername = `retry_admin_${uuidv4().slice(0, 8)}`;
      await client.query(
        `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
         VALUES (gen_random_uuid(), $1, 'ADMIN_BRANCH', $2, $3, $4, true)`,
        [branchId, `${adminUsername}@clinic.com`, adminUsername, await bcrypt.hash('Admin123!', 10)]
      );

      // 3. Doctor
      doctorUserId = uuidv4();
      await client.query(
        `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
         VALUES ($1, $2, 'DOCTOR', $3, $4, $5, true)`,
        [doctorUserId, branchId, `retry_doctor_${uuidv4().slice(0, 8)}@clinic.com`, `retry_doctor_${uuidv4().slice(0, 8)}`, await bcrypt.hash('Doctor123!', 10)]
      );
      const licenseNumber = `LIC-${uuidv4().slice(0, 8)}`;
      const doctorRes = await client.query(
        `INSERT INTO doctors (id, branch_id, user_id, full_name, specialization, license_number, is_available)
         VALUES (gen_random_uuid(), $1, $2, 'drg. Retry Test', 'Sp.BM', $3, true)
         RETURNING id`,
        [branchId, doctorUserId, licenseNumber]
      );
      doctorId = doctorRes.rows[0].id;
      console.log(`✅ Doctor created: ${doctorId}`);

      // 4. Patient
      patientUserId = uuidv4();
      await client.query(
        `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
         VALUES ($1, $2, 'PATIENT', $3, $4, $5, true)`,
        [patientUserId, branchId, `retry_patient_${uuidv4().slice(0, 8)}@test.com`, `retry_patient_${uuidv4().slice(0, 8)}`, await bcrypt.hash('Patient123!', 10)]
      );
      const patientRes = await client.query(
        `INSERT INTO patients (id, branch_id, user_id, full_name, phone)
         VALUES (gen_random_uuid(), $1, $2, 'Retry Patient', '08123456789')
         RETURNING id`,
        [branchId, patientUserId]
      );
      patientId = patientRes.rows[0].id;
      console.log(`✅ Patient created: ${patientId}`);

      await client.query('COMMIT');
      client.release();

      // 5. Booking & Encounter untuk happy path test
      const { bookingId: bId, encounterId: eId } = await createBookingEncounter();
      bookingId = bId;
      encounterId = eId;
      console.log(`✅ Booking created: ${bookingId}`);
      console.log(`✅ Encounter created: ${encounterId}`);

      // 6. Invoice untuk happy path
      const invoiceClient = await pool.connect();
      try {
        await invoiceClient.query('BEGIN');
        invoiceNumber = `INV-RETRY-${uuidv4().slice(0, 6)}`;
        const invoiceRes = await invoiceClient.query(
          `INSERT INTO invoices (id, branch_id, encounter_id, patient_id, booking_id, invoice_number, amount_due, amount_paid, paid_amount, status)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 50000, 0, NULL, 'UNPAID')
           RETURNING id`,
          [branchId, encounterId, patientId, bookingId, invoiceNumber]
        );
        invoiceId = invoiceRes.rows[0].id;
        console.log(`✅ Invoice created: ${invoiceId} with number ${invoiceNumber}`);
        await invoiceClient.query('COMMIT');
      } finally {
        invoiceClient.release();
      }

      webhookId = `webhook-retry-${uuidv4()}`;
      console.log(`✅ Webhook ID: ${webhookId}`);

      console.log('✅ [beforeAll] Setup complete!');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ [beforeAll] Setup failed:', error);
      throw error;
    }

    // Login admin
    const loginRes = await request(app)
      .post('/auth/admin/login')
      .send({ username: adminUsername, password: 'Admin123!' });
    adminToken = loginRes.body.data.token;
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
      console.error('❌ Cleanup failed:', error);
    } finally {
      client.release();
      await pool.end();
    }
  });

  // ============================================================
  // TEST 1: HAPPY PATH WEBHOOK
  // ============================================================
  it('should process webhook successfully and update invoice', async () => {
    const serverKey = process.env.MIDTRANS_SERVER_KEY || 'test-key';
    const statusCode = '200';
    const grossAmount = '50000';
    const orderId = invoiceNumber;
    const payload = {
      status_code: statusCode,
      order_id: orderId,
      transaction_status: 'capture',
      gross_amount: grossAmount,
      transaction_id: `txn-${uuidv4().slice(0, 8)}`
    };
    const raw = orderId + statusCode + grossAmount + serverKey;
    const signature = crypto.createHmac('sha256', serverKey).update(raw).digest('hex');

    const res = await request(app)
      .post('/webhooks/midtrans')
      .set('x-midtrans-signature', signature)
      .set('x-midtrans-webhook-id', webhookId)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const invoiceCheck = await pool.query(
      'SELECT status, paid_amount FROM invoices WHERE id = $1',
      [invoiceId]
    );
    expect(invoiceCheck.rows[0].status).toBe('PAID');
    expect(Number(invoiceCheck.rows[0].paid_amount)).toBe(50000);
  });

  // ============================================================
  // TEST 2: RETRY AUTOMATIS (Invoice not found)
  // ============================================================
  it('should retry failed webhook automatically (Invoice not found)', async () => {
    const serverKey = process.env.MIDTRANS_SERVER_KEY || 'test-key';
    const failOrderId = `INV-NOTEXIST-${Date.now()}-${uuidv4().slice(0, 6)}`;
    const payload = {
      status_code: '200',
      order_id: failOrderId,
      transaction_status: 'capture',
      gross_amount: '50000',
      transaction_id: `txn-${uuidv4().slice(0, 8)}`
    };
    const raw = failOrderId + '200' + '50000' + serverKey;
    const signature = crypto.createHmac('sha256', serverKey).update(raw).digest('hex');
    const webhookIdFail = `webhook-fail-${uuidv4()}`;

    // 1. Kirim webhook pertama (invoice belum ada)
    const res = await request(app)
      .post('/webhooks/midtrans')
      .set('x-midtrans-signature', signature)
      .set('x-midtrans-webhook-id', webhookIdFail)
      .send(payload);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);

    // 2. Verifikasi error record
    const errorCheck = await pool.query(
      'SELECT * FROM payment_webhook_errors WHERE webhook_id = $1',
      [webhookIdFail]
    );
    expect(errorCheck.rows.length).toBe(1);
    expect(errorCheck.rows[0].retry_count).toBe(0);
    expect(errorCheck.rows[0].last_error).toContain('Invoice not found');

    // 3. Buat booking & encounter baru untuk invoice retry
    const { bookingId: retryBookingId, encounterId: retryEncounterId } = await createBookingEncounter();

    // 4. Buat invoice dengan nomor yang sama
    await pool.query(
      `INSERT INTO invoices (id, branch_id, encounter_id, patient_id, booking_id, invoice_number, amount_due, amount_paid, paid_amount, status)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 50000, 0, NULL, 'UNPAID')`,
      [branchId, retryEncounterId, patientId, retryBookingId, failOrderId]
    );

    // 5. Update next_retry_at ke NOW() agar job langsung memproses
    await pool.query(
      `UPDATE payment_webhook_errors SET next_retry_at = NOW() WHERE webhook_id = $1`,
      [webhookIdFail]
    );

    // 6. Jalankan retry job
    await webhookRetryJob.execute();

    // 7. Verifikasi error record terhapus
    const afterRetry = await pool.query(
      'SELECT * FROM payment_webhook_errors WHERE webhook_id = $1',
      [webhookIdFail]
    );
    expect(afterRetry.rows.length).toBe(0);

    // 8. Verifikasi invoice PAID
    const invoiceCheck = await pool.query(
      'SELECT status, paid_amount FROM invoices WHERE invoice_number = $1',
      [failOrderId]
    );
    expect(invoiceCheck.rows[0].status).toBe('PAID');
    expect(Number(invoiceCheck.rows[0].paid_amount)).toBe(50000);
  });

  // ============================================================
  // TEST 3: ADMIN REPLAY HAPPY PATH
  // ============================================================
  it('should replay webhook manually via admin endpoint', async () => {
    const serverKey = process.env.MIDTRANS_SERVER_KEY || 'test-key';
    const failOrderId = `INV-FAIL-REPLAY-${Date.now()}-${uuidv4().slice(0, 6)}`;
    const payload = {
      status_code: '200',
      order_id: failOrderId,
      transaction_status: 'capture',
      gross_amount: '50000',
      transaction_id: `txn-${uuidv4().slice(0, 8)}`
    };
    const raw = failOrderId + '200' + '50000' + serverKey;
    const signature = crypto.createHmac('sha256', serverKey).update(raw).digest('hex');
    const webhookIdReplay = `webhook-replay-${uuidv4()}`;

    // 1. Kirim webhook pertama (invoice belum ada)
    await request(app)
      .post('/webhooks/midtrans')
      .set('x-midtrans-signature', signature)
      .set('x-midtrans-webhook-id', webhookIdReplay)
      .send(payload);

    // 2. Buat booking & encounter baru untuk invoice replay
    const { bookingId: replayBookingId, encounterId: replayEncounterId } = await createBookingEncounter();

    // 3. Buat invoice dengan nomor yang sama
    await pool.query(
      `INSERT INTO invoices (id, branch_id, encounter_id, patient_id, booking_id, invoice_number, amount_due, amount_paid, paid_amount, status)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 50000, 0, NULL, 'UNPAID')`,
      [branchId, replayEncounterId, patientId, replayBookingId, failOrderId]
    );

    // 4. Update next_retry_at ke NOW() agar tidak ada konflik timing
    await pool.query(
      `UPDATE payment_webhook_errors SET next_retry_at = NOW() WHERE webhook_id = $1`,
      [webhookIdReplay]
    );

    // 5. Verifikasi error record sebelum replay
    const beforeReplay = await pool.query(
      'SELECT * FROM payment_webhook_errors WHERE webhook_id = $1',
      [webhookIdReplay]
    );
    console.log('🔍 [TEST] Error record before replay:', beforeReplay.rows[0]);

    // 6. Admin replay
    const replayRes = await request(app)
      .post(`/api/admin/webhooks/${webhookIdReplay}/replay`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();
    expect(replayRes.status).toBe(200);
    expect(replayRes.body.success).toBe(true);

    // 7. Verifikasi error record terhapus
    const afterReplay = await pool.query(
      'SELECT * FROM payment_webhook_errors WHERE webhook_id = $1',
      [webhookIdReplay]
    );
    expect(afterReplay.rows.length).toBe(0);

    // 8. Verifikasi invoice PAID
    const invoiceCheck = await pool.query(
      'SELECT status, paid_amount FROM invoices WHERE invoice_number = $1',
      [failOrderId]
    );
    expect(invoiceCheck.rows[0].status).toBe('PAID');
    expect(Number(invoiceCheck.rows[0].paid_amount)).toBe(50000);
  });

  // ============================================================
  // TEST 4: ADMIN REPLAY IDEMPOTENCY (ALREADY PROCESSED)
  // ============================================================
  it('should return 409 when replaying already processed webhook', async () => {
    const serverKey = process.env.MIDTRANS_SERVER_KEY || 'test-key';
    const failOrderId = `INV-IDEMPOTENT-${Date.now()}-${uuidv4().slice(0, 6)}`;
    const payload = {
      status_code: '200',
      order_id: failOrderId,
      transaction_status: 'capture',
      gross_amount: '50000',
      transaction_id: `txn-${uuidv4().slice(0, 8)}`
    };
    const raw = failOrderId + '200' + '50000' + serverKey;
    const signature = crypto.createHmac('sha256', serverKey).update(raw).digest('hex');
    const webhookIdIdempotent = `webhook-idempotent-${uuidv4()}`;

    // 1. Kirim webhook gagal (invoice belum ada) → buat error record
    await request(app)
      .post('/webhooks/midtrans')
      .set('x-midtrans-signature', signature)
      .set('x-midtrans-webhook-id', webhookIdIdempotent)
      .send(payload);

    // 2. Update status error record menjadi PROCESSED (simulasi sudah diproses)
    await pool.query(
      `UPDATE payment_webhook_errors 
       SET retry_count = 3, next_retry_at = NULL 
       WHERE webhook_id = $1`,
      [webhookIdIdempotent]
    );
    await pool.query(
      `UPDATE payment_webhooks 
       SET status = 'PROCESSED' 
       WHERE webhook_id = $1`,
      [webhookIdIdempotent]
    );

    // 3. Coba replay → harus return 409
    const replayRes = await request(app)
      .post(`/api/admin/webhooks/${webhookIdIdempotent}/replay`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();

    expect(replayRes.status).toBe(409);
    expect(replayRes.body.error).toBe('ALREADY_PROCESSED');
    expect(replayRes.body.message).toContain('already processed');

    // 4. Cleanup
    await pool.query('DELETE FROM payment_webhook_errors WHERE webhook_id = $1', [webhookIdIdempotent]);
    await pool.query('DELETE FROM payment_webhooks WHERE webhook_id = $1', [webhookIdIdempotent]);
  });
});
