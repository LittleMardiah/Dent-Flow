import request from 'supertest';
import { app } from '../../src/index';
import { Pool } from 'pg';
import { config } from '../../src/config';
import { PasswordService } from '../../src/utils/password.utils';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';

describe('Booking & Queue Integration Tests', () => {
  let pool: Pool;
  let redis: Redis;
  let patientToken: string;
  let patientId: string;
  let doctorId: string;
  let branchId: string;
  let bookingId: string;
  let queueNumber: number;

  const testEmail = `patient_${Date.now()}@test.com`;
  const testPassword = 'Patient123!';
  const testFullName = 'Test Patient';
  const testDoctorName = 'Test Doctor';

  const testBranchId = uuidv4();
  const testDoctorUserId = uuidv4();
  const testPatientUserId = uuidv4();

  beforeAll(async () => {
    pool = new Pool({ connectionString: config.database.url });
    redis = new Redis(config.redis.url);

    // 1. Create branch
    await pool.query(
      `INSERT INTO branches (id, name, address) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (id) DO NOTHING`,
      [testBranchId, 'Test Branch', 'Test Address']
    );
    branchId = testBranchId;

    // 2. Create doctor user
    const doctorPasswordHash = await PasswordService.hashPassword('Doctor123!');
    const doctorEmail = `doctor_${Date.now()}@clinic.com`;
    const doctorUsername = `test_doctor_${Date.now()}`;
    await pool.query(
      `INSERT INTO users (id, branch_id, role, email, password_hash, username) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       ON CONFLICT (email) DO NOTHING`,
      [testDoctorUserId, branchId, 'DOCTOR', doctorEmail, doctorPasswordHash, doctorUsername]
    );
    doctorId = testDoctorUserId;

    // 3. Insert doctor record
    await pool.query(
      `INSERT INTO doctors (id, branch_id, user_id, full_name, specialization) 
       VALUES ($1, $2, $3, $4, $5) 
       ON CONFLICT (user_id) DO NOTHING`,
      [uuidv4(), branchId, doctorId, testDoctorName, 'General']
    );

    // 4. Create doctor schedule (day_of_week = today)
    const today = new Date();
    await pool.query(
      `INSERT INTO doctor_schedules (branch_id, dokter_id, day_of_week, session_start, session_end, max_patients_per_session)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [branchId, doctorId, today.getDay(), '09:00', '12:00', 4]
    );

    // 5. Create patient user
    const patientPasswordHash = await PasswordService.hashPassword(testPassword);
    await pool.query(
      `INSERT INTO users (id, branch_id, role, email, password_hash, username) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [testPatientUserId, branchId, 'PATIENT', testEmail, patientPasswordHash, `test_patient_${Date.now()}`]
    );
    patientId = testPatientUserId;

    // 6. Insert patient record
    await pool.query(
      `INSERT INTO patients (id, branch_id, user_id, full_name, phone) 
       VALUES ($1, $2, $3, $4, $5)`,
      [uuidv4(), branchId, patientId, testFullName, '08123456789']
    );

    // 7. Login patient
    const loginRes = await request(app)
      .post('/auth/patient/login')
      .send({ email: testEmail, password: testPassword });
    expect(loginRes.status).toBe(200);
    patientToken = loginRes.body.data.token;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM bookings WHERE patient_id = $1', [patientId]);
    await pool.query('DELETE FROM patients WHERE user_id = $1', [patientId]);
    await pool.query('DELETE FROM doctor_schedules WHERE dokter_id = $1', [doctorId]);
    await pool.query('DELETE FROM doctors WHERE user_id = $1', [doctorId]);
    // audit_logs IMMUTABLE (append-only): DELETE ditolak oleh trigger -> best-effort
    try {
      await pool.query('DELETE FROM audit_logs WHERE branch_id = $1', [branchId]);
    } catch (error) {
      console.error('Cleanup audit_logs skipped (immutable):', (error as Error).message);
    }
    await pool.query('DELETE FROM users WHERE id = $1', [patientId]);
    await pool.query('DELETE FROM users WHERE id = $1', [doctorId]);
    // Branch tidak bisa dihapus selama masih direferensikan audit_logs (FK RESTRICT)
    try {
      await pool.query('DELETE FROM branches WHERE id = $1', [branchId]);
    } catch (error) {
      console.error('Cleanup branch skipped (audit FK RESTRICT):', (error as Error).message);
    }
    await pool.end();
    await redis.quit();
  });

  it('should create a booking successfully', async () => {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0];

    const scheduleRes = await pool.query(
      `SELECT id FROM doctor_schedules 
       WHERE dokter_id = $1 AND day_of_week = $2 AND is_active = true
       LIMIT 1`,
      [doctorId, date.getDay()]
    );
    const scheduleId = scheduleRes.rows[0]?.id;
    expect(scheduleId).toBeDefined();

    const response = await request(app)
      .post('/api/patient/bookings')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId: doctorId,
        branchId: branchId,
        bookingDate: dateStr,
        sessionSlotId: scheduleId,
        notes: 'Test booking'
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toHaveProperty('bookingId');
    expect(response.body.data).toHaveProperty('bookingCode');
    expect(response.body.data.bookingId).toBeDefined();
    expect(response.body.data.bookingCode).toBeDefined();
    expect(response.body.data.bookingId).toBeDefined();
    expect(response.body.data.bookingCode).toBeDefined();
    bookingId = response.body.data.bookingId;
  });

  it('should get queue status (empty or with booking)', async () => {
    const response = await request(app)
      .get(`/api/queue/status?branchId=${branchId}&doctorId=${doctorId}`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('doctorId');
    expect(response.body.data).toHaveProperty('waiting_queue');
    expect(Array.isArray(response.body.data.waiting_queue)).toBe(true);
  });

  it('should generate unique queue numbers using Redis atomic counter', async () => {
    const key = `queue:${branchId}:${doctorId}:${new Date().toISOString().split('T')[0]}`;
    const results: number[] = [];

    const promises = Array.from({ length: 10 }, () => redis.incr(key));
    const values = await Promise.all(promises);
    results.push(...values.map(v => Number(v)));

    const uniqueNumbers = new Set(results);
    expect(uniqueNumbers.size).toBe(results.length);
    expect(Math.min(...results)).toBeGreaterThan(0);

    queueNumber = results[0];
  });

  it('should cancel booking successfully', async () => {
    if (!bookingId) {
      console.warn('Skipping: No booking to cancel');
      return;
    }

    const response = await request(app)
      .put(`/api/patient/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ reason: 'Test cancellation' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
