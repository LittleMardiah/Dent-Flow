import { app } from "../../src/index";
import request from 'supertest';
;
import { pool } from '../../src/config/database';
import { InvoiceService } from '../../src/services/invoice.service';
import { InvoiceStateValidator } from '../../src/services/invoiceStateValidator.service';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

describe.skip('Invoice State Machine & Database Constraints', () => {
  let adminToken: string;
  let testInvoiceId: string;
  const branchId = '494a607c-d109-4330-a3a9-68f54326f0c7';

  beforeAll(async () => {
    // === Ensure constraint exists (self-contained) ===
    const constraintCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM pg_constraint 
        WHERE conname = 'valid_paid_state' AND conrelid = 'invoices'::regclass
      );
    `);
    if (!constraintCheck.rows[0].exists) {
      console.log('🔄 Adding valid_paid_state constraint...');
      // Fix existing data first
      await pool.query(
        `UPDATE invoices SET amount_paid = 0, paid_at = NULL WHERE status = 'UNPAID' AND (amount_paid != 0 OR paid_at IS NOT NULL);`
      );
      await pool.query(
        `UPDATE invoices SET amount_paid = amount_due WHERE status = 'PAID' AND (amount_paid != amount_due OR paid_at IS NULL);`
      );
      await pool.query(`
        ALTER TABLE invoices ADD CONSTRAINT valid_paid_state CHECK (
          (status = 'UNPAID' AND paid_at IS NULL AND amount_paid = 0) OR
          (status = 'PARTIAL' AND paid_at IS NOT NULL AND amount_paid > 0 AND amount_paid < amount_due) OR
          (status = 'PAID' AND paid_at IS NOT NULL AND amount_paid = amount_due)
        );
      `);
      console.log('✅ valid_paid_state constraint added.');
    }

    // Login admin
    const adminRes = await request(app)
      .post('/auth/admin/login')
      .send({ username: 'admin_a', password: 'Admin123!' });
    adminToken = adminRes.body.data.token;
    expect(adminRes.status).toBe(200);

    // 1. Branch
    await pool.query(
      `INSERT INTO branches (id, name, phone, address, is_active)
       VALUES ($1, 'Cabang Test', '021-1234567', 'Jl. Test', true)
       ON CONFLICT (id) DO NOTHING`,
      [branchId]
    );

    // 2. Patient
    const patientUserId = await pool.query(
      `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
       VALUES (gen_random_uuid(), $1, 'PATIENT', 'test_patient@clinic.com', 'test_patient', $2, true)
       ON CONFLICT (username) DO NOTHING
       RETURNING id`,
      [branchId, await bcrypt.hash('password', 10)]
    );
    let patientId;
    if (patientUserId.rows.length > 0) {
      const pid = patientUserId.rows[0].id;
      const patRes = await pool.query(
        `INSERT INTO patients (id, branch_id, user_id, full_name, phone)
         VALUES (gen_random_uuid(), $1, $2, 'Test Patient', '08123456789')
         ON CONFLICT (user_id) DO NOTHING
         RETURNING id`,
        [branchId, pid]
      );
      patientId = patRes.rows[0].id;
    } else {
      const existing = await pool.query('SELECT id FROM patients LIMIT 1');
      patientId = existing.rows[0].id;
    }

    // 3. Doctor
    const doctorUserId = '965dedad-11ba-46a3-a402-f88c2029c676';
    await pool.query(
      `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
       VALUES ($1, $2, 'DOCTOR', 'dr_test@clinic.com', 'dr_test', $3, true)
       ON CONFLICT (id) DO NOTHING`,
      [doctorUserId, branchId, await bcrypt.hash('Doctor123!', 10)]
    );
    const doctorRes = await pool.query(
      `INSERT INTO doctors (id, branch_id, user_id, full_name, specialization, license_number, is_available)
       VALUES (gen_random_uuid(), $1, $2, 'drg. Test Sp.BM', 'Sp.BM', 'LIC-001', true)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING id`,
      [branchId, doctorUserId]
    );
    let doctorId;
    if (doctorRes.rows.length > 0) {
      doctorId = doctorRes.rows[0].id;
    } else {
      const existing = await pool.query('SELECT id FROM doctors WHERE user_id = $1', [doctorUserId]);
      doctorId = existing.rows[0].id;
    }

    // 4. Booking (with unique booking_code)
    const uniqueCode = randomBytes(4).toString('hex').toUpperCase();
    const bookingRes = await pool.query(
      `INSERT INTO bookings (id, branch_id, patient_id, doctor_id, booking_date, booking_time, status, booking_code, is_walk_in)
       VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_DATE, '09:00:00', 'PENDING', $4, false)
       RETURNING id`,
      [branchId, patientId, doctorId, uniqueCode]
    );
    const bookingId = bookingRes.rows[0].id;

    // 5. Encounter
    const encRes = await pool.query(
      `INSERT INTO encounters (id, branch_id, booking_id, doctor_id, patient_id, status, started_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'IN_PROGRESS', NOW())
       RETURNING id`,
      [branchId, bookingId, doctorId, patientId]
    );
    const encounterId = encRes.rows[0].id;

    // 6. Invoice
    const invoiceRes = await pool.query(
      `INSERT INTO invoices (id, branch_id, encounter_id, patient_id, amount_due, amount_paid, status)
       VALUES (gen_random_uuid(), $1, $2, $3, 200000, 0, 'UNPAID')
       RETURNING id`,
      [branchId, encounterId, patientId]
    );
    testInvoiceId = invoiceRes.rows[0].id;
  });

  afterAll(async () => {
    if (testInvoiceId) {
      await pool.query('DELETE FROM invoices WHERE id = $1', [testInvoiceId]);
    }
    await pool.end();
  });

  it('should validate state transition: UNPAID -> PAID allowed', () => {
    expect(InvoiceStateValidator.validateTransition('UNPAID', 'PAID')).toBe(true);
  });

  it('should validate state transition: PAID -> UNPAID not allowed', () => {
    expect(InvoiceStateValidator.validateTransition('PAID', 'UNPAID')).toBe(false);
  });

  it('should mark invoice as paid (admin)', async () => {
    const res = await request(app)
      .post(`/api/admin/invoices/${testInvoiceId}/mark-paid`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        payment_method: 'CASH',
        paid_amount: 200000,
        notes: 'Payment received',
      });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PAID');
    expect(Number(res.body.data.amount_paid)).toBe(200000);
    expect(res.body.data.paid_at).not.toBeNull();
  });

  it('should not allow marking already paid invoice again', async () => {
    const res = await request(app)
      .post(`/api/admin/invoices/${testInvoiceId}/mark-paid`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        payment_method: 'CASH',
        paid_amount: 200000,
      });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('INVOICE_ALREADY_PAID');
  });

  it('should undo payment (admin override)', async () => {
    const res = await request(app)
      .post(`/api/admin/invoices/${testInvoiceId}/undo-payment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'Customer requested refund',
      });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('UNPAID');
    expect(res.body.data.paid_at).toBeNull();
    expect(Number(res.body.data.amount_paid)).toBe(0);
  });

  it('should not undo non-paid invoice', async () => {
    const res = await request(app)
      .post(`/api/admin/invoices/${testInvoiceId}/undo-payment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'Test',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVOICE_NOT_PAID');
  });

  it('should have database constraint preventing invalid state', async () => {
    // Create new unique booking/encounter for this test
    const uniqueCode2 = randomBytes(4).toString('hex').toUpperCase();
    const bookingRes2 = await pool.query(
      `INSERT INTO bookings (id, branch_id, patient_id, doctor_id, booking_date, booking_time, status, booking_code, is_walk_in)
       VALUES (gen_random_uuid(), $1, (SELECT id FROM patients LIMIT 1), (SELECT id FROM doctors LIMIT 1), CURRENT_DATE, '10:00:00', 'PENDING', $2, false)
       RETURNING id`,
      [branchId, uniqueCode2]
    );
    const bookingId2 = bookingRes2.rows[0].id;
    const encRes2 = await pool.query(
      `INSERT INTO encounters (id, branch_id, booking_id, doctor_id, patient_id, status, started_at)
       VALUES (gen_random_uuid(), $1, $2, (SELECT id FROM doctors LIMIT 1), (SELECT id FROM patients LIMIT 1), 'IN_PROGRESS', NOW())
       RETURNING id`,
      [branchId, bookingId2]
    );
    const encounterId2 = encRes2.rows[0].id;

    await expect(
      pool.query(
        `INSERT INTO invoices (id, branch_id, encounter_id, patient_id, amount_due, amount_paid, status, paid_at)
         VALUES (gen_random_uuid(), $1, $2, (SELECT id FROM patients LIMIT 1), 100000, 0, 'UNPAID', NOW())`,
        [branchId, encounterId2]
      )
    ).rejects.toThrow(/check constraint|invalid paid state/i);
  });
});
