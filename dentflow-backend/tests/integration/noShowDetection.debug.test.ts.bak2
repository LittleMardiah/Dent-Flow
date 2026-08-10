import { Pool } from 'pg';
import { config } from '../../src/config';
import { noShowDetectionJob } from '../../src/jobs/noShowDetection.job';
import { v4 as uuidv4 } from 'uuid';

const pool = new Pool({ connectionString: config.database.url });

describe('NoShowDetectionJob - DEBUG', () => {
  let branchId: string;
  let patientUserId: string;
  let doctorUserId: string;
  let patientId: string;
  let doctorId: string;
  let bookingPastId: string;

  beforeAll(async () => {
    // Cleanup
    await pool.query("DELETE FROM bookings WHERE booking_code LIKE 'NS-%'");
    await pool.query("DELETE FROM doctors WHERE license_number = 'LIC-NS-001'");
    await pool.query("DELETE FROM patients WHERE phone = '08123456780'");
    await pool.query("DELETE FROM users WHERE email LIKE 'noshow_%@test.com'");
    await pool.query("DELETE FROM branches WHERE name = 'Test Branch NoShow'");

    // 1. Setup Branch
    const branchRes = await pool.query(
      `INSERT INTO branches (id, name, phone, address) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [uuidv4(), 'Test Branch NoShow', '08123456789', 'Jl. Test No 1']
    );
    branchId = branchRes.rows[0].id;

    // 2. Setup Patient User
    const patientUserRes = await pool.query(
      `INSERT INTO users (id, branch_id, role, email, username, password_hash) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [uuidv4(), branchId, 'PATIENT', 'noshow_patient@test.com', 'noshow_patient', 'hashed']
    );
    patientUserId = patientUserRes.rows[0].id;

    // 3. Setup Patient
    const patientRes = await pool.query(
      `INSERT INTO patients (id, branch_id, user_id, full_name, phone) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [uuidv4(), branchId, patientUserId, 'No Show Patient', '08123456780']
    );
    patientId = patientRes.rows[0].id;

    // 4. Setup Doctor User
    const doctorUserRes = await pool.query(
      `INSERT INTO users (id, branch_id, role, email, username, password_hash) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [uuidv4(), branchId, 'DOCTOR', 'noshow_doctor@test.com', 'noshow_doctor', 'hashed']
    );
    doctorUserId = doctorUserRes.rows[0].id;

    // 5. Setup Doctor
    const doctorRes = await pool.query(
      `INSERT INTO doctors (id, branch_id, user_id, full_name, specialization, license_number) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [uuidv4(), branchId, doctorUserId, 'No Show Doctor', 'General', 'LIC-NS-001']
    );
    doctorId = doctorRes.rows[0].id;

    // 6. Booking PAST (harus NO_SHOW)
    const pastStart = new Date();
    pastStart.setHours(pastStart.getHours() - 3);
    const pastEnd = new Date();
    pastEnd.setHours(pastEnd.getHours() - 2);

    const bookingPastRes = await pool.query(
      `INSERT INTO bookings (
        id, branch_id, patient_id, doctor_id, booking_date, booking_time, 
        status, booking_code, session_start, session_end, checked_in_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        uuidv4(), branchId, patientId, doctorId, 
        new Date(), '09:00', 
        'PAYMENT_CONFIRMED', 'NS-PAST-001', 
        pastStart, pastEnd, 
        null
      ]
    );
    bookingPastId = bookingPastRes.rows[0].id;

    console.log('✅ Data inserted, booking_id:', bookingPastId);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM bookings WHERE id = $1`, [bookingPastId]);
    await pool.query(`DELETE FROM doctors WHERE id = $1`, [doctorId]);
    await pool.query(`DELETE FROM users WHERE id IN ($1, $2)`, [patientUserId, doctorUserId]);
    await pool.query(`DELETE FROM patients WHERE id = $1`, [patientId]);
    await pool.query(`DELETE FROM branches WHERE id = $1`, [branchId]);
    await pool.end();
  });

  it('should execute job and update booking to NO_SHOW', async () => {
    console.log('🔍 BEFORE JOB: checking booking status...');
    const before = await pool.query(`SELECT status FROM bookings WHERE id = $1`, [bookingPastId]);
    console.log('   Status before:', before.rows[0].status);

    console.log('🔍 Calling job.execute()...');
    try {
      await noShowDetectionJob.execute();
      console.log('✅ Job executed successfully');
    } catch (error) {
      console.error('❌ Job threw error:', error);
      throw error;
    }

    console.log('🔍 AFTER JOB: checking booking status...');
    const after = await pool.query(`SELECT status, no_show_at FROM bookings WHERE id = $1`, [bookingPastId]);
    console.log('   Status after:', after.rows[0].status);
    console.log('   no_show_at:', after.rows[0].no_show_at);

    expect(after.rows[0].status).toBe('NO_SHOW');
    expect(after.rows[0].no_show_at).not.toBeNull();
  });
});
