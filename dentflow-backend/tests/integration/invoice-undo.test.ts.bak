// 🔥 SET ENV SEBELUM IMPORT APP
process.env.MIDTRANS_SERVER_KEY = 'test-key';

import { app } from "../../src/index";
import request from 'supertest';
import { pool } from '../../src/config/database';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

describe('Invoice Undo Payment (TD-PAY-021)', () => {
  let branchId: string;
  let patientId: string;
  let patientUserId: string;
  let doctorId: string;
  let doctorUserId: string;
  let bookingId: string;
  let encounterId: string;
  let invoiceId: string;
  let invoiceNumber: string;
  let adminToken: string;
  let adminUsername: string;

  beforeAll(async () => {
    console.log('🔧 [beforeAll] Starting setup...');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Branch
      const branchRes = await client.query(
        `INSERT INTO branches (id, name, phone, address, is_active)
         VALUES (gen_random_uuid(), 'Undo Test Branch', '021-1234567', 'Jl. Test', true)
         RETURNING id`
      );
      branchId = branchRes.rows[0].id;
      console.log(`✅ Branch created: ${branchId}`);

      // 2. Admin
      adminUsername = `undo_admin_${uuidv4().slice(0, 8)}`;
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
        [doctorUserId, branchId, `undo_doctor_${uuidv4().slice(0, 8)}@clinic.com`, `undo_doctor_${uuidv4().slice(0, 8)}`, await bcrypt.hash('Doctor123!', 10)]
      );
      const licenseNumber = `LIC-${uuidv4().slice(0, 8)}`;
      const doctorRes = await client.query(
        `INSERT INTO doctors (id, branch_id, user_id, full_name, specialization, license_number, is_available)
         VALUES (gen_random_uuid(), $1, $2, 'drg. Undo Test', 'Sp.BM', $3, true)
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
        [patientUserId, branchId, `undo_patient_${uuidv4().slice(0, 8)}@test.com`, `undo_patient_${uuidv4().slice(0, 8)}`, await bcrypt.hash('Patient123!', 10)]
      );
      const patientRes = await client.query(
        `INSERT INTO patients (id, branch_id, user_id, full_name, phone)
         VALUES (gen_random_uuid(), $1, $2, 'Undo Patient', '08123456789')
         RETURNING id`,
        [branchId, patientUserId]
      );
      patientId = patientRes.rows[0].id;
      console.log(`✅ Patient created: ${patientId}`);

      // 5. Booking
      bookingId = uuidv4();
      await client.query(
        `INSERT INTO bookings (id, branch_id, patient_id, doctor_id, booking_date, booking_time, status, booking_code, dp_amount)
         VALUES ($1, $2, $3, $4, CURRENT_DATE, '09:00:00', 'PAYMENT_CONFIRMED', $5, 50000)`,
        [bookingId, branchId, patientId, doctorId, `UNDO-${uuidv4().slice(0, 6)}`]
      );
      console.log(`✅ Booking created: ${bookingId}`);

      // 6. Encounter
      const encRes = await client.query(
        `INSERT INTO encounters (id, branch_id, booking_id, doctor_id, patient_id, status, started_at, treatment)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ONGOING', NOW(), 'Scaling')
         RETURNING id`,
        [branchId, bookingId, doctorId, patientId]
      );
      encounterId = encRes.rows[0].id;
      console.log(`✅ Encounter created: ${encounterId}`);

      // 7. Invoice (UNPAID)
      invoiceNumber = `INV-UNDO-${uuidv4().slice(0, 6)}`;
      const invoiceRes = await client.query(
        `INSERT INTO invoices (id, branch_id, encounter_id, patient_id, booking_id, invoice_number, amount_due, amount_paid, paid_amount, status)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 50000, 0, NULL, 'UNPAID')
         RETURNING id`,
        [branchId, encounterId, patientId, bookingId, invoiceNumber]
      );
      invoiceId = invoiceRes.rows[0].id;
      console.log(`✅ Invoice created: ${invoiceId} with number ${invoiceNumber}`);

      await client.query('COMMIT');
      console.log('✅ [beforeAll] Setup complete!');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ [beforeAll] Setup failed:', error);
      throw error;
    } finally {
      client.release();
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
      await client.query('DELETE FROM invoice_payments WHERE invoice_id = $1', [invoiceId]);
      await client.query('DELETE FROM invoices WHERE id = $1', [invoiceId]);
      await client.query('DELETE FROM encounters WHERE id = $1', [encounterId]);
      await client.query('DELETE FROM bookings WHERE id = $1', [bookingId]);
      await client.query('DELETE FROM patients WHERE id = $1', [patientId]);
      await client.query('DELETE FROM doctors WHERE id = $1', [doctorId]);
      await client.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [doctorUserId, patientUserId, adminUsername]);
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

  it('should undo payment without bypassing trigger', async () => {
    // 1. Mark invoice as PAID dulu (via webhook atau admin)
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
    const webhookId = `webhook-undo-${uuidv4()}`;

    const webhookRes = await request(app)
      .post('/webhooks/midtrans')
      .set('x-midtrans-signature', signature)
      .set('x-midtrans-webhook-id', webhookId)
      .send(payload);
    expect(webhookRes.status).toBe(200);

    // 2. Verifikasi invoice PAID dan history tercatat
    const paidCheck = await pool.query(
      'SELECT status, paid_amount FROM invoices WHERE id = $1',
      [invoiceId]
    );
    expect(paidCheck.rows[0].status).toBe('PAID');
    expect(Number(paidCheck.rows[0].paid_amount)).toBe(50000);

    // 3. Undo payment via admin
    const undoRes = await request(app)
      .post(`/api/admin/invoices/${invoiceId}/undo-payment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Test undo without bypass' });
    expect(undoRes.status).toBe(200);

    // 4. Verifikasi invoice UNPAID
    const undoCheck = await pool.query(
      'SELECT status, paid_amount FROM invoices WHERE id = $1',
      [invoiceId]
    );
    expect(undoCheck.rows[0].status).toBe('UNPAID');
    expect(undoCheck.rows[0].paid_amount).toBeNull();

    // 5. 🔥 CEK: history di invoice_payments harus ada 2 entries (PAID + UNPAID)
    const historyCheck = await pool.query(
      `SELECT status, amount FROM invoice_payments WHERE invoice_id = $1 ORDER BY created_at`,
      [invoiceId]
    );
    expect(historyCheck.rows.length).toBe(2);
    expect(historyCheck.rows[0].status).toBe('PAID');
    expect(Number(historyCheck.rows[0].amount)).toBe(50000);
    expect(historyCheck.rows[1].status).toBe('UNPAID');
    expect(Number(historyCheck.rows[1].amount)).toBe(0);

    // 6. Verifikasi audit log
    const auditCheck = await pool.query(
      `SELECT event_type FROM audit_logs 
       WHERE entity_id = $1 AND event_type = 'INVOICE_UNDO_PAYMENT'`,
      [invoiceId]
    );
    expect(auditCheck.rows.length).toBe(1);

    console.log('✅ [test] Undo without bypass successful, history preserved!');
  });
});
