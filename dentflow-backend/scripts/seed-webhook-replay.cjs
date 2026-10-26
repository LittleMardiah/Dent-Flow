'use strict';

// E2E seed untuk admin webhook replay (CJS) — dipakai Cypress task `seedWebhookReplay`.
// Membuat booking + encounter + invoice UNPAID dengan invoice_number tetap
// INV-E2E-WH-REPLAY-001 di Cabang A (admin@clinic.com), idempotent:
// hapus booking E2E-WHREPLAY-% (cascade ke queues/encounters/invoices) lalu buat ulang.
//
// Flow: Cypress mengirim webhook gagal (invoice belum ada), lalu task ini membuat
// invoice-nya, sehingga admin replay sukses & invoice berubah PAID.

const path = require('path');
const BACKEND_ROOT = path.resolve(__dirname, '..');

require(path.join(BACKEND_ROOT, 'node_modules/dotenv')).config({
  path: path.join(BACKEND_ROOT, '.env'),
});

const { Pool } = require(path.join(BACKEND_ROOT, 'node_modules/pg'));

const BRANCH_ID = '494a607c-d109-4330-a3a9-68f54326f0c7'; // Cabang A (admin@clinic.com)
const DOCTOR_EMAIL = 'dr_bm_a@clinic.com';
const PATIENT_EMAIL = 'patient@test.com';
const INVOICE_NUMBER = 'INV-E2E-WH-REPLAY-001';

async function seedWebhookReplay() {
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
      `SELECT p.id FROM patients p JOIN users u ON u.id = p.user_id WHERE u.email = $1`,
      [PATIENT_EMAIL]
    );
    if (patientRes.rows.length === 0) {
      throw new Error(`Patient not found: ${PATIENT_EMAIL}`);
    }
    const patientId = patientRes.rows[0].id;

    // Beri kesempatan seedWebhookReplay dibuat ulang idempotent: hapus booking E2E-WHREPLAY-%
    await pool.query(`DELETE FROM bookings WHERE booking_code LIKE 'E2E-WHREPLAY-%'`);

    const booking = await pool.query(
      `INSERT INTO bookings
       (branch_id, patient_id, doctor_id, status, booking_date, booking_time,
        session_start, session_end, booking_code, patient_notes, is_walk_in, dp_amount)
       VALUES ($1, $2, $3, 'PAYMENT_CONFIRMED', CURRENT_DATE, '15:30',
               (CURRENT_DATE::text || ' 16:00:00')::timestamp, (CURRENT_DATE::text || ' 16:30:00')::timestamp,
               'E2E-WHREPLAY-001', 'Pasien seed E2E webhook replay', false, 0)
       RETURNING id`,
      [BRANCH_ID, patientId, doctorId]
    );

    const encounter = await pool.query(
      `INSERT INTO encounters
       (branch_id, booking_id, doctor_id, patient_id, chief_complaint, complaint,
        diagnosis, treatment, status, started_at, completed_at)
       VALUES ($1, $2, $3, $4, 'Gigi ngilu', 'Gigi ngilu kanan bawah',
               'K02.1', 'Tambal', 'COMPLETED', NOW(), NOW())
       RETURNING id`,
      [BRANCH_ID, booking.rows[0].id, doctorId, patientId]
    );

    await pool.query(
      `INSERT INTO invoices
       (branch_id, encounter_id, patient_id, amount_due, amount_paid, status, payment_status,
        paid_amount, invoice_number)
       VALUES ($1, $2, $3, 150000, 0, 'UNPAID', 'UNPAID', NULL, $4)`,
      [BRANCH_ID, encounter.rows[0].id, patientId, INVOICE_NUMBER]
    );
    console.log(`✅ UNPAID invoice created (${INVOICE_NUMBER} - Rp 150.000)`);

    console.log('🎉 Webhook replay seed completed successfully!');
  } finally {
    await pool.end().catch(() => {});
  }
}

if (require.main === module) {
  seedWebhookReplay().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { seedWebhookReplay };