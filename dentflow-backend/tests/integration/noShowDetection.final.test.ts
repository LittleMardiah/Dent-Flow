import { Pool } from 'pg';
import { config } from '../../src/config';
import { noShowDetectionJob } from '../../src/jobs/noShowDetection.job';
import { v4 as uuidv4 } from 'uuid';

const pool = new Pool({ connectionString: config.database.url });

describe('NoShowDetectionJob - FINAL TEST', () => {
  let bookingPastId: string;

  beforeAll(async () => {
    // Cleanup
    await pool.query("DELETE FROM bookings WHERE booking_code LIKE 'NS-%'");
    await pool.query("DELETE FROM doctors WHERE license_number = 'LIC-NS-001'");
    await pool.query("DELETE FROM patients WHERE phone = '08123456780'");
    await pool.query("DELETE FROM users WHERE email LIKE 'noshow_%@test.com'");
    await pool.query("DELETE FROM branches WHERE name = 'Test Branch NoShow'");

    // Setup minimal data
    const branchRes = await pool.query(
      `INSERT INTO branches (id, name, phone, address) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [uuidv4(), 'Test Branch NoShow', '08123456789', 'Jl. Test No 1']
    );
    const branchId = branchRes.rows[0].id;

    const patientUserRes = await pool.query(
      `INSERT INTO users (id, branch_id, role, email, username, password_hash) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [uuidv4(), branchId, 'PATIENT', 'noshow_patient@test.com', 'noshow_patient', 'hashed']
    );
    const patientUserId = patientUserRes.rows[0].id;

    const patientRes = await pool.query(
      `INSERT INTO patients (id, branch_id, user_id, full_name, phone) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [uuidv4(), branchId, patientUserId, 'No Show Patient', '08123456780']
    );
    const patientId = patientRes.rows[0].id;

    const doctorUserRes = await pool.query(
      `INSERT INTO users (id, branch_id, role, email, username, password_hash) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [uuidv4(), branchId, 'DOCTOR', 'noshow_doctor@test.com', 'noshow_doctor', 'hashed']
    );
    const doctorUserId = doctorUserRes.rows[0].id;

    const doctorRes = await pool.query(
      `INSERT INTO doctors (id, branch_id, user_id, full_name, specialization, license_number) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [uuidv4(), branchId, doctorUserId, 'No Show Doctor', 'General', 'LIC-NS-001']
    );
    const doctorId = doctorRes.rows[0].id;

    // Insert booking PAST dengan session_end = NOW() - 2 hours (di database)
    const bookingPastRes = await pool.query(
      `INSERT INTO bookings (
        id, branch_id, patient_id, doctor_id, booking_date, booking_time, 
        status, booking_code, session_start, session_end, checked_in_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, (NOW() - INTERVAL '2 hours'), $10
      ) RETURNING id`,
      [
        uuidv4(), branchId, patientId, doctorId, 
        new Date(), '09:00', 
        'PAYMENT_CONFIRMED', 'NS-PAST-001', 
        new Date(), null
      ]
    );
    bookingPastId = bookingPastRes.rows[0].id;

    console.log('✅ Data inserted. Booking ID:', bookingPastId);

    // Cek kondisi
    const check = await pool.query(
      `SELECT session_end, NOW() as db_now, session_end < NOW() - INTERVAL '15 minutes' as match 
       FROM bookings WHERE id = $1`,
      [bookingPastId]
    );
    console.log('🔍 session_end:', check.rows[0].session_end);
    console.log('🔍 db_now:', check.rows[0].db_now);
    console.log('🔍 match condition:', check.rows[0].match);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM bookings WHERE id = $1`, [bookingPastId]);
    await pool.query(`DELETE FROM doctors WHERE license_number = 'LIC-NS-001'`);
    await pool.query(`DELETE FROM patients WHERE phone = '08123456780'`);
    await pool.query(`DELETE FROM users WHERE email LIKE 'noshow_%@test.com'`);
    await pool.query(`DELETE FROM branches WHERE name = 'Test Branch NoShow'`);
    await pool.end();
  });

  it('should mark past booking as NO_SHOW', async () => {
    console.log('🔍 BEFORE JOB: status =', (await pool.query(`SELECT status FROM bookings WHERE id = $1`, [bookingPastId])).rows[0].status);
    
    await noShowDetectionJob.execute();
    
    const after = await pool.query(`SELECT status, no_show_at FROM bookings WHERE id = $1`, [bookingPastId]);
    console.log('🔍 AFTER JOB: status =', after.rows[0].status);
    console.log('   no_show_at:', after.rows[0].no_show_at);
    
    expect(after.rows[0].status).toBe('NO_SHOW');
    expect(after.rows[0].no_show_at).not.toBeNull();
  });
});
