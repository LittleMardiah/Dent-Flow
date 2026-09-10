import { Pool } from 'pg';
import { config } from '../src/config';
import bcrypt from 'bcryptjs';

/**
 * SEED MULTI-BRANCH (idempotent)
 * - Branch A: admin@clinic.com (admin_a), 5 pasien, 3 invoice PAID
 * - Branch B: admin_b@clinic.com,       5 pasien, 3 invoice PAID
 * - Branch C: admin_c@clinic.com,       5 pasien, 3 invoice PAID
 * - Grant admin A => akses tambahan ke Branch B (untuk uji switch branch)
 * - Pasien marker: "MB-Pasien A-1", "MB-Pasien B-1", dst (untuk E2E)
 */
const BRANCHES: Record<string, { id: string; name: string; address: string; adminEmail: string; adminUser: string; doctorEmail: string; doctorUser: string; license: string; amounts: number[] }> = {
  A: {
    id: '494a607c-d109-4330-a3a9-68f54326f0c7',
    name: 'Cabang A',
    address: 'Jl. Merdeka No. 1, Jakarta',
    adminEmail: 'admin@clinic.com',
    adminUser: 'admin_a',
    doctorEmail: 'dr_bm_a@clinic.com',
    doctorUser: 'dr_bm_a',
    license: 'MB-LIC-A',
    amounts: [150000, 200000, 250000],
  },
  B: {
    id: '88d0b0a4-17f8-46c7-a8dc-8755fe8e8d4f',
    name: 'Cabang B',
    address: 'Jl. Sudirman No. 2, Bandung',
    adminEmail: 'admin_b@clinic.com',
    adminUser: 'admin_b',
    doctorEmail: 'dr_bm_b@clinic.com',
    doctorUser: 'dr_bm_b',
    license: 'MB-LIC-B',
    amounts: [200000, 300000, 350000],
  },
  C: {
    id: '7c1f0000-0000-4000-8000-00000000000c',
    name: 'Cabang C',
    address: 'Jl. Diponegoro No. 3, Surabaya',
    adminEmail: 'admin_c@clinic.com',
    adminUser: 'admin_c',
    doctorEmail: 'dr_bm_c@clinic.com',
    doctorUser: 'dr_bm_c',
    license: 'MB-LIC-C',
    amounts: [250000, 250000, 250000],
  },
};

async function upsertUser(
  client: { query: (q: string, p?: any[]) => Promise<any> },
  branchId: string,
  role: string,
  email: string,
  username: string,
  password: string
): Promise<string> {
  const hash = await bcrypt.hash(password, 10);
  const res = await client.query(
    `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           branch_id = EXCLUDED.branch_id,
           username = EXCLUDED.username,
           is_active = true
     RETURNING id`,
    [branchId, role, email, username, hash]
  );
  return res.rows[0].id;
}

async function ensureDoctor(
  client: { query: (q: string, p?: any[]) => Promise<any> },
  branchId: string,
  doctorUserId: string,
  fullName: string,
  license: string
): Promise<string> {
  await client.query(
    `INSERT INTO doctors (id, branch_id, user_id, full_name, specialization, license_number, is_available)
     VALUES (gen_random_uuid(), $1, $2, $3, 'Sp.BM', $4, true)
     ON CONFLICT (user_id) DO NOTHING`,
    [branchId, doctorUserId, fullName, license]
  );
  const res = await client.query('SELECT id FROM doctors WHERE user_id = $1', [doctorUserId]);
  return res.rows[0].id;
}

async function ensurePatient(
  client: { query: (q: string, p?: any[]) => Promise<any> },
  branchId: string,
  key: string,
  index: number,
  phone: string
): Promise<string> {
  const email = `mb_patient_${key.toLowerCase()}_${index}@clinic.com`;
  const username = `mb_patient_${key.toLowerCase()}_${index}`;
  const hash = await bcrypt.hash('Patient123!', 10);
  const userRes = await client.query(
    `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
     VALUES (gen_random_uuid(), $1, 'PATIENT', $2, $3, $4, true)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, is_active = true
     RETURNING id`,
    [branchId, email, username, hash]
  );
  const userId = userRes.rows[0].id;

  const patRes = await client.query(
    `INSERT INTO patients (id, branch_id, user_id, full_name, phone)
     VALUES (gen_random_uuid(), $1, $2, $3, $4)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING id`,
    [branchId, userId, `MB-Pasien ${key}-${index}`, phone]
  );
  if (patRes.rows.length > 0) {
    return patRes.rows[0].id;
  }
  const existing = await client.query('SELECT id FROM patients WHERE user_id = $1', [userId]);
  return existing.rows[0].id;
}

async function ensureInvoice(
  client: { query: (q: string, p?: any[]) => Promise<any> },
  branchId: string,
  doctorId: string,
  patientId: string,
  key: string,
  index: number,
  amount: number
): Promise<void> {
  const bookingCode = `MB-${key}-${index}`;
  const bkRes = await client.query(
    `INSERT INTO bookings (id, branch_id, patient_id, doctor_id, booking_date, booking_time, status, booking_code)
     VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_DATE, '10:00', 'COMPLETED', $4)
     ON CONFLICT (booking_code) DO NOTHING
     RETURNING id`,
    [branchId, patientId, doctorId, bookingCode]
  );
  let bookingId = bkRes.rows[0]?.id;
  if (!bookingId) {
    const s = await client.query('SELECT id FROM bookings WHERE booking_code = $1', [bookingCode]);
    bookingId = s.rows[0].id;
  }

  const encRes = await client.query(
    `INSERT INTO encounters (id, branch_id, booking_id, doctor_id, patient_id, chief_complaint, diagnosis, treatment, status)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, 'Checkup rutin', 'Karang gigi', 'Scaling', 'COMPLETED')
     ON CONFLICT (booking_id) DO NOTHING
     RETURNING id`,
    [branchId, bookingId, doctorId, patientId]
  );
  let encounterId = encRes.rows[0]?.id;
  if (!encounterId) {
    const s = await client.query('SELECT id FROM encounters WHERE booking_id = $1', [bookingId]);
    encounterId = s.rows[0].id;
  }

  await client.query(
    `INSERT INTO invoices (id, branch_id, encounter_id, patient_id, invoice_number, invoice_date,
                           amount_due, amount_paid, paid_amount, payment_status, status, paid_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, CURRENT_DATE, $5, $5, $5, 'PAID', 'PAID', NOW())
     ON CONFLICT (encounter_id) DO NOTHING`,
    [branchId, encounterId, patientId, `MB-${key}-INV-${index}`, amount]
  );
}

async function seedMultiBranch() {
  const pool = new Pool({ connectionString: config.database.url, max: 5 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. PASTIKAN SEMUA BRANCH ADA DULU (sebelum insert user, karena FK branch)
    for (const key of Object.keys(BRANCHES)) {
      const b = BRANCHES[key];
      await client.query(
        `INSERT INTO branches (id, name, address) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
         WHERE branches.name IS DISTINCT FROM EXCLUDED.name`,
        [b.id, b.name, b.address]
      );
      console.log(`✅ Branch ${key} ready: ${b.name} (${b.id})`);
    }

    // 2. USER & DATA PER BRANCH
    const adminAUserId = await upsertUser(client, BRANCHES.A.id, 'ADMIN_BRANCH', BRANCHES.A.adminEmail, BRANCHES.A.adminUser, 'Admin123!');
    const adminBUserId = await upsertUser(client, BRANCHES.B.id, 'ADMIN_BRANCH', BRANCHES.B.adminEmail, BRANCHES.B.adminUser, 'Admin123!');
    const adminCUserId = await upsertUser(client, BRANCHES.C.id, 'ADMIN_BRANCH', BRANCHES.C.adminEmail, BRANCHES.C.adminUser, 'Admin123!');
    console.log(`✅ Admin A: ${BRANCHES.A.adminEmail} (${adminAUserId})`);
    console.log(`✅ Admin B: ${BRANCHES.B.adminEmail} (${adminBUserId})`);
    console.log(`✅ Admin C: ${BRANCHES.C.adminEmail} (${adminCUserId})`);

    const branchBId = BRANCHES.B.id;
    await client.query(
      `INSERT INTO user_branch_access (user_id, branch_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [adminAUserId, branchBId]
    );
    console.log(`✅ Grant admin A -> Branch B (${branchBId})`);

    for (const key of Object.keys(BRANCHES)) {
      const b = BRANCHES[key];

      const adminUserId = key === 'A' ? adminAUserId : key === 'B' ? adminBUserId : adminCUserId;
      const doctorUserId = await upsertUser(client, b.id, 'DOCTOR', b.doctorEmail, b.doctorUser, 'Doctor123!');
      const doctorId = await ensureDoctor(client, b.id, doctorUserId, `drg. ${b.name}`, b.license);
      console.log(`   ✅ Doctor ${key} ready (${doctorId})`);

      const patientIds: string[] = [];
      for (let i = 1; i <= 5; i++) {
        const pid = await ensurePatient(client, b.id, key, i, `08123${i}000${key === 'A' ? 1 : key === 'B' ? 2 : 3}`);
        patientIds.push(pid);
        console.log(`   ✅ Patient ${key}-${i} ready (${pid})`);
      }

      for (let i = 0; i < b.amounts.length; i++) {
        await ensureInvoice(client, b.id, doctorId, patientIds[i], key, i + 1, b.amounts[i]);
        console.log(`   ✅ Invoice ${key}-${i + 1} ready (Rp ${b.amounts[i]})`);
      }
    }

    await client.query('COMMIT');
    console.log('🎉 SEED MULTI-BRANCH SELESAI');
    console.log('   - Branch A: admin@clinic.com / Admin123!');
    console.log('   - Branch B: admin_b@clinic.com / Admin123!');
    console.log('   - Branch C: admin_c@clinic.com / Admin123!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ SEED MULTI-BRANCH GAGAL:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seedMultiBranch().catch(console.error);
}

export { seedMultiBranch };