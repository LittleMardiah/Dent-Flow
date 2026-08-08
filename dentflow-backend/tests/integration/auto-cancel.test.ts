// 🔥 SET ENV SEBELUM IMPORT APP
process.env.MIDTRANS_SERVER_KEY = 'test-key';

import { app } from "../../src/index";
import request from 'supertest';
import { pool } from '../../src/config/database';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { webhookRetryJob } from '../../src/jobs/webhookRetry.job';

describe('Auto-Cancel 24h (TD-PAY-019)', () => {
  let branchId: string;
  let patientId: string;
  let patientUserId: string;
  let doctorId: string;
  let doctorUserId: string;
  let bookingId: string;
  let encounterId: string;
  let invoiceId: string;
  let invoiceNumber: string;

  // Helper: create booking with custom created_at
  async function createBookingWithDate(branchId: string, patientId: string, doctorId: string, createdDate: Date) {
    const client = await pool.connect();
    try {
      const bookingId = uuidv4();
      await client.query(
        `INSERT INTO bookings (id, branch_id, patient_id, doctor_id, booking_date, booking_time, status, booking_code, dp_amount, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_DATE, '09:00:00', 'PENDING_PAYMENT', $5, 50000, $6)`,
        [bookingId, branchId, patientId, doctorId, `AUTO-${uuidv4().slice(0, 6)}`, createdDate]
      );
      return bookingId;
    } finally {
      client.release();
    }
  }

  // Helper: create booking & encounter & invoice
  async function createFullBooking(branchId: string, patientId: string, doctorId: string, createdDate?: Date) {
    const client = await pool.connect();
    try {
      const bookingId = uuidv4();
      const bookingDate = createdDate || new Date();
      await client.query(
        `INSERT INTO bookings (id, branch_id, patient_id, doctor_id, booking_date, booking_time, status, booking_code, dp_amount, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_DATE, '09:00:00', 'PENDING_PAYMENT', $5, 50000, $6)`,
        [bookingId, branchId, patientId, doctorId, `AUTO-${uuidv4().slice(0, 6)}`, bookingDate]
      );

      const encRes = await client.query(
        `INSERT INTO encounters (id, branch_id, booking_id, doctor_id, patient_id, status, started_at, treatment)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ONGOING', NOW(), 'Scaling')
         RETURNING id`,
        [branchId, bookingId, doctorId, patientId]
      );
      const encounterId = encRes.rows[0].id;

      const invoiceNumber = `INV-AUTO-${uuidv4().slice(0, 6)}`;
      await client.query(
        `INSERT INTO invoices (id, branch_id, encounter_id, patient_id, booking_id, invoice_number, amount_due, amount_paid, paid_amount, status)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 50000, 0, NULL, 'UNPAID')`,
        [branchId, encounterId, patientId, bookingId, invoiceNumber]
      );

      return { bookingId, encounterId, invoiceNumber };
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
         VALUES (gen_random_uuid(), 'Auto-Cancel Test', '021-1234567', 'Jl. Test', true)
         RETURNING id`
      );
      branchId = branchRes.rows[0].id;
      console.log(`✅ Branch created: ${branchId}`);

      // 2. Doctor
      doctorUserId = uuidv4();
      await client.query(
        `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
         VALUES ($1, $2, 'DOCTOR', $3, $4, $5, true)`,
        [doctorUserId, branchId, `auto_doctor_${uuidv4().slice(0, 8)}@clinic.com`, `auto_doctor_${uuidv4().slice(0, 8)}`, await bcrypt.hash('Doctor123!', 10)]
      );
      const licenseNumber = `LIC-${uuidv4().slice(0, 8)}`;
      const doctorRes = await client.query(
        `INSERT INTO doctors (id, branch_id, user_id, full_name, specialization, license_number, is_available)
         VALUES (gen_random_uuid(), $1, $2, 'drg. Auto Test', 'Sp.BM', $3, true)
         RETURNING id`,
        [branchId, doctorUserId, licenseNumber]
      );
      doctorId = doctorRes.rows[0].id;
      console.log(`✅ Doctor created: ${doctorId}`);

      // 3. Patient
      patientUserId = uuidv4();
      await client.query(
        `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
         VALUES ($1, $2, 'PATIENT', $3, $4, $5, true)`,
        [patientUserId, branchId, `auto_patient_${uuidv4().slice(0, 8)}@test.com`, `auto_patient_${uuidv4().slice(0, 8)}`, await bcrypt.hash('Patient123!', 10)]
      );
      const patientRes = await client.query(
        `INSERT INTO patients (id, branch_id, user_id, full_name, phone)
         VALUES (gen_random_uuid(), $1, $2, 'Auto Patient', '08123456789')
         RETURNING id`,
        [branchId, patientUserId]
      );
      patientId = patientRes.rows[0].id;
      console.log(`✅ Patient created: ${patientId}`);

      await client.query('COMMIT');
      client.release();

      // 4. Booking dengan created_at 25 jam lalu
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
      const result = await createFullBooking(branchId, patientId, doctorId, twentyFiveHoursAgo);
      bookingId = result.bookingId;
      encounterId = result.encounterId;
      invoiceNumber = result.invoiceNumber;
      console.log(`✅ Booking created with created_at = NOW() - 25 hours: ${bookingId}`);
      console.log(`✅ Invoice created: ${invoiceNumber}`);

      console.log('✅ [beforeAll] Setup complete!');
    } catch (error) {
      console.error('❌ [beforeAll] Setup failed:', error);
      throw error;
    }
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

  it('should auto-cancel booking after 24 hours of failed payment (using invoice_number)', async () => {
    console.log('🔍 [test] Starting auto-cancel test (invoice_number)...');

    // Panggil handleAutoCancel dengan invoice_number
    await webhookRetryJob.handleAutoCancel(invoiceNumber);

    const afterCheck = await pool.query(
      'SELECT status, cancel_reason FROM bookings WHERE id = $1',
      [bookingId]
    );
    expect(afterCheck.rows[0].status).toBe('CANCELLED');
    expect(afterCheck.rows[0].cancel_reason).toBe('payment_failure_timeout');
    console.log('✅ [test] Auto-cancel with invoice_number successful!');
  });

  it('should NOT auto-cancel booking if less than 24 hours old', async () => {
    // Buat branch & data baru
    const branchRes = await pool.query(
      `INSERT INTO branches (id, name, phone, address, is_active)
       VALUES (gen_random_uuid(), 'Auto-Cancel Test 2', '021-1234567', 'Jl. Test', true)
       RETURNING id`
    );
    const newBranchId = branchRes.rows[0].id;

    const doctorUserId2 = uuidv4();
    await pool.query(
      `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
       VALUES ($1, $2, 'DOCTOR', $3, $4, $5, true)`,
      [doctorUserId2, newBranchId, `auto_doctor2_${uuidv4().slice(0, 8)}@clinic.com`, `auto_doctor2_${uuidv4().slice(0, 8)}`, await bcrypt.hash('Doctor123!', 10)]
    );
    const doctorRes2 = await pool.query(
      `INSERT INTO doctors (id, branch_id, user_id, full_name, specialization, license_number, is_available)
       VALUES (gen_random_uuid(), $1, $2, 'drg. Auto Test 2', 'Sp.BM', $3, true)
       RETURNING id`,
      [newBranchId, doctorUserId2, `LIC-${uuidv4().slice(0, 8)}`]
    );
    const doctorId2 = doctorRes2.rows[0].id;

    const patientUserId2 = uuidv4();
    await pool.query(
      `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
       VALUES ($1, $2, 'PATIENT', $3, $4, $5, true)`,
      [patientUserId2, newBranchId, `auto_patient2_${uuidv4().slice(0, 8)}@test.com`, `auto_patient2_${uuidv4().slice(0, 8)}`, await bcrypt.hash('Patient123!', 10)]
    );
    const patientRes2 = await pool.query(
      `INSERT INTO patients (id, branch_id, user_id, full_name, phone)
       VALUES (gen_random_uuid(), $1, $2, 'Auto Patient 2', '08123456789')
       RETURNING id`,
      [newBranchId, patientUserId2]
    );
    const patientId2 = patientRes2.rows[0].id;

    // Buat booking < 24 jam
    const freshBooking = await createFullBooking(newBranchId, patientId2, doctorId2, new Date());
    console.log(`✅ New booking created (less than 24h old): ${freshBooking.bookingId}`);

    // Panggil handleAutoCancel dengan invoice_number
    await webhookRetryJob.handleAutoCancel(freshBooking.invoiceNumber);

    const afterCheck = await pool.query(
      'SELECT status FROM bookings WHERE id = $1',
      [freshBooking.bookingId]
    );
    expect(afterCheck.rows[0].status).toBe('PENDING_PAYMENT');

    // Cleanup branch baru
    await pool.query('DELETE FROM invoices WHERE branch_id = $1', [newBranchId]);
    await pool.query('DELETE FROM encounters WHERE branch_id = $1', [newBranchId]);
    await pool.query('DELETE FROM bookings WHERE branch_id = $1', [newBranchId]);
    await pool.query('DELETE FROM patients WHERE branch_id = $1', [newBranchId]);
    await pool.query('DELETE FROM doctors WHERE branch_id = $1', [newBranchId]);
    await pool.query('DELETE FROM users WHERE branch_id = $1', [newBranchId]);
    await pool.query('DELETE FROM branches WHERE id = $1', [newBranchId]);

    console.log('✅ [test] Under 24h test passed!');
  });

  it('should auto-cancel using booking_id fallback (not invoice_number)', async () => {
    // Buat branch & data baru untuk test fallback
    const branchRes = await pool.query(
      `INSERT INTO branches (id, name, phone, address, is_active)
       VALUES (gen_random_uuid(), 'Auto-Cancel Test 3', '021-1234567', 'Jl. Test', true)
       RETURNING id`
    );
    const newBranchId = branchRes.rows[0].id;

    const doctorUserId3 = uuidv4();
    await pool.query(
      `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
       VALUES ($1, $2, 'DOCTOR', $3, $4, $5, true)`,
      [doctorUserId3, newBranchId, `auto_doctor3_${uuidv4().slice(0, 8)}@clinic.com`, `auto_doctor3_${uuidv4().slice(0, 8)}`, await bcrypt.hash('Doctor123!', 10)]
    );
    const doctorRes3 = await pool.query(
      `INSERT INTO doctors (id, branch_id, user_id, full_name, specialization, license_number, is_available)
       VALUES (gen_random_uuid(), $1, $2, 'drg. Auto Test 3', 'Sp.BM', $3, true)
       RETURNING id`,
      [newBranchId, doctorUserId3, `LIC-${uuidv4().slice(0, 8)}`]
    );
    const doctorId3 = doctorRes3.rows[0].id;

    const patientUserId3 = uuidv4();
    await pool.query(
      `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
       VALUES ($1, $2, 'PATIENT', $3, $4, $5, true)`,
      [patientUserId3, newBranchId, `auto_patient3_${uuidv4().slice(0, 8)}@test.com`, `auto_patient3_${uuidv4().slice(0, 8)}`, await bcrypt.hash('Patient123!', 10)]
    );
    const patientRes3 = await pool.query(
      `INSERT INTO patients (id, branch_id, user_id, full_name, phone)
       VALUES (gen_random_uuid(), $1, $2, 'Auto Patient 3', '08123456789')
       RETURNING id`,
      [newBranchId, patientUserId3]
    );
    const patientId3 = patientRes3.rows[0].id;

    // Booking dengan created_at 25 jam lalu
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const result = await createFullBooking(newBranchId, patientId3, doctorId3, twentyFiveHoursAgo);
    console.log(`✅ Booking with booking_id: ${result.bookingId}`);

    // Panggil handleAutoCancel dengan booking_id (UUID) — fallback
    await webhookRetryJob.handleAutoCancel(result.bookingId);

    const afterCheck = await pool.query(
      'SELECT status, cancel_reason FROM bookings WHERE id = $1',
      [result.bookingId]
    );
    expect(afterCheck.rows[0].status).toBe('CANCELLED');
    expect(afterCheck.rows[0].cancel_reason).toBe('payment_failure_timeout');

    // Cleanup
    await pool.query('DELETE FROM invoices WHERE branch_id = $1', [newBranchId]);
    await pool.query('DELETE FROM encounters WHERE branch_id = $1', [newBranchId]);
    await pool.query('DELETE FROM bookings WHERE branch_id = $1', [newBranchId]);
    await pool.query('DELETE FROM patients WHERE branch_id = $1', [newBranchId]);
    await pool.query('DELETE FROM doctors WHERE branch_id = $1', [newBranchId]);
    await pool.query('DELETE FROM users WHERE branch_id = $1', [newBranchId]);
    await pool.query('DELETE FROM branches WHERE id = $1', [newBranchId]);

    console.log('✅ [test] Booking_id fallback test passed!');
  });
});
