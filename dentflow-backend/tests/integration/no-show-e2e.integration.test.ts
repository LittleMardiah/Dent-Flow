import request from 'supertest';
import { app } from '../../src/index';
import { Pool } from 'pg';
import { config } from '../../src/config';
import { noShowDetectionJob } from '../../src/jobs/noShowDetection.job';
import { PasswordService } from '../../src/utils/password.utils';
import { v4 as uuidv4 } from 'uuid';

const pool = new Pool({ connectionString: config.database.url });

describe('NO-SHOW Detection E2E Integration Tests', () => {
  let branchId: string;
  let adminUserId: string;
  let patientUserId: string;
  let doctorUserId: string;
  let patientId: string;
  let doctorId: string;
  let adminToken: string;

  const adminUsername = `nsadmin_${Date.now()}`;
  const patientUsername = `nspatient_${Date.now()}`;
  const doctorUsername = `nsdoctor_${Date.now()}`;

  let bookingPastNoCheckIn: string;
  let bookingPastCheckedIn: string;
  let bookingFuture: string;
  let bookingAlreadyNoShow: string;

  const uniqueCode = () => `NS${Date.now().toString(36).slice(-6)}`;

  beforeAll(async () => {
    branchId = uuidv4();

    await pool.query(
      `INSERT INTO branches (id, name, phone, address) VALUES ($1, $2, $3, $4)`,
      [branchId, 'NO-SHOW E2E Branch', '081999999999', 'Jl. NO-SHOW Test 1']
    );

    const adminPassword = await PasswordService.hashPassword('AdminNs123!');
    const adminRes = await pool.query(
      `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
       VALUES ($1, $2, 'ADMIN_BRANCH', $3, $4, $5, true) RETURNING id`,
      [uuidv4(), branchId, `${adminUsername}@test.com`, adminUsername, adminPassword]
    );
    adminUserId = adminRes.rows[0].id;

    const patientPassword = await PasswordService.hashPassword('PatientNs123!');
    const patientUserRes = await pool.query(
      `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
       VALUES ($1, $2, 'PATIENT', $3, $4, $5, true) RETURNING id`,
      [uuidv4(), branchId, `${patientUsername}@test.com`, patientUsername, patientPassword]
    );
    patientUserId = patientUserRes.rows[0].id;

    const patientRes = await pool.query(
      `INSERT INTO patients (id, branch_id, user_id, full_name, phone)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [uuidv4(), branchId, patientUserId, 'NO-SHOW Test Patient', '081999999998']
    );
    patientId = patientRes.rows[0].id;

    const doctorPassword = await PasswordService.hashPassword('DoctorNs123!');
    const doctorUserRes = await pool.query(
      `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
       VALUES ($1, $2, 'DOCTOR', $3, $4, $5, true) RETURNING id`,
      [uuidv4(), branchId, `${doctorUsername}@test.com`, doctorUsername, doctorPassword]
    );
    doctorUserId = doctorUserRes.rows[0].id;

    const doctorRes = await pool.query(
      `INSERT INTO doctors (id, branch_id, user_id, full_name, specialization, license_number)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [uuidv4(), branchId, doctorUserId, 'NO-SHOW Test Doctor', 'General', `LIC-NS-${Date.now()}`]
    );
    doctorId = doctorRes.rows[0].id;

    const loginRes = await request(app)
      .post('/auth/admin/login')
      .send({ username: adminUsername, password: 'AdminNs123!' });
    adminToken = loginRes.body.data.token;

    // Booking A: PAST, no check-in → should be marked NO_SHOW
    const pastRes = await pool.query(
      `INSERT INTO bookings (
        id, branch_id, patient_id, doctor_id, booking_date, booking_time,
        status, booking_code, session_start, session_end, checked_in_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, (NOW() - INTERVAL '2 hours'), $10) RETURNING id`,
      [
        uuidv4(), branchId, patientId, doctorId,
        new Date(), '09:00', 'PAYMENT_CONFIRMED', uniqueCode(),
        new Date(), null,
      ]
    );
    bookingPastNoCheckIn = pastRes.rows[0].id;

    // Booking B: PAST, already checked in → should NOT be marked NO_SHOW
    const checkedInRes = await pool.query(
      `INSERT INTO bookings (
        id, branch_id, patient_id, doctor_id, booking_date, booking_time,
        status, booking_code, session_start, session_end, checked_in_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, (NOW() - INTERVAL '2 hours'), NOW() - INTERVAL '3 hours') RETURNING id`,
      [
        uuidv4(), branchId, patientId, doctorId,
        new Date(), '10:00', 'PAYMENT_CONFIRMED', uniqueCode(),
        new Date(),
      ]
    );
    bookingPastCheckedIn = checkedInRes.rows[0].id;

    // Booking C: FUTURE → should NOT be marked NO_SHOW
    const futureRes = await pool.query(
      `INSERT INTO bookings (
        id, branch_id, patient_id, doctor_id, booking_date, booking_time,
        status, booking_code, session_start, session_end, checked_in_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, (NOW() + INTERVAL '2 hours'), (NOW() + INTERVAL '3 hours'), $9) RETURNING id`,
      [
        uuidv4(), branchId, patientId, doctorId,
        new Date(), '14:00', 'PAYMENT_CONFIRMED', uniqueCode(),
        null,
      ]
    );
    bookingFuture = futureRes.rows[0].id;

    // Booking D: already NO_SHOW → should be idempotent (not double-marked)
    const alreadyNsRes = await pool.query(
      `INSERT INTO bookings (
        id, branch_id, patient_id, doctor_id, booking_date, booking_time,
        status, booking_code, session_start, session_end, checked_in_at, no_show_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'NO_SHOW', $7, $8, (NOW() - INTERVAL '5 hours'), $9, NOW() - INTERVAL '4 hours') RETURNING id`,
      [
        uuidv4(), branchId, patientId, doctorId,
        new Date(), '08:00', uniqueCode(),
        new Date(),
        null,
      ]
    );
    bookingAlreadyNoShow = alreadyNsRes.rows[0].id;
  });

  afterAll(async () => {
    try {
    const bookingIds = [bookingPastNoCheckIn, bookingPastCheckedIn, bookingFuture, bookingAlreadyNoShow].filter(Boolean);
    if (bookingIds.length > 0) {
      await pool.query(`DELETE FROM bookings WHERE id = ANY($1)`, [bookingIds]);
    }
    await pool.query(`DELETE FROM notifications WHERE patient_id IN ($1, $2)`, [patientUserId, adminUserId]);
    await pool.query(`DELETE FROM audit_logs WHERE branch_id = $1`, [branchId]);
    await pool.query(`DELETE FROM doctors WHERE id = $1`, [doctorId]);
    await pool.query(`DELETE FROM patients WHERE id = $1`, [patientId]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2, $3)`, [adminUserId, patientUserId, doctorUserId]);
    await pool.query(`DELETE FROM branches WHERE id = $1`, [branchId]);
    } catch (e) {
      console.error('Cleanup error:', e);
    }
    await pool.end();
  });

  it('1. Cron job detects past appointment without check-in → marks as NO_SHOW', async () => {
    await noShowDetectionJob.execute();

    const res = await pool.query(
      `SELECT status, no_show_at FROM bookings WHERE id = $1`,
      [bookingPastNoCheckIn]
    );
    expect(res.rows[0].status).toBe('NO_SHOW');
    expect(res.rows[0].no_show_at).not.toBeNull();
  });

  it('2. Already checked-in booking is NOT marked as NO_SHOW', async () => {
    const res = await pool.query(
      `SELECT status, no_show_at FROM bookings WHERE id = $1`,
      [bookingPastCheckedIn]
    );
    expect(res.rows[0].status).toBe('PAYMENT_CONFIRMED');
    expect(res.rows[0].no_show_at).toBeNull();
  });

  it('3. Future booking is NOT marked as NO_SHOW', async () => {
    const res = await pool.query(
      `SELECT status, no_show_at FROM bookings WHERE id = $1`,
      [bookingFuture]
    );
    expect(res.rows[0].status).toBe('PAYMENT_CONFIRMED');
    expect(res.rows[0].no_show_at).toBeNull();
  });

  it('4. Notification sent to patient & admin after NO-SHOW detection', async () => {
    const patientNotif = await pool.query(
      `SELECT * FROM notifications WHERE patient_id = $1 AND booking_id = $2`,
      [patientUserId, bookingPastNoCheckIn]
    );
    expect(patientNotif.rows.length).toBeGreaterThanOrEqual(1);

    const adminNotif = await pool.query(
      `SELECT * FROM notifications WHERE patient_id = $1 AND booking_id = $2`,
      [adminUserId, bookingPastNoCheckIn]
    );
    expect(adminNotif.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('5. Admin GET /api/admin/no-shows returns list of NO-SHOW bookings', async () => {
    const res = await request(app)
      .get(`/api/no-shows/admin/no-shows?branchId=${branchId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    const ns = res.body.data.find((b: any) => b.booking_id === bookingPastNoCheckIn);
    expect(ns).toBeDefined();
    expect(ns.status).toBe('NO_SHOW');
  });

  it('6. Admin GET /api/admin/no-shows returns 400 without branchId', async () => {
    const res = await request(app)
      .get('/api/no-shows/admin/no-shows')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('7. Admin manually marks booking as NO-SHOW (idempotent)', async () => {
    const bookingToMark = bookingFuture;

    const res1 = await request(app)
      .put(`/api/no-shows/admin/bookings/${bookingToMark}/mark-no-show`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res1.status).toBe(200);
    expect(res1.body.success).toBe(true);
    expect(res1.body.data.status).toBe('NO_SHOW');

    // Idempotent: calling again returns 200 with "already marked"
    const res2 = await request(app)
      .put(`/api/no-shows/admin/bookings/${bookingToMark}/mark-no-show`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res2.status).toBe(200);
    expect(res2.body.success).toBe(true);
  });

  it('8. Admin cannot manually mark CANCELLED/COMPLETED booking as NO-SHOW', async () => {
    const cancelledRes = await pool.query(
      `INSERT INTO bookings (
        id, branch_id, patient_id, doctor_id, booking_date, booking_time,
        status, booking_code, session_start, session_end
      ) VALUES ($1, $2, $3, $4, $5, $6, 'CANCELLED', $7, $8, (NOW() - INTERVAL '1 hour')) RETURNING id`,
      [
        uuidv4(), branchId, patientId, doctorId,
        new Date(), '11:00', uniqueCode(),
        new Date(),
      ]
    );
    const cancelledId = cancelledRes.rows[0].id;

    const res = await request(app)
      .put(`/api/no-shows/admin/bookings/${cancelledId}/mark-no-show`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);

    await pool.query(`DELETE FROM bookings WHERE id = $1`, [cancelledId]);
  });

  it('9. Manual NO-SHOW mark updates booking status to NO_SHOW', async () => {
    const markRes = await request(app)
      .put(`/api/no-shows/admin/bookings/${bookingPastCheckedIn}/mark-no-show`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(markRes.status).toBe(200);
    expect(markRes.body.success).toBe(true);
    expect(markRes.body.data.status).toBe('NO_SHOW');

    const dbRes = await pool.query(
      `SELECT status, no_show_at FROM bookings WHERE id = $1`,
      [bookingPastCheckedIn]
    );
    expect(dbRes.rows[0].status).toBe('NO_SHOW');
    expect(dbRes.rows[0].no_show_at).not.toBeNull();
  });

  it('10. Grace period configurable via env (default 15 min)', () => {
    expect(config.noShow.graceMinutes).toBe(15);
  });
});
