import { app } from "../../src/index";
import request from 'supertest';
import { pool } from '../../src/config/database';
import { PasswordService } from '../../src/utils/password.utils';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';

describe('E2E Booking Flow', () => {
  let adminToken: string;
  let patientToken: string;
  let doctorToken: string;
  let branchId: string;
  let patientId: string;
  let doctorId: string;
  let bookingId: string;
  let queueId: string;
  let encounterId: string;
  let invoiceId: string;
  let scheduleId: string;
  let adminUserId: string;
  let patientUserId: string;
  let doctorUserId: string;
  let patientRecordId: string;
  let doctorRecordId: string;

  const testBranchId = uuidv4();
  const adminUserUuid = uuidv4();
  const patientUserUuid = uuidv4();
  const doctorUserUuid = uuidv4();

  beforeAll(async () => {
    // Set mock date (soal validasi session)
    process.env.MOCK_DATE = '2026-08-10T09:30:00.000+07:00';

    // 1. Create branch
    await pool.query(
      `INSERT INTO branches (id, name, address) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (id) DO NOTHING`,
      [testBranchId, 'Cabang Test E2E', 'Jl. Test E2E']
    );
    branchId = testBranchId;

    // 2. Admin user
    const adminPassword = await PasswordService.hashPassword('Admin123!');
    await pool.query(
      `INSERT INTO users (id, branch_id, role, email, password_hash, username) 
       VALUES ($1, $2, 'ADMIN_BRANCH', $3, $4, $5)`,
      [adminUserUuid, branchId, 'admin_e2e@clinic.com', adminPassword, 'admin_e2e']
    );
    adminUserId = adminUserUuid;

    // 3. Patient user
    const patientPassword = await PasswordService.hashPassword('Patient123!');
    await pool.query(
      `INSERT INTO users (id, branch_id, role, email, password_hash, username) 
       VALUES ($1, $2, 'PATIENT', $3, $4, $5)`,
      [patientUserUuid, branchId, 'patient_e2e@test.com', patientPassword, 'patient_e2e']
    );
    patientUserId = patientUserUuid;

    // 4. Patient record
    const patRes = await pool.query(
      `INSERT INTO patients (id, branch_id, user_id, full_name, phone) 
       VALUES ($1, $2, $3, 'Patient E2E', '08123456789') 
       RETURNING id`,
      [uuidv4(), branchId, patientUserId]
    );
    patientRecordId = patRes.rows[0].id;
    patientId = patientUserId;

    // 5. Doctor user
    const doctorPassword = await PasswordService.hashPassword('Doctor123!');
    await pool.query(
      `INSERT INTO users (id, branch_id, role, email, password_hash, username) 
       VALUES ($1, $2, 'DOCTOR', $3, $4, $5)`,
      [doctorUserUuid, branchId, 'doctor_e2e@clinic.com', doctorPassword, 'doctor_e2e']
    );
    doctorUserId = doctorUserUuid;

    // 6. Doctor record
    const docRes = await pool.query(
      `INSERT INTO doctors (id, branch_id, user_id, full_name, specialization) 
       VALUES ($1, $2, $3, 'Doctor E2E', 'General') 
       RETURNING id`,
      [uuidv4(), branchId, doctorUserId]
    );
    doctorRecordId = docRes.rows[0].id;
    doctorId = doctorUserId;

    // 7. Doctor schedule (day_of_week = 1 = Monday, karena MOCK_DATE = 2026-08-10 adalah Monday)
    const scheduleRes = await pool.query(
      `INSERT INTO doctor_schedules (branch_id, dokter_id, day_of_week, session_start, session_end, max_patients_per_session)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [branchId, doctorUserId, 1, '09:00', '12:00', 4]
    );
    scheduleId = scheduleRes.rows[0].id;

    // 8. Login as admin
    const loginAdmin = await request(app)
      .post('/auth/admin/login')
      .send({ username: 'admin_e2e', password: 'Admin123!' });
    expect(loginAdmin.status).toBe(200);
    adminToken = loginAdmin.body.data.token;

    // 9. Login as patient
    const loginPatient = await request(app)
      .post('/auth/patient/login')
      .send({ email: 'patient_e2e@test.com', password: 'Patient123!' });
    expect(loginPatient.status).toBe(200);
    patientToken = loginPatient.body.data.token;

    // 10. Login as doctor
    const loginDoctor = await request(app)
      .post('/auth/doctor/login')
      .send({ username: 'doctor_e2e', password: 'Doctor123!' });
    expect(loginDoctor.status).toBe(200);
    doctorToken = loginDoctor.body.data.token;
  });

  afterAll(async () => {
    // Cleanup
    await pool.query('DELETE FROM bookings WHERE patient_id = $1', [patientRecordId]);
    await pool.query('DELETE FROM queues WHERE booking_id IN (SELECT id FROM bookings WHERE patient_id = $1)', [patientRecordId]);
    await pool.query('DELETE FROM encounters WHERE patient_id = $1', [patientRecordId]);
    await pool.query('DELETE FROM invoices WHERE patient_id = $1', [patientRecordId]);
    await pool.query('DELETE FROM patients WHERE id = $1', [patientRecordId]);
    await pool.query('DELETE FROM doctors WHERE id = $1', [doctorRecordId]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [adminUserId, patientUserId, doctorUserId]);
    await pool.query('DELETE FROM branches WHERE id = $1', [branchId]);
    await pool.end();
  });

  // ============================================================
  // TEST 1: Get doctor availability
  // ============================================================
  it('1. Get doctor availability', async () => {
    const res = await request(app)
      .get(`/api/doctors/${doctorId}/availability?date=2026-08-10&branchId=${branchId}`)
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('slots');
  });

  // ============================================================
  // TEST 2: Create booking
  // ============================================================
  it('2. Create booking', async () => {
    const res = await request(app)
      .post('/api/patient/bookings')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId: doctorId,
        branchId: branchId,
        bookingDate: '2026-08-10',
        sessionSlotId: scheduleId,
        notes: 'E2E test booking',
      });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('bookingId');
    bookingId = res.body.data.bookingId;
  });

  // ============================================================
  // TEST 3: List patient bookings
  // ============================================================
  it('3. List patient bookings', async () => {
    const res = await request(app)
      .get('/api/patient/bookings')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // ============================================================
  // TEST 4: Admin checks-in patient (AKTIF)
  // ============================================================
  it('4. Admin checks-in patient (mock date)', async () => {
    // Pastikan booking status PAYMENT_CONFIRMED dulu (kita set langsung)
    await pool.query(
      `UPDATE bookings SET status = 'PAYMENT_CONFIRMED' WHERE id = $1`,
      [bookingId]
    );
    const res = await request(app)
      .post('/api/admin/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        checkInCode: bookingId, // atau bisa pake kode booking, tapi kita simpen sementara
        branchId: branchId,
      });
    // Karena kita pake bookingId sebagai checkInCode (tidak sesuai), mungkin error, tapi kita adjust
    // Di implementasi asli check-in pake kode booking 6 digit. Kita perlu generate kode booking.
    // Tapi untuk test, kita akan pake booking_code yang ada di DB.
    const bookingData = await pool.query(
      `SELECT booking_code FROM bookings WHERE id = $1`,
      [bookingId]
    );
    const checkInCode = bookingData.rows[0]?.booking_code;
    expect(checkInCode).toBeDefined();

    const checkinRes = await request(app)
      .post('/api/admin/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        checkInCode: checkInCode,
        branchId: branchId,
      });
    expect(checkinRes.status).toBe(200);
    expect(checkinRes.body.data).toHaveProperty('queueNumber');
    queueId = checkinRes.body.data.queueId;
  });

  // ============================================================
  // TEST 5: Get queue status (AKTIF)
  // ============================================================
  it('5. Get queue status', async () => {
    const res = await request(app)
      .get(`/api/queue/status?branchId=${branchId}&doctorId=${doctorId}`)
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('waitingQueue');
    expect(Array.isArray(res.body.data.waitingQueue)).toBe(true);
  });

  // ============================================================
  // TEST 6: Doctor starts encounter
  // ============================================================
  it('6. Doctor starts encounter', async () => {
    const res = await request(app)
      .post('/api/encounters')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        bookingId: bookingId,
        branchId: branchId,
      });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('encounterId');
    encounterId = res.body.data.encounterId;
  });

  // ============================================================
  // TEST 7: Doctor records diagnosis
  // ============================================================
  it('7. Doctor records diagnosis', async () => {
    const res = await request(app)
      .put(`/api/encounters/${encounterId}`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        diagnosis: 'Karies gigi',
        icd10Code: 'K02.9',
        treatment: 'Filling',
        notes: 'Test E2E',
      });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('status', 'ONGOING');
  });

  // ============================================================
  // TEST 8: Doctor completes encounter → invoice auto-generated
  // ============================================================
  it('8. Doctor completes encounter → invoice auto-generated', async () => {
    const res = await request(app)
      .post(`/api/encounters/${encounterId}/complete`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('invoiceId');
    invoiceId = res.body.data.invoiceId;
  });

  // ============================================================
  // TEST 9: Admin marks invoice as paid
  // ============================================================
  it('9. Admin marks invoice as paid', async () => {
    const res = await request(app)
      .post(`/api/admin/invoices/${invoiceId}/mark-paid`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        payment_method: 'CASH',
        paid_amount: 200000,
        notes: 'Paid by admin',
      });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PAID');
  });

  // ============================================================
  // TEST 10: Get invoice detail
  // ============================================================
  it('10. Get invoice detail', async () => {
    const res = await request(app)
      .get(`/api/admin/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('id', invoiceId);
    expect(res.body.data).toHaveProperty('status', 'PAID');
  });

  // ============================================================
  // TEST 11: Admin creates walk-in patient
  // ============================================================
  it('11. Admin creates walk-in patient', async () => {
    const res = await request(app)
      .post('/api/admin/walk-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Walk-in E2E',
        phone: '08123456790',
        branchId: branchId,
        doctorId: doctorId,
      });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('queueNumber');
  });

  // ============================================================
  // TEST 12: Multi-tenant isolation
  // ============================================================
  it('12. Admin from Branch A cannot access Branch B booking', async () => {
    // Buat branch lain
    const branchBId = uuidv4();
    await pool.query(
      `INSERT INTO branches (id, name, address) VALUES ($1, 'Cabang B E2E', 'Jl. Test B')`,
      [branchBId]
    );
    // Buat booking di branch B (pakai doctor yang sama)
    const bookingBRes = await pool.query(
      `INSERT INTO bookings (id, branch_id, patient_id, doctor_id, booking_date, booking_time, status, booking_code, is_walk_in)
       VALUES (gen_random_uuid(), $1, $2, $3, '2026-08-10', '09:00:00', 'PAYMENT_CONFIRMED', 'BCODE', false)
       RETURNING id`,
      [branchBId, patientRecordId, doctorRecordId]
    );
    const bookingBId = bookingBRes.rows[0].id;

    // Admin cabang A mencoba akses booking cabang B
    const res = await request(app)
      .get(`/api/admin/bookings/${bookingBId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);

    // Cleanup
    await pool.query('DELETE FROM bookings WHERE id = $1', [bookingBId]);
    await pool.query('DELETE FROM branches WHERE id = $1', [branchBId]);
  });
});
