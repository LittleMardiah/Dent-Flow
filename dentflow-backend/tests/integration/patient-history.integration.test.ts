// 🔥 SET ENV SEBELUM IMPORT APP
process.env.MIDTRANS_SERVER_KEY = 'test-key';

import { app } from "../../src/index";
import request from 'supertest';
import { pool } from '../../src/config/database';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

describe('Patient History Endpoints', () => {
  let branchId: string;
  let patientUserId: string;
  let patientId: string;
  let patientUsername: string;
  let patientToken: string;
  let doctorUserId: string;
  let doctorUsername: string;
  let doctorToken: string;
  let adminUserId: string;
  let adminUsername: string;
  let adminToken: string;
  let bookingId: string;
  let encounterId: string;

  beforeAll(async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Branch
      const branchRes = await client.query(
        `INSERT INTO branches (id, name, phone, address, is_active)
         VALUES (gen_random_uuid(), 'Test Branch', '021-1234567', 'Jl. Test', true)
         RETURNING id`
      );
      branchId = branchRes.rows[0].id;

      // 2. Patient user
      patientUserId = uuidv4();
      patientUsername = `history_patient_${uuidv4().slice(0, 8)}`;
      await client.query(
        `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
         VALUES ($1, $2, 'PATIENT', $3, $4, $5, true)`,
        [patientUserId, branchId, `${patientUsername}@test.com`, patientUsername, await bcrypt.hash('Patient123!', 10)]
      );
      const patientRes = await client.query(
        `INSERT INTO patients (id, branch_id, user_id, full_name, phone)
         VALUES (gen_random_uuid(), $1, $2, 'Test Patient', '08123456789')
         RETURNING id`,
        [branchId, patientUserId]
      );
      patientId = patientRes.rows[0].id;

      // 3. Doctor user
      doctorUserId = uuidv4();
      doctorUsername = `history_doctor_${uuidv4().slice(0, 8)}`;
      await client.query(
        `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
         VALUES ($1, $2, 'DOCTOR', $3, $4, $5, true)`,
        [doctorUserId, branchId, `${doctorUsername}@clinic.com`, doctorUsername, await bcrypt.hash('Doctor123!', 10)]
      );
      const doctorRes = await client.query(
        `INSERT INTO doctors (id, branch_id, user_id, full_name, specialization, license_number, is_available)
         VALUES (gen_random_uuid(), $1, $2, 'drg. Test', 'Sp.BM', $3, true)
         RETURNING id`,
        [branchId, doctorUserId, `LIC-${uuidv4().slice(0, 8)}`]
      );
      const doctorId = doctorRes.rows[0].id;

      // 4. Admin user
      adminUserId = uuidv4();
      adminUsername = `history_admin_${uuidv4().slice(0, 8)}`;
      await client.query(
        `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
         VALUES ($1, $2, 'ADMIN_BRANCH', $3, $4, $5, true)`,
        [adminUserId, branchId, `${adminUsername}@clinic.com`, adminUsername, await bcrypt.hash('Admin123!', 10)]
      );

      // 5. Booking
      bookingId = uuidv4();
      await client.query(
        `INSERT INTO bookings (id, branch_id, patient_id, doctor_id, booking_date, booking_time, status, booking_code)
         VALUES ($1, $2, $3, $4, CURRENT_DATE, '09:00:00', 'COMPLETED', $5)`,
        [bookingId, branchId, patientId, doctorId, `HIST-${uuidv4().slice(0, 6)}`]
      );

      // 6. Encounter
      const encRes = await client.query(
        `INSERT INTO encounters (id, branch_id, booking_id, doctor_id, patient_id, status, started_at, treatment, diagnosis)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'COMPLETED', NOW(), 'Scaling', 'Tartar buildup')
         RETURNING id`,
        [branchId, bookingId, doctorId, patientId]
      );
      encounterId = encRes.rows[0].id;

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Setup failed:', error);
      throw error;
    } finally {
      client.release();
    }

    // Login patient
    const patientLogin = await request(app)
      .post('/auth/patient/login')
      .send({ username: patientUsername, password: 'Patient123!' });
    patientToken = patientLogin.body.data.token;

    // Login doctor
    const doctorLogin = await request(app)
      .post('/auth/doctor/login')
      .send({ username: doctorUsername, password: 'Doctor123!' });
    doctorToken = doctorLogin.body.data.token;

    // Login admin
    const adminLogin = await request(app)
      .post('/auth/admin/login')
      .send({ username: adminUsername, password: 'Admin123!' });
    adminToken = adminLogin.body.data.token;
  });

  afterAll(async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
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
      console.error('Cleanup failed:', error);
    } finally {
      client.release();
      await pool.end();
    }
  });

  // ============================================================
  // TEST 1: Unauthenticated
  // ============================================================
  it('should return 401 for unauthenticated request', async () => {
    const res = await request(app)
      .get(`/api/patients/${patientId}/history`)
      .query({ branchId });
    expect(res.status).toBe(401);
  });

  // ============================================================
  // TEST 2: Patient own history
  // ============================================================
  it('should return patient history for patient themselves (200)', async () => {
    const res = await request(app)
      .get(`/api/patients/${patientId}/history`)
      .query({ branchId })
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('encounters');
    expect(res.body.data).toHaveProperty('invoices');
    expect(res.body.data).toHaveProperty('bookings');
    expect(Array.isArray(res.body.data.encounters)).toBe(true);
    expect(res.body.data.encounters.length).toBeGreaterThanOrEqual(1);
    // Diagnosis should be hidden for patient
    const encounter = res.body.data.encounters[0];
    expect(encounter.diagnosis).toBeUndefined();
  });

  // ============================================================
  // TEST 3: Patient access other patient
  // ============================================================
  it('should return 403 for patient trying to access other patient\'s history', async () => {
    const otherPatientId = uuidv4();
    const res = await request(app)
      .get(`/api/patients/${otherPatientId}/history`)
      .query({ branchId })
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(403);
  });

  // ============================================================
  // TEST 4: Doctor access history
  // ============================================================
  it('should return patient history for doctor (200)', async () => {
    const res = await request(app)
      .get(`/api/patients/${patientId}/history`)
      .query({ branchId })
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.encounters)).toBe(true);
    // Doctor should see diagnosis
    const encounter = res.body.data.encounters[0];
    expect(encounter.diagnosis).toBe('Tartar buildup');
  });

  // ============================================================
  // TEST 5: Admin access history
  // ============================================================
  it('should return patient history for admin (200)', async () => {
    const res = await request(app)
      .get(`/api/patients/${patientId}/history`)
      .query({ branchId })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.encounters)).toBe(true);
  });

  // ============================================================
  // TEST 6: Patient access medical records (FORBIDDEN)
  // ============================================================
  it('should return 403 for patient trying to access medical records', async () => {
    const res = await request(app)
      .get(`/api/patients/${patientId}/medical-records`)
      .query({ branchId })
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(403);
  });

  // ============================================================
  // TEST 7: Admin access medical records (FORBIDDEN)
  // ============================================================
  it('should return 403 for admin trying to access medical records', async () => {
    const res = await request(app)
      .get(`/api/patients/${patientId}/medical-records`)
      .query({ branchId })
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  // ============================================================
  // TEST 8: Doctor access medical records (200)
  // ============================================================
  it('should return medical records for doctor (200)', async () => {
    const res = await request(app)
      .get(`/api/patients/${patientId}/medical-records`)
      .query({ branchId })
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    const record = res.body.data[0];
    expect(record).toHaveProperty('diagnosis');
    expect(record.diagnosis).toBe('Tartar buildup');
  });

  // ============================================================
  // TEST 9: Branch isolation
  // ============================================================
  it('should return 403 when trying to access patient from different branch', async () => {
    const otherBranchRes = await pool.query(
      `INSERT INTO branches (id, name, phone, address, is_active)
       VALUES (gen_random_uuid(), 'Other Branch', '021-1234567', 'Jl. Other', true)
       RETURNING id`
    );
    const otherBranchId = otherBranchRes.rows[0].id;

    const otherPatientUserId = uuidv4();
    await pool.query(
      `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
       VALUES ($1, $2, 'PATIENT', $3, $4, $5, true)`,
      [otherPatientUserId, otherBranchId, `other_patient_${uuidv4().slice(0, 8)}@test.com`, `other_patient_${uuidv4().slice(0, 8)}`, await bcrypt.hash('Other123!', 10)]
    );
    const otherPatientRes = await pool.query(
      `INSERT INTO patients (id, branch_id, user_id, full_name, phone)
       VALUES (gen_random_uuid(), $1, $2, 'Other Patient', '08123456789')
       RETURNING id`,
      [otherBranchId, otherPatientUserId]
    );
    const otherPatientId = otherPatientRes.rows[0].id;

    // Admin dari branch utama mencoba akses patient branch lain
    const res = await request(app)
      .get(`/api/patients/${otherPatientId}/history`)
      .query({ branchId: otherBranchId })
      .set('Authorization', `Bearer ${adminToken}`);
    // Admin hanya bisa akses branchnya sendiri
    expect(res.status).toBe(403);

    await pool.query('DELETE FROM patients WHERE branch_id = $1', [otherBranchId]);
    await pool.query('DELETE FROM users WHERE branch_id = $1', [otherBranchId]);
    await pool.query('DELETE FROM branches WHERE id = $1', [otherBranchId]);
  });
});
