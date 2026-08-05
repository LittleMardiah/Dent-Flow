// 🔥 SET ENV SEBELUM IMPORT APP
process.env.MIDTRANS_SERVER_KEY = 'test-key';

import { app } from "../../src/index";
import request from 'supertest';
import { pool } from '../../src/config/database';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

describe('Webhook Retry Integration (Fixed)', () => {
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

      // 2. Doctor user
      doctorUserId = uuidv4();
      await client.query(
        `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
         VALUES ($1, $2, 'DOCTOR', $3, $4, $5, true)`,
        [doctorUserId, branchId, `retry_doctor_${uuidv4().slice(0, 8)}@clinic.com`, `retry_doctor_${uuidv4().slice(0, 8)}`, await bcrypt.hash('Doctor123!', 10)]
      );
      console.log(`✅ Doctor user created: ${doctorUserId}`);

      // 3. Doctor record (license number unique)
      const licenseNumber = `LIC-${uuidv4().slice(0, 8)}`;
      const doctorRes = await client.query(
        `INSERT INTO doctors (id, branch_id, user_id, full_name, specialization, license_number, is_available)
         VALUES (gen_random_uuid(), $1, $2, 'drg. Retry Test', 'Sp.BM', $3, true)
         RETURNING id`,
        [branchId, doctorUserId, licenseNumber]
      );
      doctorId = doctorRes.rows[0].id;
      console.log(`✅ Doctor record created: ${doctorId} (license: ${licenseNumber})`);

      // 4. Patient user
      patientUserId = uuidv4();
      await client.query(
        `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
         VALUES ($1, $2, 'PATIENT', $3, $4, $5, true)`,
        [patientUserId, branchId, `retry_patient_${uuidv4().slice(0, 8)}@test.com`, `retry_patient_${uuidv4().slice(0, 8)}`, await bcrypt.hash('Patient123!', 10)]
      );
      console.log(`✅ Patient user created: ${patientUserId}`);

      // 5. Patient record
      const patientRes = await client.query(
        `INSERT INTO patients (id, branch_id, user_id, full_name, phone)
         VALUES (gen_random_uuid(), $1, $2, 'Retry Patient', '08123456789')
         RETURNING id`,
        [branchId, patientUserId]
      );
      patientId = patientRes.rows[0].id;
      console.log(`✅ Patient record created: ${patientId}`);

      // 6. Booking
      bookingId = uuidv4();
      await client.query(
        `INSERT INTO bookings (id, branch_id, patient_id, doctor_id, booking_date, booking_time, status, booking_code, dp_amount)
         VALUES ($1, $2, $3, $4, CURRENT_DATE, '09:00:00', 'PAYMENT_CONFIRMED', $5, 50000)`,
        [bookingId, branchId, patientId, doctorId, `RETRY-${uuidv4().slice(0, 6)}`]
      );
      console.log(`✅ Booking created: ${bookingId}`);

      // 7. Encounter
      const encRes = await client.query(
        `INSERT INTO encounters (id, branch_id, booking_id, doctor_id, patient_id, status, started_at, treatment)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'COMPLETED', NOW(), 'Scaling')
         RETURNING id`,
        [branchId, bookingId, doctorId, patientId]
      );
      encounterId = encRes.rows[0].id;
      console.log(`✅ Encounter created: ${encounterId}`);

      // 8. Invoice with dynamic number
      invoiceNumber = `INV-RETRY-${uuidv4().slice(0, 6)}`;
      const invoiceRes = await client.query(
        `INSERT INTO invoices (id, branch_id, encounter_id, patient_id, booking_id, invoice_number, amount_due, amount_paid, paid_amount, status)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 50000, 0, NULL, 'UNPAID')
         RETURNING id`,
        [branchId, encounterId, patientId, bookingId, invoiceNumber]
      );
      invoiceId = invoiceRes.rows[0].id;
      console.log(`✅ Invoice created: ${invoiceId} with number ${invoiceNumber}`);

      webhookId = `webhook-retry-${uuidv4()}`;
      console.log(`✅ Webhook ID: ${webhookId}`);

      await client.query('COMMIT');
      console.log('✅ [beforeAll] Setup complete!');
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      console.error('❌ [beforeAll] Setup failed:', error);
      throw error;
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    console.log('🧹 [afterAll] Cleaning up...');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // 🔥 Hapus payment_webhooks dulu untuk menghindari FK constraint
      await client.query('DELETE FROM payment_webhooks WHERE branch_id = $1', [branchId]);
      await client.query('DELETE FROM invoices WHERE id = $1', [invoiceId]);
      await client.query('DELETE FROM encounters WHERE id = $1', [encounterId]);
      await client.query('DELETE FROM bookings WHERE id = $1', [bookingId]);
      await client.query('DELETE FROM patients WHERE id = $1', [patientId]);
      await client.query('DELETE FROM doctors WHERE id = $1', [doctorId]);
      await client.query('DELETE FROM users WHERE id IN ($1, $2)', [doctorUserId, patientUserId]);
      await client.query('DELETE FROM users WHERE branch_id = $1', [branchId]);
      await client.query('DELETE FROM branches WHERE id = $1', [branchId]);
      await client.query('COMMIT');
      console.log('✅ [afterAll] Cleanup complete.');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ [afterAll] Cleanup failed:', error);
    } finally {
      client.release();
      await pool.end();
    }
  });

  it('should process webhook successfully and update invoice', async () => {
    console.log('🔍 [test] Starting webhook test...');
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

    console.log('🔍 [test] raw:', raw);
    console.log('🔍 [test] signature:', signature);
    console.log('🔍 [test] serverKey:', serverKey);

    const res = await request(app)
      .post('/webhooks/midtrans')
      .set('x-midtrans-signature', signature)
      .set('x-midtrans-webhook-id', webhookId)
      .send(payload);

    console.log('🔍 [test] response:', res.status, res.body);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // 🔥 CEK paid_amount (bukan amount_paid)
    const invoiceCheck = await pool.query(
      'SELECT status, amount_paid, paid_amount FROM invoices WHERE id = $1',
      [invoiceId]
    );
    console.log('🔍 [test] Invoice status:', invoiceCheck.rows[0]);
    expect(invoiceCheck.rows[0].status).toBe('PAID');
    expect(Number(invoiceCheck.rows[0].paid_amount)).toBe(50000);
    console.log('✅ [test] Test passed!');
  });
});
