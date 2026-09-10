import { app } from "../../src/index";
import request from 'supertest';
import { pool } from '../../src/config/database';
import { PasswordService } from '../../src/utils/password.utils';
import { v4 as uuidv4 } from 'uuid';

describe('Audit Logs Integration Tests', () => {
  let adminToken: string;
  let branchId: string;
  let testBranchId: string;
  let testAdminUserId: string;
  let filterPatientUserId: string;
  let filterDoctorUserId: string;

  beforeAll(async () => {
    // 1. Create dynamic branch
    testBranchId = uuidv4();
    await pool.query(
      `INSERT INTO branches (id, name, address) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (id) DO NOTHING`,
      [testBranchId, 'Test Branch Audit', 'Jl. Test Audit']
    );
    branchId = testBranchId;

    // 2. Create dynamic admin user
    testAdminUserId = uuidv4();
    const adminUsername = `admin_audit_${Date.now()}`;
    const adminEmail = `${adminUsername}@clinic.com`;
    const adminPasswordHash = await PasswordService.hashPassword('Admin123!');
    
    await pool.query(
      `INSERT INTO users (id, branch_id, role, email, password_hash, username) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       ON CONFLICT (email) DO NOTHING`,
      [testAdminUserId, branchId, 'ADMIN_BRANCH', adminEmail, adminPasswordHash, adminUsername]
    );

    // 3. Login admin
    const loginRes = await request(app)
      .post('/auth/admin/login')
      .send({ username: adminUsername, password: 'Admin123!' });
    expect(loginRes.status).toBe(200);
    adminToken = loginRes.body.data.token;
    console.log('✅ Admin token:', adminToken);
  });

  afterAll(async () => {
    // audit_logs sekarang IMMUTABLE (append-only) — UPDATE/DELETE ditolak.
    // User masih bisa dihapus (FK audit_logs.user_id = ON DELETE SET NULL).
    // Branch tidak bisa dihapus selama masih direferensikan audit_logs (FK RESTRICT),
    // jadi penghapusannya di-best-effort (ignore error).
    try {
      if (filterPatientUserId) {
        await pool.query('DELETE FROM users WHERE id = $1', [filterPatientUserId]);
      }
      if (filterDoctorUserId) {
        await pool.query('DELETE FROM users WHERE id = $1', [filterDoctorUserId]);
      }
      await pool.query('DELETE FROM users WHERE id = $1', [testAdminUserId]);
    } catch (error) {
      console.error('Cleanup users failed:', (error as Error).message);
    }

    // Audit log & branch: biarkan tetap ada (immutable, FK RESTRICT).
    await pool.end();
  });

  it('should fetch audit logs with branchId (200)', async () => {
    const res = await request(app)
      .get(`/api/admin/audit-logs?branchId=${branchId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    console.log('🔍 RESPONSE:', JSON.stringify(res.body, null, 2));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should return 400 if branchId is missing', async () => {
    const res = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('branchId');
  });

  it('should return 401 for unauthenticated request', async () => {
    const res = await request(app)
      .get(`/api/admin/audit-logs?branchId=${branchId}`);

    expect(res.status).toBe(401);
  });

  it('should return 403 for non-admin user (patient)', async () => {
    const patientUserId = uuidv4();
    const patientEmail = `patient_audit_${Date.now()}@test.com`;
    const patientPasswordHash = await PasswordService.hashPassword('Patient123!');
    
    await pool.query(
      `INSERT INTO users (id, branch_id, role, email, password_hash, username) 
       VALUES ($1, $2, 'PATIENT', $3, $4, $5)`,
      [patientUserId, branchId, patientEmail, patientPasswordHash, `patient_audit_${Date.now()}`]
    );

    const loginRes = await request(app)
      .post('/auth/patient/login')
      .send({ email: patientEmail, password: 'Patient123!' });
    expect(loginRes.status).toBe(200);
    const patientToken = loginRes.body.data.token;

    const res = await request(app)
      .get(`/api/admin/audit-logs?branchId=${branchId}`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(403);

    // Cleanup patient user
    await pool.query('DELETE FROM users WHERE id = $1', [patientUserId]);
  });

  it('should filter audit logs by entityType and entityId', async () => {
    // Buat user dengan username dinamis
    filterPatientUserId = uuidv4();
    filterDoctorUserId = uuidv4();
    const patientEmail = `filter_patient_${Date.now()}@test.com`;
    const doctorEmail = `filter_doctor_${Date.now()}@clinic.com`;
    const patientUsername = `filter_patient_${Date.now()}`;
    const doctorUsername = `filter_doctor_${Date.now()}`;

    // Insert patient user
    await pool.query(
      `INSERT INTO users (id, branch_id, role, email, password_hash, username) 
       VALUES ($1, $2, 'PATIENT', $3, $4, $5)`,
      [filterPatientUserId, branchId, patientEmail, await PasswordService.hashPassword('Patient123!'), patientUsername]
    );
    const patientRec = await pool.query(
      `INSERT INTO patients (id, branch_id, user_id, full_name, phone) 
       VALUES ($1, $2, $3, 'Filter Patient', '08123456789') 
       RETURNING id`,
      [uuidv4(), branchId, filterPatientUserId]
    );
    const patientRecordId = patientRec.rows[0].id;

    // Insert doctor user
    await pool.query(
      `INSERT INTO users (id, branch_id, role, email, password_hash, username) 
       VALUES ($1, $2, 'DOCTOR', $3, $4, $5)`,
      [filterDoctorUserId, branchId, doctorEmail, await PasswordService.hashPassword('Doctor123!'), doctorUsername]
    );
    const doctorRec = await pool.query(
      `INSERT INTO doctors (id, branch_id, user_id, full_name, specialization) 
       VALUES ($1, $2, $3, 'Filter Doctor', 'General') 
       RETURNING id`,
      [uuidv4(), branchId, filterDoctorUserId]
    );
    const doctorRecordId = doctorRec.rows[0].id;

    // Create booking
    const bookingCode = uuidv4().substring(0, 8).toUpperCase();
    const bookingRes = await pool.query(
      `INSERT INTO bookings (id, branch_id, patient_id, doctor_id, booking_date, booking_time, status, booking_code, is_walk_in) 
       VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_DATE, '09:00:00', 'PAYMENT_CONFIRMED', $4, false) 
       RETURNING id`,
      [branchId, patientRecordId, doctorRecordId, bookingCode]
    );
    const bookingId = bookingRes.rows[0].id;

    // Query audit logs by entity
    const res = await request(app)
      .get(`/api/admin/audit-logs?branchId=${branchId}&entityType=BOOKING&entityId=${bookingId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
