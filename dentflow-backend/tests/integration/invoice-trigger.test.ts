import { pool } from '../../src/config/database';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

describe('Invoice Payment Trigger (TD-PAY-011)', () => {
  let branchId: string;
  let patientId: string;
  let patientUserId: string;
  let doctorId: string;
  let doctorUserId: string;
  let bookingId: string;
  let encounterId: string;
  let invoiceId: string;
  let invoiceNumber: string;

  beforeAll(async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const branchRes = await client.query(
        `INSERT INTO branches (id, name, phone, address, is_active)
         VALUES (gen_random_uuid(), 'Trigger Test', '021-1234567', 'Jl. Test', true)
         RETURNING id`
      );
      branchId = branchRes.rows[0].id;

      doctorUserId = uuidv4();
      await client.query(
        `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
         VALUES ($1, $2, 'DOCTOR', $3, $4, $5, true)`,
        [doctorUserId, branchId, `trigger_doctor_${uuidv4().slice(0, 8)}@clinic.com`, `trigger_doctor_${uuidv4().slice(0, 8)}`, await bcrypt.hash('Doctor123!', 10)]
      );
      const doctorRes = await client.query(
        `INSERT INTO doctors (id, branch_id, user_id, full_name, specialization, license_number, is_available)
         VALUES (gen_random_uuid(), $1, $2, 'drg. Trigger Test', 'Sp.BM', $3, true)
         RETURNING id`,
        [branchId, doctorUserId, `LIC-${uuidv4().slice(0, 8)}`]
      );
      doctorId = doctorRes.rows[0].id;

      patientUserId = uuidv4();
      await client.query(
        `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
         VALUES ($1, $2, 'PATIENT', $3, $4, $5, true)`,
        [patientUserId, branchId, `trigger_patient_${uuidv4().slice(0, 8)}@test.com`, `trigger_patient_${uuidv4().slice(0, 8)}`, await bcrypt.hash('Patient123!', 10)]
      );
      const patientRes = await client.query(
        `INSERT INTO patients (id, branch_id, user_id, full_name, phone)
         VALUES (gen_random_uuid(), $1, $2, 'Trigger Patient', '08123456789')
         RETURNING id`,
        [branchId, patientUserId]
      );
      patientId = patientRes.rows[0].id;

      bookingId = uuidv4();
      await client.query(
        `INSERT INTO bookings (id, branch_id, patient_id, doctor_id, booking_date, booking_time, status, booking_code, dp_amount)
         VALUES ($1, $2, $3, $4, CURRENT_DATE, '09:00:00', 'PAYMENT_CONFIRMED', $5, 50000)`,
        [bookingId, branchId, patientId, doctorId, `TRIGGER-${uuidv4().slice(0, 6)}`]
      );

      const encRes = await client.query(
        `INSERT INTO encounters (id, branch_id, booking_id, doctor_id, patient_id, status, started_at, treatment)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'COMPLETED', NOW(), 'Scaling')
         RETURNING id`,
        [branchId, bookingId, doctorId, patientId]
      );
      encounterId = encRes.rows[0].id;

      invoiceNumber = `INV-TRIGGER-${uuidv4().slice(0, 6)}`;
      const invoiceRes = await client.query(
        `INSERT INTO invoices (id, branch_id, encounter_id, patient_id, booking_id, invoice_number, amount_due, amount_paid, paid_amount, payment_status, status)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 50000, 0, NULL, 'UNPAID', 'UNPAID')
         RETURNING id`,
        [branchId, encounterId, patientId, bookingId, invoiceNumber]
      );
      invoiceId = invoiceRes.rows[0].id;

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
      await client.query('DELETE FROM invoices WHERE id = $1', [invoiceId]);
      await client.query('DELETE FROM encounters WHERE id = $1', [encounterId]);
      await client.query('DELETE FROM bookings WHERE id = $1', [bookingId]);
      await client.query('DELETE FROM patients WHERE id = $1', [patientId]);
      await client.query('DELETE FROM doctors WHERE id = $1', [doctorId]);
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

  it('should automatically insert record into invoice_payments when invoice status changes', async () => {
    // 1. Pastikan belum ada record di invoice_payments untuk invoice ini
    const before = await pool.query(
      'SELECT * FROM invoice_payments WHERE invoice_id = $1',
      [invoiceId]
    );
    expect(before.rows.length).toBe(0);

    // 2. Update invoice status → PAID (ini akan trigger)
    await pool.query(
      `UPDATE invoices 
       SET status = 'PAID', 
           payment_status = 'PAID',
           paid_at = NOW(),
           paid_amount = 50000,
           payment_method = 'CASH'
       WHERE id = $1`,
      [invoiceId]
    );

    // 3. Verifikasi record di invoice_payments
    const after = await pool.query(
      'SELECT * FROM invoice_payments WHERE invoice_id = $1',
      [invoiceId]
    );
    expect(after.rows.length).toBe(1);
    expect(after.rows[0].status).toBe('PAID');
    expect(after.rows[0].amount).toBe('50000.00');
    expect(after.rows[0].payment_method).toBe('CASH');
    expect(after.rows[0].paid_at).not.toBeNull();

    // 4. Update status lagi → UNPAID (trigger akan insert lagi)
    await pool.query(
      `UPDATE invoices 
       SET status = 'UNPAID', 
           payment_status = 'UNPAID',
           paid_at = NULL,
           paid_amount = NULL
       WHERE id = $1`,
      [invoiceId]
    );

    const afterUndo = await pool.query(
      'SELECT * FROM invoice_payments WHERE invoice_id = $1 ORDER BY paid_at DESC',
      [invoiceId]
    );
    expect(afterUndo.rows.length).toBe(2);
    expect(afterUndo.rows[0].status).toBe('UNPAID');
  });
});
