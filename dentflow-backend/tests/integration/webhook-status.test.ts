// 🔥 SET ENV
process.env.MIDTRANS_SERVER_KEY = 'test-key';

import { app } from "../../src/index";
import request from 'supertest';
import { pool } from '../../src/config/database';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

describe('Webhook Status Handling (TD-PAY-005)', () => {
  let branchId: string;
  let patientId: string;
  let patientUserId: string;
  let doctorId: string;
  let doctorUserId: string;

  // Shared setup: branch, doctor, patient
  beforeAll(async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const branchRes = await client.query(
        `INSERT INTO branches (id, name, phone, address, is_active)
         VALUES (gen_random_uuid(), 'Webhook Status Test', '021-1234567', 'Jl. Test', true)
         RETURNING id`
      );
      branchId = branchRes.rows[0].id;

      doctorUserId = uuidv4();
      await client.query(
        `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
         VALUES ($1, $2, 'DOCTOR', $3, $4, $5, true)`,
        [doctorUserId, branchId, `status_doctor_${uuidv4().slice(0, 8)}@clinic.com`, `status_doctor_${uuidv4().slice(0, 8)}`, await bcrypt.hash('Doctor123!', 10)]
      );
      const doctorRes = await client.query(
        `INSERT INTO doctors (id, branch_id, user_id, full_name, specialization, license_number, is_available)
         VALUES (gen_random_uuid(), $1, $2, 'drg. Status Test', 'Sp.BM', $3, true)
         RETURNING id`,
        [branchId, doctorUserId, `LIC-${uuidv4().slice(0, 8)}`]
      );
      doctorId = doctorRes.rows[0].id;

      patientUserId = uuidv4();
      await client.query(
        `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
         VALUES ($1, $2, 'PATIENT', $3, $4, $5, true)`,
        [patientUserId, branchId, `status_patient_${uuidv4().slice(0, 8)}@test.com`, `status_patient_${uuidv4().slice(0, 8)}`, await bcrypt.hash('Patient123!', 10)]
      );
      const patientRes = await client.query(
        `INSERT INTO patients (id, branch_id, user_id, full_name, phone)
         VALUES (gen_random_uuid(), $1, $2, 'Status Patient', '08123456789')
         RETURNING id`,
        [branchId, patientUserId]
      );
      patientId = patientRes.rows[0].id;

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Setup failed:', error);
      throw error;
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM payment_webhooks WHERE branch_id = $1', [branchId]);
      await client.query('DELETE FROM doctors WHERE id = $1', [doctorId]);
      await client.query('DELETE FROM patients WHERE id = $1', [patientId]);
      await client.query('DELETE FROM users WHERE id IN ($1, $2)', [doctorUserId, patientUserId]);
      await client.query('DELETE FROM audit_logs WHERE branch_id = $1', [branchId]);
      await client.query('DELETE FROM users WHERE branch_id = $1', [branchId]);
      await client.query('DELETE FROM branches WHERE id = $1', [branchId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Cleanup failed:', error);
    } finally {
      client.release();
      await pool.end();
    }
  });

  // Helper: create booking, encounter, invoice for each test
  const createTestData = async (invoiceNumberSuffix: string) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const bookingId = uuidv4();
      await client.query(
        `INSERT INTO bookings (id, branch_id, patient_id, doctor_id, booking_date, booking_time, status, booking_code, dp_amount)
         VALUES ($1, $2, $3, $4, CURRENT_DATE, '09:00:00', 'PAYMENT_CONFIRMED', $5, 50000)`,
        [bookingId, branchId, patientId, doctorId, `STATUS-${uuidv4().slice(0, 6)}`]
      );

      const encRes = await client.query(
        `INSERT INTO encounters (id, branch_id, booking_id, doctor_id, patient_id, status, started_at, treatment)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'COMPLETED', NOW(), 'Scaling')
         RETURNING id`,
        [branchId, bookingId, doctorId, patientId]
      );
      const encounterId = encRes.rows[0].id;

      const invoiceNumber = `INV-STATUS-${invoiceNumberSuffix}-${uuidv4().slice(0, 6)}`;
      const invoiceRes = await client.query(
        `INSERT INTO invoices (id, branch_id, encounter_id, patient_id, booking_id, invoice_number, amount_due, amount_paid, paid_amount, payment_status, status)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 50000, 0, NULL, 'UNPAID', 'UNPAID')
         RETURNING id`,
        [branchId, encounterId, patientId, bookingId, invoiceNumber]
      );
      const invoiceId = invoiceRes.rows[0].id;
      const webhookId = `webhook-${uuidv4()}`;

      await client.query('COMMIT');

      return { bookingId, encounterId, invoiceId, invoiceNumber, webhookId };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Create test data failed:', error);
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
      console.error('Cleanup test data failed:', error);
    } finally {
      client.release();
    }
  };

  const sendWebhook = async (status: string, invoiceNumber: string, webhookId: string) => {
    const serverKey = process.env.MIDTRANS_SERVER_KEY || 'test-key';
    const statusCode = '200';
    const grossAmount = '50000';
    const orderId = invoiceNumber;

    const payload = {
      status_code: statusCode,
      order_id: orderId,
      transaction_status: status,
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

    return res;
  };

  // Test capture
  it('should handle capture → PAID', async () => {
    const { invoiceId, invoiceNumber, webhookId, encounterId, bookingId } = await createTestData('CAPTURE');
    const res = await sendWebhook('capture', invoiceNumber, webhookId);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const invoiceCheck = await pool.query(
      'SELECT status, payment_status, paid_amount FROM invoices WHERE id = $1',
      [invoiceId]
    );
    expect(invoiceCheck.rows[0].status).toBe('PAID');
    expect(invoiceCheck.rows[0].payment_status).toBe('PAID');
    expect(Number(invoiceCheck.rows[0].paid_amount)).toBe(50000);

    await cleanupTestData(invoiceId, encounterId, bookingId);
  });

  // Test deny
  it('should handle deny → FAILED, booking cancelled', async () => {
    const { invoiceId, invoiceNumber, webhookId, encounterId, bookingId } = await createTestData('DENY');
    const res = await sendWebhook('deny', invoiceNumber, webhookId);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const invoiceCheck = await pool.query(
      'SELECT payment_status, status FROM invoices WHERE id = $1',
      [invoiceId]
    );
    expect(invoiceCheck.rows[0].payment_status).toBe('UNPAID');
    expect(invoiceCheck.rows[0].status).toBe('UNPAID');

    const bookingCheck = await pool.query(
      'SELECT status, cancel_reason FROM bookings WHERE id = $1',
      [bookingId]
    );
    expect(bookingCheck.rows[0].status).toBe('CANCELLED');
    expect(bookingCheck.rows[0].cancel_reason).toContain('deny');

    await cleanupTestData(invoiceId, encounterId, bookingId);
  });

  // Test expire
  it('should handle expire → FAILED, booking cancelled', async () => {
    const { invoiceId, invoiceNumber, webhookId, encounterId, bookingId } = await createTestData('EXPIRE');
    const res = await sendWebhook('expire', invoiceNumber, webhookId);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const invoiceCheck = await pool.query(
      'SELECT payment_status, status FROM invoices WHERE id = $1',
      [invoiceId]
    );
    expect(invoiceCheck.rows[0].payment_status).toBe('UNPAID');
    expect(invoiceCheck.rows[0].status).toBe('UNPAID');

    const bookingCheck = await pool.query(
      'SELECT status, cancel_reason FROM bookings WHERE id = $1',
      [bookingId]
    );
    expect(bookingCheck.rows[0].status).toBe('CANCELLED');
    expect(bookingCheck.rows[0].cancel_reason).toContain('expire');

    await cleanupTestData(invoiceId, encounterId, bookingId);
  });

  // Test pending
  it('should handle pending → keep status', async () => {
    const { invoiceId, invoiceNumber, webhookId, encounterId, bookingId } = await createTestData('PENDING');
    const res = await sendWebhook('pending', invoiceNumber, webhookId);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const invoiceCheck = await pool.query(
      'SELECT payment_status, status FROM invoices WHERE id = $1',
      [invoiceId]
    );
    expect(invoiceCheck.rows[0].payment_status).toBe('UNPAID');
    expect(invoiceCheck.rows[0].status).toBe('UNPAID');

    const bookingCheck = await pool.query(
      'SELECT status FROM bookings WHERE id = $1',
      [bookingId]
    );
    expect(bookingCheck.rows[0].status).toBe('PAYMENT_CONFIRMED');

    await cleanupTestData(invoiceId, encounterId, bookingId);
  });
});
