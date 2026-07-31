import { app } from "../../src/index";
import request from 'supertest';
import { pool } from '../../src/config/database';
import { PasswordService } from '../../src/utils/password.utils';
import { v4 as uuidv4 } from 'uuid';

describe('DEBUG: Mark Invoice Paid', () => {
  let adminToken: string;
  let testInvoiceId: string;
  let branchId: string;
  let patientRecordId: string;
  let doctorRecordId: string;
  let bookingId: string;
  let encounterId: string;

  const testBranchId = uuidv4();
  const testAdminUserId = uuidv4();
  const testPatientUserId = uuidv4();
  const testDoctorUserId = uuidv4();

  beforeAll(async () => {
    // 1. Branch
    await pool.query(
      `INSERT INTO branches (id, name, address) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (id) DO NOTHING`,
      [testBranchId, 'Test Branch Invoice', 'Jl. Test Invoice']
    );
    branchId = testBranchId;

    // 2. Admin user
    const adminPasswordHash = await PasswordService.hashPassword('Admin123!');
    await pool.query(
      `INSERT INTO users (id, branch_id, role, email, password_hash, username) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       ON CONFLICT (email) DO NOTHING`,
      [testAdminUserId, branchId, 'ADMIN_BRANCH', `admin_${Date.now()}@clinic.com`, adminPasswordHash, `admin_${Date.now()}`]
    );

    // 3. Login admin
    const adminUserRes = await pool.query(
      `SELECT username FROM users WHERE id = $1`,
      [testAdminUserId]
    );
    const adminUsername = adminUserRes.rows[0].username;

    const loginRes = await request(app)
      .post('/auth/admin/login')
      .send({ username: adminUsername, password: 'Admin123!' });
    expect(loginRes.status).toBe(200);
    adminToken = loginRes.body.data.token;

    // 4. Patient user
    const patientPasswordHash = await PasswordService.hashPassword('Patient123!');
    await pool.query(
      `INSERT INTO users (id, branch_id, role, email, password_hash, username) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [testPatientUserId, branchId, 'PATIENT', `patient_${Date.now()}@test.com`, patientPasswordHash, `patient_${Date.now()}`]
    );

    // 5. Patient record
    const patientRes = await pool.query(
      `INSERT INTO patients (id, branch_id, user_id, full_name, phone) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      [uuidv4(), branchId, testPatientUserId, 'Test Patient Invoice', '08123456789']
    );
    patientRecordId = patientRes.rows[0].id;

    // 6. Doctor user
    const doctorPasswordHash = await PasswordService.hashPassword('Doctor123!');
    await pool.query(
      `INSERT INTO users (id, branch_id, role, email, password_hash, username) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       ON CONFLICT (email) DO NOTHING`,
      [testDoctorUserId, branchId, 'DOCTOR', `doctor_${Date.now()}@clinic.com`, doctorPasswordHash, `doctor_${Date.now()}`]
    );

    // 7. Doctor record
    const doctorRes = await pool.query(
      `INSERT INTO doctors (id, branch_id, user_id, full_name, specialization) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (user_id) DO NOTHING 
       RETURNING id`,
      [uuidv4(), branchId, testDoctorUserId, 'drg. Test Sp.BM', 'Sp.BM']
    );
    doctorRecordId = doctorRes.rows[0].id;

    // 8. Schedule
    const today = new Date();
    await pool.query(
      `INSERT INTO doctor_schedules (branch_id, dokter_id, day_of_week, session_start, session_end, max_patients_per_session)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [branchId, testDoctorUserId, today.getDay(), '09:00', '12:00', 4]
    );

    // 9. Booking
    const uniqueCode = uuidv4().substring(0, 8).toUpperCase();
    const bookingRes = await pool.query(
      `INSERT INTO bookings (id, branch_id, patient_id, doctor_id, booking_date, booking_time, status, booking_code, is_walk_in)
       VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_DATE, '09:00:00', 'PAYMENT_CONFIRMED', $4, false)
       RETURNING id`,
      [branchId, patientRecordId, doctorRecordId, uniqueCode]
    );
    bookingId = bookingRes.rows[0].id;

    // 10. Encounter
    const encRes = await pool.query(
      `INSERT INTO encounters (id, branch_id, booking_id, doctor_id, patient_id, status, started_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'COMPLETED', NOW())
       RETURNING id`,
      [branchId, bookingId, doctorRecordId, patientRecordId]
    );
    encounterId = encRes.rows[0].id;

    // 11. Invoice
    const invoiceRes = await pool.query(
      `INSERT INTO invoices (id, branch_id, encounter_id, patient_id, amount_due, amount_paid, status)
       VALUES (gen_random_uuid(), $1, $2, $3, 200000, 0, 'UNPAID')
       RETURNING id`,
      [branchId, encounterId, patientRecordId]
    );
    testInvoiceId = invoiceRes.rows[0].id;

    console.log('✅ Invoice created with ID:', testInvoiceId);
  });

  afterAll(async () => {
    if (testInvoiceId) {
      await pool.query('DELETE FROM invoices WHERE id = $1', [testInvoiceId]);
    }
    if (encounterId) {
      await pool.query('DELETE FROM encounters WHERE id = $1', [encounterId]);
    }
    if (bookingId) {
      await pool.query('DELETE FROM bookings WHERE id = $1', [bookingId]);
    }
    await pool.query('DELETE FROM doctor_schedules WHERE dokter_id = $1', [testDoctorUserId]);
    await pool.query('DELETE FROM doctors WHERE user_id = $1', [testDoctorUserId]);
    await pool.query('DELETE FROM patients WHERE user_id = $1', [testPatientUserId]);
    await pool.query('DELETE FROM audit_logs WHERE branch_id = $1', [branchId]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [testAdminUserId, testPatientUserId, testDoctorUserId]);
    await pool.query('DELETE FROM branches WHERE id = $1', [branchId]);
    await pool.end();
  });

  it('should mark invoice as paid (admin) - DEBUG', async () => {
    const payload = {
      payment_method: 'CASH',
      paid_amount: 200000,
      notes: 'Payment received',
    };
    console.log('📤 SENDING PAYLOAD:', JSON.stringify(payload, null, 2));

    const res = await request(app)
      .post(`/api/admin/invoices/${testInvoiceId}/mark-paid`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    console.log('📥 RESPONSE STATUS:', res.status);
    console.log('📥 RESPONSE BODY:', JSON.stringify(res.body, null, 2));

    // Assert untuk lihat apakah pass
    expect(res.status).toBe(200);
  });
});
