import { PaymentInputService } from '../../../src/services/paymentInput.service';
import { pool } from '../../../src/config/database';
import { v4 as uuidv4 } from 'uuid';

describe('PaymentInputService', () => {
  let service: PaymentInputService;
  let testInvoiceId: string;
  let testInvoiceNumber: string;
  let testBookingId: string;
  let branchId: string;
  let doctorId: string;
  let patientId: string;

  beforeAll(async () => {
    service = new PaymentInputService();
    
    // 1. Buat branch
    const branchRes = await pool.query(
      `INSERT INTO branches (id, name, phone, address, is_active)
       VALUES (gen_random_uuid(), 'Test Branch', '021-1234567', 'Jl. Test', true)
       RETURNING id`
    );
    branchId = branchRes.rows[0].id;

    // 2. Buat user doctor
    const doctorUserId = uuidv4();
    await pool.query(
      `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
       VALUES ($1, $2, 'DOCTOR', $3, $4, 'testhash', true)`,
      [doctorUserId, branchId, `test_doctor_${uuidv4().slice(0, 8)}@clinic.com`, `test_doctor_${uuidv4().slice(0, 8)}`]
    );
    const doctorRes = await pool.query(
      `INSERT INTO doctors (id, branch_id, user_id, full_name, specialization, license_number, is_available)
       VALUES (gen_random_uuid(), $1, $2, 'drg. Test', 'Sp.BM', 'LIC-001', true)
       RETURNING id`,
      [branchId, doctorUserId]
    );
    doctorId = doctorRes.rows[0].id;

    // 3. Buat user patient
    const patientUserId = uuidv4();
    await pool.query(
      `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
       VALUES ($1, $2, 'PATIENT', $3, $4, 'testhash', true)`,
      [patientUserId, branchId, `test_patient_${uuidv4().slice(0, 8)}@test.com`, `test_patient_${uuidv4().slice(0, 8)}`]
    );
    const patientRes = await pool.query(
      `INSERT INTO patients (id, branch_id, user_id, full_name, phone)
       VALUES (gen_random_uuid(), $1, $2, 'Test Patient', '08123456789')
       RETURNING id`,
      [branchId, patientUserId]
    );
    patientId = patientRes.rows[0].id;

    // 4. Buat booking
    testBookingId = uuidv4();
    await pool.query(
      `INSERT INTO bookings (id, branch_id, patient_id, doctor_id, booking_date, booking_time, status, booking_code)
       VALUES ($1, $2, $3, $4, CURRENT_DATE, '09:00:00', 'PENDING_PAYMENT', $5)`,
      [testBookingId, branchId, patientId, doctorId, `BK-${uuidv4().slice(0, 6)}`]
    );

    // 5. Buat encounter
    const encRes = await pool.query(
      `INSERT INTO encounters (id, branch_id, booking_id, doctor_id, patient_id, status, started_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ONGOING', NOW())
       RETURNING id`,
      [branchId, testBookingId, doctorId, patientId]
    );
    const encounterId = encRes.rows[0].id;

    // 6. Buat invoice
    testInvoiceNumber = `INV-TEST-${Date.now()}-${uuidv4().slice(0, 4)}`;
    const res = await pool.query(
      `INSERT INTO invoices (id, branch_id, encounter_id, patient_id, invoice_number, booking_id, amount_due, amount_paid, paid_amount, payment_status, status)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 100000, 0, NULL, 'UNPAID', 'UNPAID')
       RETURNING id`,
      [branchId, encounterId, patientId, testInvoiceNumber, testBookingId]
    );
    testInvoiceId = res.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup data dengan urutan yang benar (mencegah FK violation)
    await pool.query('DELETE FROM invoices WHERE id = $1', [testInvoiceId]);
    await pool.query('DELETE FROM encounters WHERE branch_id = $1', [branchId]);
    await pool.query('DELETE FROM bookings WHERE branch_id = $1', [branchId]);
    await pool.query('DELETE FROM patients WHERE branch_id = $1', [branchId]);
    await pool.query('DELETE FROM doctors WHERE branch_id = $1', [branchId]);
    await pool.query('DELETE FROM users WHERE branch_id = $1', [branchId]);
    // Hapus audit_logs yang merujuk ke branch ini (mencegah FK violation)
    await pool.query('DELETE FROM audit_logs WHERE branch_id = $1', [branchId]);
    await pool.query('DELETE FROM branches WHERE id = $1', [branchId]);
    await pool.end();
  });

  // Helper reset invoice state dengan benar (update payment_status dan paid_amount juga)
  const resetInvoice = async () => {
    await pool.query(
      `UPDATE invoices 
       SET status = 'UNPAID', 
           payment_status = 'UNPAID',
           paid_at = NULL, 
           paid_amount = NULL,
           amount_paid = 0
       WHERE id = $1`,
      [testInvoiceId]
    );
  };

  it('should find invoice by invoice_number (INV-...)', async () => {
    await resetInvoice();
    
    const result = await service.processPaymentInput({
      order_id: testInvoiceNumber,
      gross_amount: 100000,
      payment_type: 'GATEWAY',
      status: 'capture',
      transaction_id: 'txn-001'
    }, 'webhook-001');
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.status).toBe('PAID');
  });

  it('should find invoice by booking_id (UUID fallback)', async () => {
    await resetInvoice();
    
    const result = await service.processPaymentInput({
      order_id: testBookingId,
      gross_amount: 100000,
      payment_type: 'GATEWAY',
      status: 'capture',
      transaction_id: 'txn-002'
    }, 'webhook-002');
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.status).toBe('PAID');
  });

  it('should find invoice by id (UUID invoice fallback - TD-PAY-016)', async () => {
    await resetInvoice();
    
    const result = await service.processPaymentInput({
      order_id: testInvoiceId,
      gross_amount: 100000,
      payment_type: 'GATEWAY',
      status: 'capture',
      transaction_id: 'txn-003'
    }, 'webhook-003');
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.status).toBe('PAID');
  });
});
