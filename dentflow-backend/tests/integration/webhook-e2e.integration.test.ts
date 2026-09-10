// 🔥 SET ENV SEBELUM IMPORT APP
process.env.MIDTRANS_SERVER_KEY = 'test-key';

import { app } from "../../src/index";
import request from 'supertest';
import { pool } from '../../src/config/database';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { webhookRetryJob } from '../../src/jobs/webhookRetry.job';

describe('Payment Webhook E2E (Task 5.1.5)', () => {
  const serverKey = process.env.MIDTRANS_SERVER_KEY || 'test-key';
  let branchId: string;
  let patientId: string;
  let patientUserId: string;
  let doctorId: string;
  let doctorUserId: string;
  let adminToken: string;
  let adminUsername: string;

  // ============================================================
  // HELPERS
  // ============================================================

  function sign(orderId: string, statusCode: string, grossAmount: string): string {
    const raw = orderId + statusCode + grossAmount + serverKey;
    return crypto.createHmac('sha256', serverKey).update(raw).digest('hex');
  }

  const createTestData = async (suffix: string, grossAmount = '50000') => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const bookingId = uuidv4();
      await client.query(
        `INSERT INTO bookings (id, branch_id, patient_id, doctor_id, booking_date, booking_time, status, booking_code, dp_amount)
         VALUES ($1, $2, $3, $4, CURRENT_DATE, '09:00:00', 'PAYMENT_CONFIRMED', $5, 50000)`,
        [bookingId, branchId, patientId, doctorId, `E2E-WH-${uuidv4().slice(0, 6)}`]
      );

      const encRes = await client.query(
        `INSERT INTO encounters (id, branch_id, booking_id, doctor_id, patient_id, status, started_at, treatment)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'COMPLETED', NOW(), 'Scaling')
         RETURNING id`,
        [branchId, bookingId, doctorId, patientId]
      );
      const encounterId = encRes.rows[0].id;

      const invoiceNumber = `INV-E2E-WH-${suffix}-${uuidv4().slice(0, 6)}`;
      const invoiceRes = await client.query(
        `INSERT INTO invoices (id, branch_id, encounter_id, patient_id, booking_id, invoice_number, amount_due, amount_paid, paid_amount, payment_status, status)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, 0, NULL, 'UNPAID', 'UNPAID')
         RETURNING id`,
        [branchId, encounterId, patientId, bookingId, invoiceNumber, Number(grossAmount)]
      );
      const invoiceId = invoiceRes.rows[0].id;
      const webhookId = `webhook-e2e-${suffix.toLowerCase()}-${uuidv4()}`;

      await client.query('COMMIT');
      return { bookingId, encounterId, invoiceId, invoiceNumber, webhookId };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ [createTestData] failed:', error);
      throw error;
    } finally {
      client.release();
    }
  };

  const cleanupTestData = async (invoiceId: string, encounterId: string, bookingId: string) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM invoices WHERE id = $1', [invoiceId]);
      await client.query('DELETE FROM encounters WHERE id = $1', [encounterId]);
      await client.query('DELETE FROM bookings WHERE id = $1', [bookingId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ [cleanupTestData] failed:', error);
    } finally {
      client.release();
    }
  };

  const sendWebhook = (
    orderId: string,
    webhookId: string,
    opts: { statusCode?: string; grossAmount?: string; transactionStatus?: string; signature?: string } = {}
  ) => {
    const statusCode = opts.statusCode ?? '200';
    const grossAmount = opts.grossAmount ?? '50000';
    const payload = {
      status_code: statusCode,
      order_id: orderId,
      transaction_status: opts.transactionStatus ?? 'capture',
      gross_amount: grossAmount,
      transaction_id: `txn-${uuidv4().slice(0, 8)}`,
    };
    const signature = opts.signature ?? sign(orderId, statusCode, grossAmount);

    return request(app)
      .post('/webhooks/midtrans')
      .set('x-midtrans-signature', signature)
      .set('x-midtrans-webhook-id', webhookId)
      .send(payload);
  };

  // ============================================================
  // SETUP / TEARDOWN
  // ============================================================

  beforeAll(async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Branch
      const branchRes = await client.query(
        `INSERT INTO branches (id, name, phone, address, is_active)
         VALUES (gen_random_uuid(), 'Webhook E2E Test', '021-1234567', 'Jl. Test', true)
         RETURNING id`
      );
      branchId = branchRes.rows[0].id;

      // 2. Admin (untuk replay)
      adminUsername = `e2e_admin_${uuidv4().slice(0, 8)}`;
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
        [doctorUserId, branchId, `e2e_doctor_${uuidv4().slice(0, 8)}@clinic.com`, `e2e_doctor_${uuidv4().slice(0, 8)}`, await bcrypt.hash('Doctor123!', 10)]
      );
      const doctorRes = await client.query(
        `INSERT INTO doctors (id, branch_id, user_id, full_name, specialization, license_number, is_available)
         VALUES (gen_random_uuid(), $1, $2, 'drg. E2E Test', 'Sp.BM', $3, true)
         RETURNING id`,
        [branchId, doctorUserId, `LIC-E2E-${uuidv4().slice(0, 8)}`]
      );
      doctorId = doctorRes.rows[0].id;

      // 4. Patient
      patientUserId = uuidv4();
      await client.query(
        `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
         VALUES ($1, $2, 'PATIENT', $3, $4, $5, true)`,
        [patientUserId, branchId, `e2e_patient_${uuidv4().slice(0, 8)}@test.com`, `e2e_patient_${uuidv4().slice(0, 8)}`, await bcrypt.hash('Patient123!', 10)]
      );
      const patientRes = await client.query(
        `INSERT INTO patients (id, branch_id, user_id, full_name, phone)
         VALUES (gen_random_uuid(), $1, $2, 'E2E Patient', '08123456789')
         RETURNING id`,
        [branchId, patientUserId]
      );
      patientId = patientRes.rows[0].id;

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ [beforeAll] setup failed:', error);
      throw error;
    } finally {
      client.release();
    }

    const loginRes = await request(app)
      .post('/auth/admin/login')
      .send({ username: adminUsername, password: 'Admin123!' });
    adminToken = loginRes.body.data.token;
  });

  afterAll(async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM payment_webhook_errors WHERE webhook_id IN (SELECT webhook_id FROM payment_webhooks WHERE branch_id = $1)', [branchId]);
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
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ [afterAll] cleanup failed:', error);
    } finally {
      client.release();
      await pool.end();
    }
  });

  // ============================================================
  // TEST 1: VALID WEBHOOK → INVOICE PAID (200)
  // ============================================================
  it('T1: valid webhook → invoice PAID (200)', async () => {
    const { invoiceId, invoiceNumber, webhookId, encounterId, bookingId } = await createTestData('VALID');

    const res = await sendWebhook(invoiceNumber, webhookId);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('processed');

    const invoiceCheck = await pool.query(
      'SELECT status, payment_status, paid_at, paid_amount FROM invoices WHERE id = $1',
      [invoiceId]
    );
    expect(invoiceCheck.rows[0].status).toBe('PAID');
    expect(invoiceCheck.rows[0].payment_status).toBe('PAID');
    expect(invoiceCheck.rows[0].paid_at).not.toBeNull();
    expect(Number(invoiceCheck.rows[0].paid_amount)).toBe(50000);

    const webhookCheck = await pool.query(
      'SELECT status FROM payment_webhooks WHERE webhook_id = $1',
      [webhookId]
    );
    expect(webhookCheck.rows[0].status).toBe('PROCESSED');

    await cleanupTestData(invoiceId, encounterId, bookingId);
  });

  // ============================================================
  // TEST 2: INVALID SIGNATURE → 403 FORBIDDEN
  // ============================================================
  it('T2: invalid signature → 403 Forbidden', async () => {
    const { invoiceId, invoiceNumber, webhookId, encounterId, bookingId } = await createTestData('INVALID');

    const res = await sendWebhook(invoiceNumber, webhookId, { signature: 'invalid-signature' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Invalid signature');

    // Invoice tetap UNPAID, webhook tidak pernah tercatat / diproses
    const webhookCheck = await pool.query(
      'SELECT * FROM payment_webhooks WHERE webhook_id = $1',
      [webhookId]
    );
    expect(webhookCheck.rows.length).toBe(0);

    const invoiceCheck = await pool.query(
      'SELECT status FROM invoices WHERE id = $1',
      [invoiceId]
    );
    expect(invoiceCheck.rows[0].status).toBe('UNPAID');

    await cleanupTestData(invoiceId, encounterId, bookingId);
  });

  // ============================================================
  // TEST 3: DUPLICATE WEBHOOK → IDEMPOTENT (200, NO DOUBLE-CHARGE)
  // ============================================================
  it('T3: duplicate webhook → idempotent (200, no double-charge)', async () => {
    const { invoiceId, invoiceNumber, webhookId, encounterId, bookingId } = await createTestData('DUP');

    const res1 = await sendWebhook(invoiceNumber, webhookId);
    expect(res1.status).toBe(200);
    expect(res1.body.success).toBe(true);
    expect(res1.body.message).toContain('processed');

    const res2 = await sendWebhook(invoiceNumber, webhookId);
    expect(res2.status).toBe(200);
    expect(res2.body.success).toBe(true);
    expect(res2.body.message).toContain('idempotent');

    // No double-charge: paid_amount tetap 1x, bukan 2x
    const invoiceCheck = await pool.query(
      'SELECT status, paid_amount FROM invoices WHERE id = $1',
      [invoiceId]
    );
    expect(invoiceCheck.rows[0].status).toBe('PAID');
    expect(Number(invoiceCheck.rows[0].paid_amount)).toBe(50000);

    // Hanya satu record webhook di DB (UNIQUE webhook_id)
    const webhookCheck = await pool.query(
      'SELECT COUNT(*)::int AS c FROM payment_webhooks WHERE webhook_id = $1',
      [webhookId]
    );
    expect(webhookCheck.rows[0].c).toBe(1);

    await cleanupTestData(invoiceId, encounterId, bookingId);
  });

  // ============================================================
  // TEST 4: WEBHOOK RETRY → 3 ATTEMPTS WITH BACKOFF
  // ============================================================
  it('T4: webhook retry → max 3 attempts with backoff, then permanent failure', async () => {
    const failOrderId = `INV-E2E-WH-NOTEXIST-${Date.now()}-${uuidv4().slice(0, 6)}`;
    const webhookIdRetry = `webhook-e2e-retry-${uuidv4()}`;

    // 1. Webhook awal gagal (invoice belum ada) → error record dibuat
    const res = await sendWebhook(failOrderId, webhookIdRetry, {
      transactionStatus: 'capture',
      grossAmount: '50000',
    });
    expect(res.status).toBe(403);
    expect(res.body.message).toContain('retry');

    const errCheck = await pool.query(
      'SELECT retry_count, next_retry_at FROM payment_webhook_errors WHERE webhook_id = $1',
      [webhookIdRetry]
    );
    expect(errCheck.rows.length).toBe(1);
    expect(errCheck.rows[0].retry_count).toBe(0);

    const resetRetryTimer = async () => {
      // Pakai timestamp sangat lampau agar record test ini SELALU paling depan
      // di ORDER BY next_retry_at ASC getPendingRetries() — tidak terkalahkan
      // oleh error record sisa test lain (orphan branch_id NULL) yang menumpuk
      // di DB dan diproses retry job global lebih dulu.
      await pool.query(
        'UPDATE payment_webhook_errors SET next_retry_at = TIMESTAMP \'2000-01-01 00:00:00\' WHERE webhook_id = $1',
        [webhookIdRetry]
      );
    };

    // 2. Attempt #1 → retry_count = 1, backoff 30s berikutnya
    await resetRetryTimer();
    await webhookRetryJob.execute();
    let rec = (await pool.query(
      'SELECT e.retry_count, e.next_retry_at, w.status FROM payment_webhook_errors e JOIN payment_webhooks w ON w.webhook_id = e.webhook_id WHERE e.webhook_id = $1',
      [webhookIdRetry]
    )).rows[0];
    expect(rec.retry_count).toBe(1);
    expect(rec.status).not.toBe('PERMANENTLY_FAILED');
    expect(new Date(rec.next_retry_at).getTime()).toBeGreaterThan(Date.now() + 20 * 1000);

    // 3. Attempt #2 → retry_count = 2, backoff 120s berikutnya
    await resetRetryTimer();
    await webhookRetryJob.execute();
    rec = (await pool.query(
      'SELECT e.retry_count, e.next_retry_at, w.status FROM payment_webhook_errors e JOIN payment_webhooks w ON w.webhook_id = e.webhook_id WHERE e.webhook_id = $1',
      [webhookIdRetry]
    )).rows[0];
    expect(rec.retry_count).toBe(2);
    expect(rec.status).not.toBe('PERMANENTLY_FAILED');
    expect(new Date(rec.next_retry_at).getTime()).toBeGreaterThan(Date.now() + 100 * 1000);

    // 4. Attempt #3 → retry_count = 3 → PERMANENTLY_FAILED, tidak ada jadwal ulang
    await resetRetryTimer();
    await webhookRetryJob.execute();
    rec = (await pool.query(
      'SELECT e.retry_count, e.next_retry_at, w.status FROM payment_webhook_errors e JOIN payment_webhooks w ON w.webhook_id = e.webhook_id WHERE e.webhook_id = $1',
      [webhookIdRetry]
    )).rows[0];
    expect(rec.retry_count).toBe(3);
    expect(rec.status).toBe('PERMANENTLY_FAILED');
    expect(rec.next_retry_at).toBeNull();

    // 5. Job berikutnya tidak memproses ulang (retry_count >= 3)
    const pending = await pool.query(
      'SELECT COUNT(*)::int AS c FROM payment_webhook_errors WHERE webhook_id = $1 AND retry_count < 3 AND next_retry_at <= NOW()',
      [webhookIdRetry]
    );
    expect(pending.rows[0].c).toBe(0);

    await pool.query('DELETE FROM payment_webhook_errors WHERE webhook_id = $1', [webhookIdRetry]);
    await pool.query('DELETE FROM payment_webhooks WHERE webhook_id = $1', [webhookIdRetry]);
  });

  // ============================================================
  // TEST 5: INVOICE STATE → UNPAID → PAID (NO REVERSAL)
  // ============================================================
  it('T5: invoice state UNPAID → PAID, tidak balik (no reversal)', async () => {
    const { invoiceId, invoiceNumber, encounterId, bookingId } = await createTestData('STATE');

    // 1. Webhook capture → PAID
    const res1 = await sendWebhook(invoiceNumber, `webhook-e2e-state-pay-${uuidv4()}`);
    expect(res1.status).toBe(200);

    let invoiceCheck = await pool.query(
      'SELECT status, payment_status, paid_at, paid_amount FROM invoices WHERE id = $1',
      [invoiceId]
    );
    expect(invoiceCheck.rows[0].status).toBe('PAID');
    expect(invoiceCheck.rows[0].payment_status).toBe('PAID');

    // 2. Webhook lanjutan berstatus "pending" → state TIDAK boleh reversal ke UNPAID
    const res2 = await sendWebhook(invoiceNumber, `webhook-e2e-state-pending-${uuidv4()}`, {
      transactionStatus: 'pending',
    });
    expect(res2.status).toBe(200);

    invoiceCheck = await pool.query(
      'SELECT status, payment_status, paid_at, paid_amount FROM invoices WHERE id = $1',
      [invoiceId]
    );
    expect(invoiceCheck.rows[0].status).toBe('PAID');
    expect(invoiceCheck.rows[0].payment_status).toBe('PAID');
    expect(invoiceCheck.rows[0].paid_at).not.toBeNull();

    // 3. Webhook capture ulang dengan id berbeda → tetap PAID (tidak double-charge)
    const res3 = await sendWebhook(invoiceNumber, `webhook-e2e-state-recapture-${uuidv4()}`);
    expect(res3.status).toBe(200);

    invoiceCheck = await pool.query(
      'SELECT status, payment_status, paid_amount FROM invoices WHERE id = $1',
      [invoiceId]
    );
    expect(invoiceCheck.rows[0].status).toBe('PAID');
    expect(invoiceCheck.rows[0].payment_status).toBe('PAID');
    expect(Number(invoiceCheck.rows[0].paid_amount)).toBe(50000);

    await cleanupTestData(invoiceId, encounterId, bookingId);
  });

  // ============================================================
  // TEST 6: ADMIN REPLAY → SUCCESS (200)
  // ============================================================
  it('T6: admin replay webhook gagal → sukses (200)', async () => {
    const replayOrderId = `INV-E2E-WH-REPLAY-${Date.now()}-${uuidv4().slice(0, 6)}`;
    const webhookIdReplay = `webhook-e2e-replay-${uuidv4()}`;

    // 1. Webhook pertama gagal (invoice belum ada) → error record
    const res1 = await sendWebhook(replayOrderId, webhookIdReplay, {
      transactionStatus: 'capture',
      grossAmount: '50000',
    });
    expect(res1.status).toBe(403);

    // 2. Sekarang invoice dibuat dengan nomor yang sama
    const client = await pool.connect();
    let replayInvoiceId = '';
    let replayEncounterId = '';
    let replayBookingId = '';
    try {
      await client.query('BEGIN');
      replayBookingId = uuidv4();
      await client.query(
        `INSERT INTO bookings (id, branch_id, patient_id, doctor_id, booking_date, booking_time, status, booking_code, dp_amount)
         VALUES ($1, $2, $3, $4, CURRENT_DATE, '10:00:00', 'PAYMENT_CONFIRMED', $5, 50000)`,
        [replayBookingId, branchId, patientId, doctorId, `E2E-WH-REPLAY-${uuidv4().slice(0, 6)}`]
      );
      const encRes = await client.query(
        `INSERT INTO encounters (id, branch_id, booking_id, doctor_id, patient_id, status, started_at, treatment)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'COMPLETED', NOW(), 'Scaling')
         RETURNING id`,
        [branchId, replayBookingId, doctorId, patientId]
      );
      replayEncounterId = encRes.rows[0].id;
      const invRes = await client.query(
        `INSERT INTO invoices (id, branch_id, encounter_id, patient_id, booking_id, invoice_number, amount_due, amount_paid, paid_amount, payment_status, status)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 50000, 0, NULL, 'UNPAID', 'UNPAID')
         RETURNING id`,
        [branchId, replayEncounterId, patientId, replayBookingId, replayOrderId]
      );
      replayInvoiceId = invRes.rows[0].id;
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // 3. Admin replay → sukses
    const replayRes = await request(app)
      .post(`/api/admin/webhooks/${webhookIdReplay}/replay`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();
    expect(replayRes.status).toBe(200);
    expect(replayRes.body.success).toBe(true);

    // 4. Error record terhapus — invoice PAID
    const errCheck = await pool.query(
      'SELECT * FROM payment_webhook_errors WHERE webhook_id = $1',
      [webhookIdReplay]
    );
    expect(errCheck.rows.length).toBe(0);

    const invoiceCheck = await pool.query(
      'SELECT status, payment_status, paid_amount FROM invoices WHERE id = $1',
      [replayInvoiceId]
    );
    expect(invoiceCheck.rows[0].status).toBe('PAID');
    expect(invoiceCheck.rows[0].payment_status).toBe('PAID');
    expect(Number(invoiceCheck.rows[0].paid_amount)).toBe(50000);

    await cleanupTestData(replayInvoiceId, replayEncounterId, replayBookingId);
  });
});