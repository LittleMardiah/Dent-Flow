// 🔥 SET ENV SEBELUM IMPORT APP
process.env.MIDTRANS_SERVER_KEY = 'test-key';

import { app } from '../../src/index';
import request from 'supertest';
import { pool } from '../../src/config/database';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

type AnyClient = { query: (q: string, p?: any[]) => Promise<any> };

async function createBranch(client: AnyClient, name: string): Promise<{ id: string; adminUserId: string; adminUsername: string; doctorId: string }> {
  const branchRes = await client.query(
    `INSERT INTO branches (id, name, phone, address, is_active)
     VALUES (gen_random_uuid(), $1, '021-0000000', 'Jl. Test', true)
     RETURNING id`,
    [name]
  );
  const branchId = branchRes.rows[0].id;

  const adminUsername = `mb_admin_${uuidv4().slice(0, 8)}`;
  const adminUserId = uuidv4();
  await client.query(
    `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
     VALUES ($1, $2, 'ADMIN_BRANCH', $3, $4, $5, true)`,
    [adminUserId, branchId, `${adminUsername}@clinic.com`, adminUsername, await bcrypt.hash('Admin123!', 10)]
  );

  const doctorUserId = uuidv4();
  await client.query(
    `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
     VALUES ($1, $2, 'DOCTOR', $3, $4, $5, true)`,
    [doctorUserId, branchId, `${adminUsername}_doc@clinic.com`, `${adminUsername}_doc`, await bcrypt.hash('Doctor123!', 10)]
  );
  const doctorRes = await client.query(
    `INSERT INTO doctors (id, branch_id, user_id, full_name, specialization, license_number, is_available)
     VALUES (gen_random_uuid(), $1, $2, 'drg. Test', 'Sp.BM', $3, true)
     RETURNING id`,
    [branchId, doctorUserId, `MB-LIC-${uuidv4().slice(0, 8)}`]
  );

  return { id: branchId, adminUserId, adminUsername, doctorId: doctorRes.rows[0].id };
}

async function createPatient(client: AnyClient, branchId: string, fullName: string): Promise<string> {
  const username = `mb_pat_${uuidv4().slice(0, 8)}`;
  const userId = uuidv4();
  await client.query(
    `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
     VALUES ($1, $2, 'PATIENT', $3, $4, $5, true)`,
    [userId, branchId, `${username}@test.com`, username, await bcrypt.hash('Patient123!', 10)]
  );
  const res = await client.query(
    `INSERT INTO patients (id, branch_id, user_id, full_name, phone)
     VALUES (gen_random_uuid(), $1, $2, $3, '08123456789')
     RETURNING id`,
    [branchId, userId, fullName]
  );
  return res.rows[0].id;
}

async function createPaidInvoice(client: AnyClient, branchId: string, doctorId: string, patientId: string, amount: number): Promise<string> {
  const bookingRes = await client.query(
    `INSERT INTO bookings (id, branch_id, patient_id, doctor_id, booking_date, booking_time, status, booking_code)
     VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_DATE, '10:00', 'COMPLETED', $4)
     RETURNING id`,
    [branchId, patientId, doctorId, `MB-TEST-${uuidv4().slice(0, 8)}`]
  );
  const bookingId = bookingRes.rows[0].id;

  const encRes = await client.query(
    `INSERT INTO encounters (id, branch_id, booking_id, doctor_id, patient_id, status, treatment, diagnosis)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, 'COMPLETED', 'Scaling', 'Karang gigi')
     RETURNING id`,
    [branchId, bookingId, doctorId, patientId]
  );
  const encounterId = encRes.rows[0].id;

  const invRes = await client.query(
    `INSERT INTO invoices (id, branch_id, encounter_id, patient_id, invoice_number, invoice_date,
                           amount_due, amount_paid, paid_amount, payment_status, status, paid_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, CURRENT_DATE, $5, $5, $5, 'PAID', 'PAID', NOW())
     RETURNING id`,
    [branchId, encounterId, patientId, `MB-TEST-INV-${uuidv4().slice(0, 8)}`, amount]
  );
  return invRes.rows[0].id;
}

describe('Multi-Branch Admin Ops (Task 5.1.3)', () => {
  let branchA: any;
  let branchB: any;
  let branchC: any;
  let adminAToken: string;
  let adminBToken: string;
  let patientA1: string;
  let patientA2: string;
  let patientB1: string;
  let patientC1: string;

  beforeAll(async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      branchA = await createBranch(client, `MB Branch A ${uuidv4().slice(0, 4)}`);
      branchB = await createBranch(client, `MB Branch B ${uuidv4().slice(0, 4)}`);
      branchC = await createBranch(client, `MB Branch C ${uuidv4().slice(0, 4)}`);

      // Pasien: 2 di A, 2 di B, 1 di C
      patientA1 = await createPatient(client, branchA.id, 'MB-Pasien A-1');
      patientA2 = await createPatient(client, branchA.id, 'MB-Pasien A-2');
      patientB1 = await createPatient(client, branchB.id, 'MB-Pasien B-1');
      await createPatient(client, branchB.id, 'MB-Pasien B-2');
      patientC1 = await createPatient(client, branchC.id, 'MB-Pasien C-1');

      // Invoice PAID: A => 300.000 + 200.000 = 500.000; B => 400.000 + 150.000 = 550.000
      await createPaidInvoice(client, branchA.id, branchA.doctorId, patientA1, 300000);
      await createPaidInvoice(client, branchA.id, branchA.doctorId, patientA2, 200000);
      await createPaidInvoice(client, branchB.id, branchB.doctorId, patientB1, 400000);
      await createPaidInvoice(client, branchB.id, branchB.doctorId, patientB1, 150000);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Setup multi-branch failed:', error);
      throw error;
    } finally {
      client.release();
    }

    const loginA = await request(app).post('/auth/admin/login').send({ username: branchA.adminUsername, password: 'Admin123!' });
    adminAToken = loginA.body.data.token;
    const loginB = await request(app).post('/auth/admin/login').send({ username: branchB.adminUsername, password: 'Admin123!' });
    adminBToken = loginB.body.data.token;
  });

  afterAll(async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const branch of [branchA, branchB, branchC]) {
        if (!branch) continue;
        await client.query('DELETE FROM payments WHERE branch_id = $1', [branch.id]);
        await client.query('DELETE FROM payment_webhooks WHERE branch_id = $1', [branch.id]);
        await client.query('DELETE FROM audit_logs WHERE branch_id = $1', [branch.id]);
        await client.query('DELETE FROM invoices WHERE branch_id = $1', [branch.id]);
        await client.query('DELETE FROM encounters WHERE branch_id = $1', [branch.id]);
        await client.query('DELETE FROM bookings WHERE branch_id = $1', [branch.id]);
        await client.query('DELETE FROM queues WHERE branch_id = $1', [branch.id]);
        await client.query('DELETE FROM patients WHERE branch_id = $1', [branch.id]);
        await client.query('DELETE FROM doctors WHERE branch_id = $1', [branch.id]);
        await client.query('DELETE FROM user_branch_access WHERE branch_id = $1', [branch.id]);
        await client.query('DELETE FROM users WHERE branch_id = $1', [branch.id]);
        await client.query('DELETE FROM branches WHERE id = $1', [branch.id]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Cleanup multi-branch failed:', error);
    } finally {
      client.release();
      await pool.end();
    }
  });

  // ============================================================
  // TEST 1: Admin A hanya bisa melihat data Branch A
  // ============================================================
  it('should return ONLY branch A patients for admin A', async () => {
    const res = await request(app)
      .get(`/api/patients?branchId=${branchA.id}&page=1&limit=100`)
      .set('Authorization', `Bearer ${adminAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.data.length).toBeGreaterThanOrEqual(2);

    const ids = res.body.data.data.map((p: any) => p.id);
    // Tidak boleh memuat pasien branch B/C
    expect(ids).not.toContain(patientB1);
    expect(ids).not.toContain(patientC1);
    for (const p of res.body.data.data) {
      expect(p.branchId).toBe(branchA.id);
    }
  });

  // ============================================================
  // TEST 2: Admin A (tanpa grant) mencoba akses Branch B -> 403
  // ============================================================
  it('should return 403 when admin A tries to access branch B patient detail', async () => {
    const res = await request(app)
      .get(`/api/patients/${patientB1}?branchId=${branchB.id}`)
      .set('Authorization', `Bearer ${adminAToken}`);

    expect(res.status).toBe(403);
  });

  // ============================================================
  // TEST 3: Detail pasien branch sendiri (200)
  // ============================================================
  it('should return branch A patient detail for admin A (200)', async () => {
    const res = await request(app)
      .get(`/api/patients/${patientA1}?branchId=${branchA.id}`)
      .set('Authorization', `Bearer ${adminAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fullName).toBe('MB-Pasien A-1');
    expect(Array.isArray(res.body.data.invoices)).toBe(true);
  });

  // ============================================================
  // TEST 4: Multi-branch analytics (revenue per branch)
  // ============================================================
  it('should compute revenue per branch with tenant isolation', async () => {
    // Admin A summary branch A -> 200, revenue A = 500.000
    const sumA = await request(app)
      .get(`/api/invoices/summary?branchId=${branchA.id}`)
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(sumA.status).toBe(200);
    expect(sumA.body.success).toBe(true);
    expect(Number(sumA.body.data.thisMonth)).toBeGreaterThanOrEqual(500000);

    // Admin A coba akses summary branch B -> 403 (tenant isolation)
    const sumABlocked = await request(app)
      .get(`/api/invoices/summary?branchId=${branchB.id}`)
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(sumABlocked.status).toBe(403);

    // Admin B summary branch B -> 200, revenue B = 550.000
    const sumB = await request(app)
      .get(`/api/invoices/summary?branchId=${branchB.id}`)
      .set('Authorization', `Bearer ${adminBToken}`);
    expect(sumB.status).toBe(200);
    expect(Number(sumB.body.data.thisMonth)).toBeGreaterThanOrEqual(550000);

    // Revenue branch A != branch B
    expect(Number(sumA.body.data.thisMonth)).not.toBe(Number(sumB.body.data.thisMonth));
  });

  // ============================================================
  // TEST 5: Update pasien (tenant-scoped)
  // ============================================================
  it('should update branch A patient via PUT (200)', async () => {
    const res = await request(app)
      .put(`/api/patients/${patientA2}?branchId=${branchA.id}`)
      .set('Authorization', `Bearer ${adminAToken}`)
      .send({ fullName: 'MB-Pasien A-2 Updated', phone: '08129999999', email: `mb-updated-${uuidv4().slice(0, 8)}@test.com` });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fullName).toBe('MB-Pasien A-2 Updated');
  });

  // ============================================================
  // TEST 6: Soft delete pasien (tenant-scoped)
  // ============================================================
  it('should soft-delete branch A patient via DELETE (200) then 404 on detail', async () => {
    const del = await request(app)
      .delete(`/api/patients/${patientA1}?branchId=${branchA.id}`)
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(del.status).toBe(200);
    expect(del.body.success).toBe(true);

    const detail = await request(app)
      .get(`/api/patients/${patientA1}?branchId=${branchA.id}`)
      .set('Authorization', `Bearer ${adminAToken}`);
    expect(detail.status).toBe(404);
  });
});