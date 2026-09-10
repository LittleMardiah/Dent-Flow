import { app } from "../../src/index";
import request from 'supertest';
import { pool } from '../../src/config/database';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

/**
 * Task 5.1.2 — Integration test untuk Doctor EMR Workflow.
 * Coverage:
 *  - startEncounter  -> status ONGOING
 *  - completeEncounter -> invoice auto-generated
 *  - queue status berubah WAITING -> COMPLETED
 *  - audit log tercatat (ENCOUNTER_STARTED, ENCOUNTER_COMPLETED)
 *  - validasi error: complaint/treatment kosong -> 400
 *  - edge: duplicate startEncounter -> idempotent (tetap 1 baris)
 */
describe('Doctor EMR Workflow Integration', () => {
  let branchId: string;
  let doctorRecordId: string;
  let doctorUserId: string;
  let doctorUsername: string;
  let patientRecordId: string;
  let patientUserId: string;
  let bookingId1: string;
  let queueId1: string;
  let bookingId2: string;
  let queueId2: string;
  let encounterId: string;
  let doctorToken: string;

  beforeAll(async () => {
    // 1. Branch
    const branchRes = await pool.query(
      `INSERT INTO branches (id, name, phone, address, is_active)
       VALUES (gen_random_uuid(), 'Cabang EMR Test', '021-9876543', 'Jl. EMR Test', true)
       RETURNING id`
    );
    branchId = branchRes.rows[0].id;

    // 2. Doctor user + record
    doctorUserId = uuidv4();
    doctorUsername = `dr_emr_${doctorUserId.slice(0, 6)}`;
    const docHash = await bcrypt.hash('Doctor123!', 10);
    await pool.query(
      `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
       VALUES ($1, $2, 'DOCTOR', $3, $4, $5, true)`,
      [doctorUserId, branchId, `${doctorUsername}@clinic.com`, doctorUsername, docHash]
    );
    const docRes = await pool.query(
      `INSERT INTO doctors (id, branch_id, user_id, full_name, specialization, license_number, is_available)
       VALUES (gen_random_uuid(), $1, $2, 'drg. EMR Test', 'Sp.BM', $3, true)
       RETURNING id`,
      [branchId, doctorUserId, `LIC-EMR-${uuidv4().slice(0, 6)}`]
    );
    doctorRecordId = docRes.rows[0].id;

    // 3. Patient user + record
    patientUserId = uuidv4();
    const patHash = await bcrypt.hash('Patient123!', 10);
    await pool.query(
      `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
       VALUES ($1, $2, 'PATIENT', $3, $4, $5, true)`,
      [patientUserId, branchId, `pat_emr_${uuidv4().slice(0, 6)}@test.com`, `pat_emr_${uuidv4().slice(0, 6)}`, patHash]
    );
    const patRes = await pool.query(
      `INSERT INTO patients (id, branch_id, user_id, full_name, phone)
       VALUES (gen_random_uuid(), $1, $2, 'Pasien EMR Test', '08129876543')
       RETURNING id`,
      [branchId, patientUserId]
    );
    patientRecordId = patRes.rows[0].id;

    // 4. Booking + queue #1 (untuk start/complete/duplicate/audit)
    bookingId1 = uuidv4();
    await pool.query(
      `INSERT INTO bookings (id, branch_id, patient_id, doctor_id, booking_date, booking_time,
         session_start, session_end, status, booking_code, dp_amount)
       VALUES ($1, $2, $3, $4, CURRENT_DATE, '09:00',
         (CURRENT_DATE::text || ' 09:00:00')::timestamp, (CURRENT_DATE::text || ' 10:00:00')::timestamp,
         'PAYMENT_CONFIRMED', $5, 0)`,
      [bookingId1, branchId, patientRecordId, doctorRecordId, `EMR-BK-1-${uuidv4().slice(0, 6)}`]
    );
    const q1 = await pool.query(
      `INSERT INTO queues (branch_id, booking_id, doctor_id, queue_number, status)
       VALUES ($1, $2, $3, 1, 'WAITING') RETURNING id`,
      [branchId, bookingId1, doctorRecordId]
    );
    queueId1 = q1.rows[0].id;

    // 5. Booking + queue #2 (untuk transisi queue WAITING -> COMPLETED)
    bookingId2 = uuidv4();
    await pool.query(
      `INSERT INTO bookings (id, branch_id, patient_id, doctor_id, booking_date, booking_time,
         session_start, session_end, status, booking_code, dp_amount)
       VALUES ($1, $2, $3, $4, CURRENT_DATE, '10:00',
         (CURRENT_DATE::text || ' 10:00:00')::timestamp, (CURRENT_DATE::text || ' 11:00:00')::timestamp,
         'PAYMENT_CONFIRMED', $5, 0)`,
      [bookingId2, branchId, patientRecordId, doctorRecordId, `EMR-BK-2-${uuidv4().slice(0, 6)}`]
    );
    const q2 = await pool.query(
      `INSERT INTO queues (branch_id, booking_id, doctor_id, queue_number, status)
       VALUES ($1, $2, $3, 2, 'WAITING') RETURNING id`,
      [branchId, bookingId2, doctorRecordId]
    );
    queueId2 = q2.rows[0].id;

    // 6. Login doctor
    const login = await request(app)
      .post('/auth/doctor/login')
      .send({ username: doctorUsername, password: 'Doctor123!' });
    expect(login.status).toBe(200);
    doctorToken = login.body.data.token;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM invoices WHERE branch_id = $1', [branchId]);
    await pool.query('DELETE FROM encounters WHERE branch_id = $1', [branchId]);
    await pool.query('DELETE FROM queues WHERE branch_id = $1', [branchId]);
    await pool.query('DELETE FROM bookings WHERE branch_id = $1', [branchId]);
    await pool.query('DELETE FROM patients WHERE id = $1', [patientRecordId]);
    await pool.query('DELETE FROM doctors WHERE id = $1', [doctorRecordId]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [doctorUserId, patientUserId]);
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

  describe('startEncounter', () => {
    it('should start encounter and set status ONGOING', async () => {
      const res = await request(app)
        .post('/api/encounters')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          bookingId: bookingId1,
          complaint: 'Sakit gigi geraham kanan',
          treatment: 'Scaling',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ONGOING');
      expect(res.body.data.complaint).toBe('Sakit gigi geraham kanan');
      expect(res.body.data.treatment).toBe('Scaling');
      expect(res.body.data.completedAt).toBeNull();
      encounterId = res.body.data.id;

      const db = await pool.query('SELECT status FROM encounters WHERE id = $1', [encounterId]);
      expect(db.rows[0].status).toBe('ONGOING');
    });

    it('should reject empty complaint (validation error 400)', async () => {
      const res = await request(app)
        .post('/api/encounters')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ bookingId: bookingId1, complaint: '', treatment: 'Scaling' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validasi gagal');
      expect(JSON.stringify(res.body.errors)).toContain('Keluhan wajib diisi');
    });

    it('should reject empty treatment (validation error 400)', async () => {
      const res = await request(app)
        .post('/api/encounters')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ bookingId: bookingId1, complaint: 'Sakit gigi', treatment: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.errors)).toContain('Tindakan wajib diisi');
    });

    it('should not create duplicate encounter for same booking (idempotent)', async () => {
      const res = await request(app)
        .post('/api/encounters')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ bookingId: bookingId1, complaint: 'Sakit gigi', treatment: 'Scaling' });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(encounterId);

      const count = await pool.query(
        'SELECT COUNT(*) FROM encounters WHERE booking_id = $1',
        [bookingId1]
      );
      expect(parseInt(count.rows[0].count, 10)).toBe(1);
    });
  });

  describe('completeEncounter', () => {
    it('should complete encounter and auto-generate invoice (UNPAID)', async () => {
      const res = await request(app)
        .post(`/api/encounters/${encounterId}/complete`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.encounter.status).toBe('COMPLETED');
      expect(res.body.data.encounter.completedAt).not.toBeNull();

      const invoice = res.body.data.invoice;
      expect(invoice).toBeDefined();
      expect(invoice.status).toBe('UNPAID');
      expect(invoice.invoice_number).toBeDefined();
      expect(parseFloat(invoice.amount_due)).toBeGreaterThan(0);

      const encDb = await pool.query('SELECT status FROM encounters WHERE id = $1', [encounterId]);
      expect(encDb.rows[0].status).toBe('COMPLETED');

      const invDb = await pool.query(
        'SELECT status, invoice_number FROM invoices WHERE encounter_id = $1',
        [encounterId]
      );
      expect(invDb.rows.length).toBeGreaterThan(0);
      expect(invDb.rows[0].status).toBe('UNPAID');
    });
  });

  describe('queue status transition', () => {
    it('should change queue status WAITING -> COMPLETED via doctor check-in', async () => {
      // Seed queue #2 mulai dari WAITING
      const before = await pool.query('SELECT status FROM queues WHERE id = $1', [queueId2]);
      expect(before.rows[0].status).toBe('WAITING');

      const res = await request(app)
        .post(`/api/queue/${queueId2}/check-in`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.queue.status).toBe('COMPLETED');
      expect(res.body.data.encounter.status).toBe('ONGOING');

      const after = await pool.query('SELECT status FROM queues WHERE id = $1', [queueId2]);
      expect(after.rows[0].status).toBe('COMPLETED');
    });
  });

  describe('audit log', () => {
    it('should record ENCOUNTER_STARTED and ENCOUNTER_COMPLETED audit events', async () => {
      const logs = await pool.query(
        `SELECT DISTINCT event_type FROM audit_logs
         WHERE entity_id = $1 AND event_type IN ('ENCOUNTER_STARTED', 'ENCOUNTER_COMPLETED', 'ENCOUNTER_DIAGNOSIS_RECORDED', 'ENCOUNTER_TREATMENT_RECORDED', 'EMR_UPDATED')
         ORDER BY event_type`,
        [encounterId]
      );
      const types = logs.rows.map((r) => r.event_type);
      expect(types).toContain('ENCOUNTER_STARTED');
      expect(types).toContain('ENCOUNTER_COMPLETED');
    });
  });
});