import request from 'supertest';
import { app } from '../../src/index';
import { Pool } from 'pg';
import { config } from '../../src/config';
import { PasswordService } from '../../src/utils/password.utils';
import { v4 as uuidv4 } from 'uuid';

describe('Walk-In Booking E2E Integration Tests', () => {
  let pool: Pool;

  const branchId = uuidv4();
  const adminUserId = uuidv4();
  const doctorUserId = uuidv4();

  const adminUsername = `walkadmin_${Date.now()}`;
  const doctorUsername = `walkdoc_${Date.now()}`;
  const doctorFullName = 'Walk-In Test Doctor';

  let scheduleIdMorning: string;
  let scheduleIdAfternoon: string;

  let adminToken: string;
  let doctorToken: string;

  let tempId1: string;
  let tempId2: string;
  let bookingId1: string;
  let bookingId2: string;
  let queueNumber1: number;
  let queueNumber2: number;

  let convertedUserId: string;
  let convertedPatientRecordId: string;
  let convertedToken: string;

  const localDateStr = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: config.database.url });

    const branchRes = await pool.query(
      `INSERT INTO branches (id, name, address) VALUES ($1, $2, $3) RETURNING id`,
      [branchId, 'Walk-In E2E Branch', 'Test Address']
    );
    expect(branchRes.rows[0].id).toBe(branchId);

    const adminPassword = await PasswordService.hashPassword('Admin123!');
    await pool.query(
      `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
       VALUES ($1, $2, 'ADMIN_BRANCH', $3, $4, $5, true)`,
      [adminUserId, branchId, `${adminUsername}@clinic.com`, adminUsername, adminPassword]
    );

    const doctorPassword = await PasswordService.hashPassword('Doctor123!');
    await pool.query(
      `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
       VALUES ($1, $2, 'DOCTOR', $3, $4, $5, true)`,
      [doctorUserId, branchId, `${doctorUsername}@clinic.com`, doctorUsername, doctorPassword]
    );

    await pool.query(
      `INSERT INTO doctors (id, branch_id, user_id, full_name, specialization, is_available)
       VALUES ($1, $2, $3, $4, $5, true)`,
      [uuidv4(), branchId, doctorUserId, doctorFullName, 'General']
    );

    const dayOfWeek = new Date().getDay();
    const morning = await pool.query(
      `INSERT INTO doctor_schedules (branch_id, dokter_id, day_of_week, session_start, session_end, max_patients_per_session, is_active)
       VALUES ($1, $2, $3, '09:00', '12:00', 4, true) RETURNING id`,
      [branchId, doctorUserId, dayOfWeek]
    );
    scheduleIdMorning = morning.rows[0].id;

    const afternoon = await pool.query(
      `INSERT INTO doctor_schedules (branch_id, dokter_id, day_of_week, session_start, session_end, max_patients_per_session, is_active)
       VALUES ($1, $2, $3, '13:00', '16:00', 4, true) RETURNING id`,
      [branchId, doctorUserId, dayOfWeek]
    );
    scheduleIdAfternoon = afternoon.rows[0].id;

    const adminLogin = await request(app)
      .post('/auth/admin/login')
      .send({ username: adminUsername, password: 'Admin123!' });
    expect(adminLogin.status).toBe(200);
    adminToken = adminLogin.body.data.token;

    const doctorLogin = await request(app)
      .post('/auth/doctor/login')
      .send({ username: doctorUsername, password: 'Doctor123!' });
    expect(doctorLogin.status).toBe(200);
    doctorToken = doctorLogin.body.data.token;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM encounters WHERE branch_id = $1', [branchId]);
    await pool.query('DELETE FROM invoices WHERE branch_id = $1', [branchId]);
    await pool.query('DELETE FROM payments WHERE branch_id = $1', [branchId]);
    await pool.query('DELETE FROM bookings WHERE branch_id = $1', [branchId]);
    await pool.query('DELETE FROM queues WHERE branch_id = $1', [branchId]);
    await pool.query('DELETE FROM patients WHERE branch_id = $1', [branchId]);
    await pool.query('DELETE FROM temporary_patients WHERE branch_id = $1', [branchId]);
    await pool.query('DELETE FROM doctor_schedules WHERE branch_id = $1', [branchId]);
    await pool.query('DELETE FROM doctor_leaves WHERE branch_id = $1', [branchId]);
    await pool.query('DELETE FROM doctors WHERE branch_id = $1', [branchId]);
    await pool.query('DELETE FROM users WHERE branch_id = $1', [branchId]);
    await pool.query('DELETE FROM invoice_sequences WHERE branch_id = $1', [branchId]);
    // audit_logs IMMUTABLE (append-only): DELETE ditolak oleh trigger -> best-effort
    try {
      await pool.query('DELETE FROM audit_logs WHERE branch_id = $1', [branchId]);
    } catch (error) {
      console.error('Cleanup audit_logs skipped (immutable):', (error as Error).message);
    }
    // Branch tidak bisa dihapus selama masih direferensikan audit_logs (FK RESTRICT)
    try {
      await pool.query('DELETE FROM branches WHERE id = $1', [branchId]);
    } catch (error) {
      console.error('Cleanup branch skipped (audit FK RESTRICT):', (error as Error).message);
    }
    await pool.end();
  });

  it('1. creates a temporary walk-in profile', async () => {
    const res = await request(app)
      .post('/walk-in/create-profile')
      .send({
        fullName: 'Walk-In Patient A',
        phone: '08110000001',
        branchId,
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tempPatientId).toBeDefined();
    tempId1 = res.body.data.tempPatientId;

    const res2 = await request(app)
      .post('/walk-in/create-profile')
      .send({
        fullName: 'Walk-In Patient B',
        phone: '08110000002',
        branchId,
      });
    expect(res2.status).toBe(201);
    tempId2 = res2.body.data.tempPatientId;
  });

  it('2. books two walk-in appointments on different slots', async () => {
    const dateStr = localDateStr();

    const res1 = await request(app)
      .post('/walk-in/book-appointment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        tempPatientId: tempId1,
        doctorId: doctorUserId,
        branchId,
        sessionSlotId: scheduleIdMorning,
        bookingDate: dateStr,
      });
    expect(res1.status).toBe(201);
    expect(res1.body.success).toBe(true);
    expect(res1.body.data.bookingId).toBeDefined();
    expect(res1.body.data.queueNumber).toBeGreaterThan(0);
    bookingId1 = res1.body.data.bookingId;
    queueNumber1 = res1.body.data.queueNumber;

    const res2 = await request(app)
      .post('/walk-in/book-appointment')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        tempPatientId: tempId2,
        doctorId: doctorUserId,
        branchId,
        sessionSlotId: scheduleIdAfternoon,
        bookingDate: dateStr,
      });
    expect(res2.status).toBe(201);
    expect(res2.body.data.bookingId).toBeDefined();
    bookingId2 = res2.body.data.bookingId;
    queueNumber2 = res2.body.data.queueNumber;

    expect(queueNumber1).not.toBe(queueNumber2);
  });

  it('3. shows walk-in patients in doctor queue-today with isWalkIn badge', async () => {
    const res = await request(app)
      .get(`/api/doctors/${doctorUserId}/queue-today`)
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const rows: any[] = res.body.data.data;
    const names = rows.map((r) => r.patientName);
    expect(names).toContain('Walk-In Patient A');
    expect(names).toContain('Walk-In Patient B');

    const walkInRows = rows.filter((r) => r.patientName.startsWith('Walk-In Patient'));
    expect(walkInRows.length).toBe(2);
    for (const row of walkInRows) {
      expect(row.isWalkIn).toBe(true);
      expect(row.queueNumber).toBeGreaterThan(0);
    }
  });

  it('4. converts walk-in profile to a full patient account', async () => {
    const email = `walkconv_${Date.now()}@test.com`;
    const res = await request(app)
      .post('/walk-in/convert-to-patient')
      .send({
        tempPatientId: tempId1,
        email,
        password: 'WalkPass123!',
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.patientId).toBeDefined();
    expect(res.body.data.token).toBeDefined();
    convertedUserId = res.body.data.patientId;
    convertedToken = res.body.data.token;
  });

  it('5. migrates walk-in booking to the new patient record and updates temp marker', async () => {
    const patientRes = await pool.query(
      `SELECT id FROM patients WHERE user_id = $1`,
      [convertedUserId]
    );
    expect(patientRes.rows.length).toBe(1);
    convertedPatientRecordId = patientRes.rows[0].id;

    const bookingRes = await pool.query(
      `SELECT patient_id, temp_patient_id, is_walk_in
       FROM bookings WHERE id = $1`,
      [bookingId1]
    );
    expect(bookingRes.rows[0].patient_id).toBe(convertedPatientRecordId);
    expect(bookingRes.rows[0].temp_patient_id).toBeNull();
    expect(bookingRes.rows[0].is_walk_in).toBe(true);

    const queueRes = await pool.query(
      `SELECT queue_number, status, doctor_id
       FROM queues WHERE booking_id = $1`,
      [bookingId1]
    );
    expect(queueRes.rows.length).toBe(1);
    expect(Number(queueRes.rows[0].queue_number)).toBe(queueNumber1);
    expect(queueRes.rows[0].status).toBe('WAITING');

    const tempRes = await pool.query(
      `SELECT converted_to_patient_id FROM temporary_patients WHERE id = $1`,
      [tempId1]
    );
    expect(tempRes.rows[0].converted_to_patient_id).toBe(convertedUserId);

    const patientLink = await pool.query(
      `SELECT walk_in_profile_id FROM patients WHERE id = $1`,
      [convertedPatientRecordId]
    );
    expect(patientLink.rows[0].walk_in_profile_id).toBe(tempId1);
  });

  it('6. rejects double conversion of the same temp profile', async () => {
    const res = await request(app)
      .post('/walk-in/convert-to-patient')
      .send({
        tempPatientId: tempId1,
        email: 'duplicate@test.com',
        password: 'WalkPass123!',
      });
    expect(res.status).toBe(409);
  });

  it('7. leaves no orphaned records and allows encounter after conversion', async () => {
    const unconvertedRes = await pool.query(
      `SELECT patient_id, temp_patient_id FROM bookings WHERE id = $1`,
      [bookingId2]
    );
    expect(unconvertedRes.rows[0].patient_id).toBeNull();
    expect(unconvertedRes.rows[0].temp_patient_id).toBe(tempId2);

    const noOrphanBookings = await pool.query(
      `SELECT COUNT(*)::int as c FROM bookings
       WHERE temp_patient_id = $1 AND patient_id IS NULL`,
      [tempId1]
    );
    expect(noOrphanBookings.rows[0].c).toBe(0);

    const noNullEncounters = await pool.query(
      `SELECT COUNT(*)::int as c FROM encounters
       WHERE booking_id IN ($1, $2) AND patient_id IS NULL`,
      [bookingId1, bookingId2]
    );
    expect(noNullEncounters.rows[0].c).toBe(0);

    const encounterRes = await request(app)
      .post('/api/encounters')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        bookingId: bookingId1,
        complaint: 'Toothache',
        diagnosis: 'Caries',
      });
    expect(encounterRes.status).toBe(201);

    const encounterCheck = await pool.query(
      `SELECT patient_id FROM encounters WHERE booking_id = $1`,
      [bookingId1]
    );
    expect(encounterCheck.rows.length).toBe(1);
    expect(encounterCheck.rows[0].patient_id).toBe(convertedPatientRecordId);
  });

  it('8. exposes migrated booking + encounter in patient history', async () => {
    const res = await request(app)
      .get(`/api/patients/${convertedPatientRecordId}/history?branchId=${branchId}`)
      .set('Authorization', `Bearer ${convertedToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.bookings.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.encounters.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.bookings.some((b: any) => b.id === bookingId1)).toBe(true);
  });
});