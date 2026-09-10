'use strict';

// E2E fixture seed untuk NO-SHOW (CJS) — dipanggil oleh Cypress task `seedNoShow`.
// Idempotent: hapus semua booking E2E-NS-% lalu buat ulang data NO-SHOW:
//   1. E2E-NS-PAST-001  : booking PAST status NO_SHOW (riwayat pasien)
//   2. E2E-NS-TODAY-001  : booking hari ini status NO_SHOW (muncul di GET /api/no-shows)
//   3. E2E-NS-MANUAL-001 : booking PAYMENT_CONFIRMED hari ini (untuk manual mark NO-SHOW)

const path = require('path');
const BACKEND_ROOT = path.resolve(__dirname, '..');

require(path.join(BACKEND_ROOT, 'node_modules/dotenv')).config({
  path: path.join(BACKEND_ROOT, '.env'),
});

const { Pool } = require(path.join(BACKEND_ROOT, 'node_modules/pg'));

const BRANCH_ID = '494a607c-d109-4330-a3a9-68f54326f0c7'; // Cabang A (admin@clinic.com)
const DOCTOR_EMAIL = 'dr_bm_a@clinic.com';
const PATIENT_EMAIL = 'patient@test.com';

async function seedNoShow() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const branchRes = await pool.query('SELECT id FROM branches WHERE id = $1', [BRANCH_ID]);
    if (branchRes.rows.length === 0) {
      throw new Error(`Branch not found: ${BRANCH_ID}`);
    }

    const doctorRes = await pool.query(
      `SELECT d.id FROM doctors d JOIN users u ON u.id = d.user_id WHERE u.email = $1`,
      [DOCTOR_EMAIL]
    );
    if (doctorRes.rows.length === 0) {
      throw new Error(`Doctor not found: ${DOCTOR_EMAIL}`);
    }
    const doctorId = doctorRes.rows[0].id;

    const patientRes = await pool.query(
      `SELECT p.id, p.full_name FROM patients p JOIN users u ON u.id = p.user_id WHERE u.email = $1`,
      [PATIENT_EMAIL]
    );
    if (patientRes.rows.length === 0) {
      throw new Error(`Patient not found: ${PATIENT_EMAIL}`);
    }
    const patientId = patientRes.rows[0].id;

    // Idempotent cleanup untuk booking NO-SHOW E2E
    await pool.query(`DELETE FROM bookings WHERE booking_code LIKE 'E2E-NS-%'`);
    console.log('✅ Cleaned previous NO-SHOW E2E seed rows');

    // 1. Booking PAST status NO_SHOW (riwayat pasien)
    await pool.query(
      `INSERT INTO bookings
       (branch_id, patient_id, doctor_id, status, booking_date, booking_time,
        session_start, session_end, booking_code, patient_notes, is_walk_in, no_show_at)
       VALUES ($1, $2, $3, 'NO_SHOW', (CURRENT_DATE - 2)::date, '10:00',
               ((CURRENT_DATE - 2)::text || ' 10:00:00')::timestamp,
               ((CURRENT_DATE - 2)::text || ' 11:00:00')::timestamp,
               'E2E-NS-PAST-001', 'Pasien seed E2E NO-SHOW riwayat', false,
               ((CURRENT_DATE - 2)::text || ' 11:15:00')::timestamp)`,
      [BRANCH_ID, patientId, doctorId]
    );
    console.log('✅ E2E-NS-PAST-001 (NO_SHOW past) created');

    // 2. Booking hari ini status NO_SHOW (muncul di GET /api/no-shows)
    await pool.query(
      `INSERT INTO bookings
       (branch_id, patient_id, doctor_id, status, booking_date, booking_time,
        session_start, session_end, booking_code, patient_notes, is_walk_in, no_show_at)
       VALUES ($1, $2, $3, 'NO_SHOW', CURRENT_DATE, '08:00',
               (CURRENT_DATE::text || ' 08:00:00')::timestamp,
               (CURRENT_DATE::text || ' 09:00:00')::timestamp,
               'E2E-NS-TODAY-001', 'Pasien seed E2E NO-SHOW hari ini', false,
               NOW())`,
      [BRANCH_ID, patientId, doctorId]
    );
    console.log('✅ E2E-NS-TODAY-001 (NO_SHOW today) created');

    // 3. Booking PAYMENT_CONFIRMED hari ini (untuk manual mark NO-SHOW)
    await pool.query(
      `INSERT INTO bookings
       (branch_id, patient_id, doctor_id, status, booking_date, booking_time,
        session_start, session_end, booking_code, patient_notes, is_walk_in)
       VALUES ($1, $2, $3, 'PAYMENT_CONFIRMED', CURRENT_DATE, '19:30',
               (CURRENT_DATE::text || ' 20:00:00')::timestamp,
               (CURRENT_DATE::text || ' 21:00:00')::timestamp,
               'E2E-NS-MANUAL-001', 'Pasien seed E2E manual mark NO-SHOW', false)`,
      [BRANCH_ID, patientId, doctorId]
    );
    console.log('✅ E2E-NS-MANUAL-001 (PAYMENT_CONFIRMED) created');

    console.log('🎉 NO-SHOW E2E seed completed successfully!');
  } finally {
    await pool.end().catch(() => {});
  }
}

module.exports = { seedNoShow };