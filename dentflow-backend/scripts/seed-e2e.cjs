'use strict';

// E2E fixture seed (CJS) — dipakai langsung oleh Cypress task & bisa dijalankan manual:
//   node scripts/seed-e2e.cjs
// Idempotent: hapus semua booking E2E-% lalu buat ulang:
//   1. Queue hari ini (WAITING) untuk dr_bm_a (Cabang A) -> baris antrian & dropdown dokter
//   2. Invoice UNPAID Rp 150.000 (Cabang A) -> halaman finance punya tombol Detail
// Booking memakai slot berbeda (15:00-16:00 & 17:00-17:30) sehingga tidak bentrok
// dengan constraint unik slot aktif maupun slot walk-in 09:00-12:00.

const path = require('path');
const BACKEND_ROOT = path.resolve(__dirname, '..');

require(path.join(BACKEND_ROOT, 'node_modules/dotenv')).config({
  path: path.join(BACKEND_ROOT, '.env'),
});

const { Pool } = require(path.join(BACKEND_ROOT, 'node_modules/pg'));

const BRANCH_ID = '494a607c-d109-4330-a3a9-68f54326f0c7'; // Cabang A (admin@clinic.com)
const DOCTOR_EMAIL = 'dr_bm_a@clinic.com';
const PATIENT_EMAIL = 'patient@test.com';

async function seedE2eData() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Ensure schema parity for invoice payment history (created_by column)
    await pool.query(
      `ALTER TABLE invoice_payments ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL`
    );

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
      `SELECT p.id FROM patients p JOIN users u ON u.id = p.user_id WHERE u.email = $1`,
      [PATIENT_EMAIL]
    );
    if (patientRes.rows.length === 0) {
      throw new Error(`Patient not found: ${PATIENT_EMAIL}`);
    }
    const patientId = patientRes.rows[0].id;

    // Idempotent cleanup: hapus semua booking E2E-% (booking_code unique global).
    // Menghapus booking ikut mencascade queues -> encounters -> invoices.
    await pool.query(`DELETE FROM bookings WHERE booking_code LIKE 'E2E-%'`);
    console.log('✅ Cleaned previous E2E seed rows');

    // Booking 1: queue patient (Budi Santoso) — WAITING hari ini
    const booking1 = await pool.query(
      `INSERT INTO bookings
       (branch_id, patient_id, doctor_id, status, booking_date, booking_time,
        session_start, session_end, booking_code, patient_notes, is_walk_in, dp_amount)
       VALUES ($1, $2, $3, 'PAYMENT_CONFIRMED', CURRENT_DATE, '14:30',
               (CURRENT_DATE::text || ' 15:00:00')::timestamp, (CURRENT_DATE::text || ' 16:00:00')::timestamp,
               'E2E-QUEUE-001', 'Pasien seed E2E antrian dokter', false, 0)
       RETURNING id`,
      [BRANCH_ID, patientId, doctorId]
    );

    await pool.query(
      `INSERT INTO queues (booking_id, doctor_id, branch_id, queue_number, status)
       VALUES ($1, $2, $3, 1, 'WAITING')`,
      [booking1.rows[0].id, doctorId, BRANCH_ID]
    );
    console.log('✅ Queue entry for doctor created (WAITING)');

    // Booking 2: encounter + invoice source
    const booking2 = await pool.query(
      `INSERT INTO bookings
       (branch_id, patient_id, doctor_id, status, booking_date, booking_time,
        session_start, session_end, booking_code, patient_notes, is_walk_in, dp_amount)
       VALUES ($1, $2, $3, 'PAYMENT_CONFIRMED', CURRENT_DATE, '16:30',
               (CURRENT_DATE::text || ' 17:00:00')::timestamp, (CURRENT_DATE::text || ' 17:30:00')::timestamp,
               'E2E-INVOICE-001', 'Pasien seed E2E invoice', false, 0)
       RETURNING id`,
      [BRANCH_ID, patientId, doctorId]
    );

    const encounter = await pool.query(
      `INSERT INTO encounters
       (branch_id, booking_id, doctor_id, patient_id, chief_complaint, complaint,
        diagnosis, treatment, status, started_at, completed_at)
       VALUES ($1, $2, $3, $4, 'Sakit gigi geraham kanan', 'Sakit gigi geraham kanan',
               'K04.0', 'Scaling', 'COMPLETED', NOW(), NOW())
       RETURNING id`,
      [BRANCH_ID, booking2.rows[0].id, doctorId, patientId]
    );

    await pool.query(
      `INSERT INTO invoices
       (branch_id, encounter_id, patient_id, amount_due, amount_paid, status, payment_status,
        invoice_number, booking_id)
       VALUES ($1, $2, $3, 150000, 0, 'UNPAID', 'UNPAID', 'INV-E2E-20260906-001', $4)`,
      [BRANCH_ID, encounter.rows[0].id, patientId, booking2.rows[0].id]
    );
    console.log('✅ UNPAID invoice created (Rp 150.000)');

    console.log('🎉 E2E seed completed successfully!');
  } finally {
    await pool.end().catch(() => {});
  }
}

if (require.main === module) {
  seedE2eData().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { seedE2eData };