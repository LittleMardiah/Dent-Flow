import { Pool } from 'pg';
import { config } from '../src/config';
import bcrypt from 'bcryptjs';

/**
 * SEED DOCTORS + SCHEDULES (idempotent) — Phase 1e
 *
 * - 21 dokter baru (7 spesialis × 3 cabang) dengan nama orang Indonesia realistis
 * - Password DOCTOR: 'Doctor123!' (konsisten dengan seed lain)
 * - max_patients_per_session = 4 (HARD REQUIREMENT PRD v10.0)
 * - slot_duration_minutes = 30
 * - Pola jadwal:
 *     Senin, Rabu, Jumat (1,3,5): Sp.KG 10-13 | Sp.KGA 13-16 | Sp.PM 14-17
 *     Selasa, Kamis, Sabtu (2,4,6): Sp.Ort 09-12 | Sp.Pros 10-13 | Sp.Perio 13-16 | Sp.RKG 14-17
 *     Minggu (0): TUTUP
 * - Sp.BM : 09:00-12:00 (existing, SKIP)
 *
 * CATATAN SCHEMA: doctor_schedules.dokter_id adalah FK ke users(id),
 * jadi yang di-insert adalah user_id dokter, BUKAN doctors.id.
 */

const DOCTOR_PASSWORD = 'Doctor123!';
const MAX_PATIENTS_PER_SESSION = 4;
const SLOT_DURATION_MINUTES = 30;
const IS_ACTIVE = true;

interface DoctorSeed {
  name: string;
  spec: string;
}

interface BranchSeed {
  branchName: string;
  branchKey: string;
  doctors: DoctorSeed[];
}

const BRANCHES: BranchSeed[] = [
  {
    branchName: 'Cabang A',
    branchKey: 'A',
    doctors: [
      { name: 'drg. Siti Rahayu', spec: 'Sp.KG' },
      { name: 'drg. Dewi Lestari', spec: 'Sp.KGA' },
      { name: 'drg. Ahmad Fauzi', spec: 'Sp.PM' },
      { name: 'drg. Budi Santoso', spec: 'Sp.Ort' },
      { name: 'drg. Eko Prasetyo', spec: 'Sp.Pros' },
      { name: 'drg. Fitri Handayani', spec: 'Sp.Perio' },
      { name: 'drg. Gunawan Wibowo', spec: 'Sp.RKG' },
    ],
  },
  {
    branchName: 'Cabang B',
    branchKey: 'B',
    doctors: [
      { name: 'drg. Rina Wijaya', spec: 'Sp.KG' },
      { name: 'drg. Hendra Kusuma', spec: 'Sp.KGA' },
      { name: 'drg. Ayu Lestari', spec: 'Sp.PM' },
      { name: 'drg. Bambang Sutrisno', spec: 'Sp.Ort' },
      { name: 'drg. Citra Dewi', spec: 'Sp.Pros' },
      { name: 'drg. Dedi Kurniawan', spec: 'Sp.Perio' },
      { name: 'drg. Eka Putri', spec: 'Sp.RKG' },
    ],
  },
  {
    branchName: 'Cabang C',
    branchKey: 'C',
    doctors: [
      { name: 'drg. Farah Anisa', spec: 'Sp.KG' },
      { name: 'drg. Gilang Ramadhan', spec: 'Sp.KGA' },
      { name: 'drg. Hesti Wulandari', spec: 'Sp.PM' },
      { name: 'drg. Irfan Hakim', spec: 'Sp.Ort' },
      { name: 'drg. Joko Widodo', spec: 'Sp.Pros' },
      { name: 'drg. Kartika Sari', spec: 'Sp.Perio' },
      { name: 'drg. Lukman Hakim', spec: 'Sp.RKG' },
    ],
  },
];

// Pola jadwal per spesialis: key day_of_week -> { start, end }
const SCHEDULE_PATTERN: Record<number, Record<string, { start: string; end: string }>> = {
  1: { 'Sp.KG': { start: '10:00', end: '13:00' }, 'Sp.KGA': { start: '13:00', end: '16:00' }, 'Sp.PM': { start: '14:00', end: '17:00' } },
  3: { 'Sp.KG': { start: '10:00', end: '13:00' }, 'Sp.KGA': { start: '13:00', end: '16:00' }, 'Sp.PM': { start: '14:00', end: '17:00' } },
  5: { 'Sp.KG': { start: '10:00', end: '13:00' }, 'Sp.KGA': { start: '13:00', end: '16:00' }, 'Sp.PM': { start: '14:00', end: '17:00' } },
  2: { 'Sp.Ort': { start: '09:00', end: '12:00' }, 'Sp.Pros': { start: '10:00', end: '13:00' }, 'Sp.Perio': { start: '13:00', end: '16:00' }, 'Sp.RKG': { start: '14:00', end: '17:00' } },
  4: { 'Sp.Ort': { start: '09:00', end: '12:00' }, 'Sp.Pros': { start: '10:00', end: '13:00' }, 'Sp.Perio': { start: '13:00', end: '16:00' }, 'Sp.RKG': { start: '14:00', end: '17:00' } },
  6: { 'Sp.Ort': { start: '09:00', end: '12:00' }, 'Sp.Pros': { start: '10:00', end: '13:00' }, 'Sp.Perio': { start: '13:00', end: '16:00' }, 'Sp.RKG': { start: '14:00', end: '17:00' } },
};

function slugify(name: string): string {
  return name
    .replace(/^drg\.\s*/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function specShort(spec: string): string {
  return spec.replace(/[^A-Za-z]/g, '').toUpperCase();
}

async function seedDoctorsSchedules() {
  const pool = new Pool({ connectionString: config.database.url, max: 5 });
  const client = await pool.connect();
  const passwordHash = await bcrypt.hash(DOCTOR_PASSWORD, 10);
  try {
    await client.query('BEGIN');

    let doctorCounter = 0;
    let scheduleInserted = 0;
    let scheduleSkipped = 0;

    for (const branch of BRANCHES) {
      // 1. Cari branch id by name
      const branchRes = await client.query('SELECT id, name FROM branches WHERE name = $1', [branch.branchName]);
      if (branchRes.rows.length === 0) {
        throw new Error(`BRANCH_NOT_FOUND: ${branch.branchName}`);
      }
      const branchId = branchRes.rows[0].id;
      console.log(`✅ Branch ready: ${branch.branchName} (${branchId})`);

      for (const doc of branch.doctors) {
        const slug = slugify(doc.name);
        const username = `drg_${slug}_${branch.branchKey.toLowerCase()}`;
        const email = `${username}@clinic.com`;
        const licenseNumber = `SK-${branch.branchKey}-${specShort(doc.spec)}-001`;

        // 2a. User (ON CONFLICT email DO NOTHING)
        await client.query(
          `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
           VALUES (gen_random_uuid(), $1, 'DOCTOR', $2, $3, $4, $5)
           ON CONFLICT (email) DO NOTHING`,
          [branchId, email, username, passwordHash, true]
        );
        const userRes = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userRes.rows.length === 0) {
          throw new Error(`USER_NOT_FOUND_AFTER_INSERT: ${email}`);
        }
        const doctorUserId = userRes.rows[0].id;

        // 2b. Doctor (ON CONFLICT user_id DO NOTHING)
        await client.query(
          `INSERT INTO doctors (id, branch_id, user_id, full_name, specialization, license_number, is_available)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true)
           ON CONFLICT (user_id) DO NOTHING`,
          [branchId, doctorUserId, doc.name, doc.spec, licenseNumber]
        );
        const doctorRes = await client.query('SELECT id FROM doctors WHERE user_id = $1', [doctorUserId]);
        if (doctorRes.rows.length === 0) {
          throw new Error(`DOCTOR_NOT_FOUND_AFTER_INSERT: ${doc.name}`);
        }
        const doctorRecordId = doctorRes.rows[0].id;
        doctorCounter += 1;
        console.log(`  ✅ Doctor: ${doc.name} (${doc.spec}) | user=${doctorUserId} | doctor_id=${doctorRecordId} | lic=${licenseNumber}`);

        // 3. Schedules: SELECT cek (dokter_id, day_of_week) dulu, kalau belum ada INSERT
        for (const dayStr of Object.keys(SCHEDULE_PATTERN)) {
          const day = parseInt(dayStr, 10);
          const slot = SCHEDULE_PATTERN[day][doc.spec];
          if (!slot) continue;

          const existing = await client.query(
            'SELECT id FROM doctor_schedules WHERE dokter_id = $1 AND day_of_week = $2',
            [doctorUserId, day]
          );
          if (existing.rows.length > 0) {
            scheduleSkipped += 1;
            console.log(`    ℹ️  Skip schedule: ${doc.name} day=${day} (sudah ada)`);
            continue;
          }

          await client.query(
            `INSERT INTO doctor_schedules
               (branch_id, dokter_id, day_of_week, session_start, session_end,
                max_patients_per_session, slot_duration_minutes, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [branchId, doctorUserId, day, slot.start, slot.end, MAX_PATIENTS_PER_SESSION, SLOT_DURATION_MINUTES, IS_ACTIVE]
          );
          scheduleInserted += 1;
          console.log(`    ✅ Schedule: ${doc.name} (${doc.spec}) day=${day} ${slot.start}-${slot.end} | max=${MAX_PATIENTS_PER_SESSION}`);
        }
      }
    }

    await client.query('COMMIT');
    console.log('');
    console.log('🎉 SEED DOCTORS + SCHEDULES SELESAI');
    console.log(`   - Doctors ready/processed: ${doctorCounter}`);
    console.log(`   - Schedules inserted      : ${scheduleInserted}`);
    console.log(`   - Schedules skipped (ada) : ${scheduleSkipped}`);
    console.log(`   - Password           : ${DOCTOR_PASSWORD}`);
    console.log(`   - max_patients/session: ${MAX_PATIENTS_PER_SESSION}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ SEED DOCTORS + SCHEDULES GAGAL:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seedDoctorsSchedules().catch(console.error);
}

export { seedDoctorsSchedules };