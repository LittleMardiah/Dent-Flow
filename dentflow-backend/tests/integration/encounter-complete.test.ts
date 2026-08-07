import { app } from "../../src/index";
import request from 'supertest';
import { pool } from '../../src/config/database';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

describe('Encounter Complete -> Invoice Generation', () => {
  let branchId: string;
  let patientId: string;
  let patientUserId: string;
  let doctorId: string;
  let doctorUserId: string;
  let doctorUsername: string;
  let bookingId: string;
  let encounterId: string;

  beforeAll(async () => {
    console.log('🔧 [beforeAll] Starting setup...');

    // 1. Buat branch
    const branchRes = await pool.query(
      `INSERT INTO branches (id, name, phone, address, is_active)
       VALUES (gen_random_uuid(), 'Test Branch', '021-1234567', 'Jl. Test', true)
       RETURNING id`
    );
    branchId = branchRes.rows[0].id;
    console.log(`✅ Branch created: ${branchId}`);

    // 2. Buat doctor user
    doctorUserId = uuidv4();
    doctorUsername = `test_doctor_${doctorUserId.slice(0, 8)}`;
    const doctorPassword = 'Doctor123!';
    const doctorHash = await bcrypt.hash(doctorPassword, 10);

    await pool.query(
      `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
       VALUES ($1, $2, 'DOCTOR', $3, $4, $5, true)`,
      [doctorUserId, branchId, `${doctorUsername}@clinic.com`, doctorUsername, doctorHash]
    );
    console.log(`✅ Doctor user created: ${doctorUserId} (username: ${doctorUsername})`);

    // VALIDASI
    const checkUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [doctorUsername]
    );
    if (checkUser.rows.length === 0) {
      throw new Error(`❌ Doctor user ${doctorUsername} not found after insert!`);
    }
    console.log(`✅ Doctor user verified in DB`);

    // 3. Buat doctor record
    const licenseNumber = `LIC-${uuidv4().slice(0, 8)}`;
    const doctorRes = await pool.query(
      `INSERT INTO doctors (id, branch_id, user_id, full_name, specialization, license_number, is_available)
      VALUES (gen_random_uuid(), $1, $2, 'drg. Test', 'Sp.BM', $3, true)
      RETURNING id`,
      [branchId, doctorUserId, licenseNumber]
    );
    doctorId = doctorRes.rows[0].id;
    console.log(`✅ Doctor record created: ${doctorId}`);

    // 4. Buat patient user
    patientUserId = uuidv4();
    const patientUsername = `test_patient_${patientUserId.slice(0, 8)}`;
    const patientPassword = 'Patient123!';
    const patientHash = await bcrypt.hash(patientPassword, 10);

    await pool.query(
      `INSERT INTO users (id, branch_id, role, email, username, password_hash, is_active)
       VALUES ($1, $2, 'PATIENT', $3, $4, $5, true)`,
      [patientUserId, branchId, `${patientUsername}@test.com`, patientUsername, patientHash]
    );
    console.log(`✅ Patient user created: ${patientUserId}`);

    // 5. Buat patient record
    const patientRes = await pool.query(
      `INSERT INTO patients (id, branch_id, user_id, full_name, phone)
       VALUES (gen_random_uuid(), $1, $2, 'Test Patient', '08123456789')
       RETURNING id`,
      [branchId, patientUserId]
    );
    patientId = patientRes.rows[0].id;
    console.log(`✅ Patient record created: ${patientId}`);

    // 6. Buat booking
    bookingId = uuidv4();
    await pool.query(
      `INSERT INTO bookings (id, branch_id, patient_id, doctor_id, booking_date, booking_time, status, booking_code, dp_amount)
       VALUES ($1, $2, $3, $4, CURRENT_DATE, '09:00:00', 'CHECKED_IN', $5, 50000)`,
      [bookingId, branchId, patientId, doctorId, `BK-${uuidv4().slice(0, 6)}`]
    );
    console.log(`✅ Booking created: ${bookingId}`);

    // 7. Buat encounter
    const encRes = await pool.query(
      `INSERT INTO encounters (id, branch_id, booking_id, doctor_id, patient_id, status, started_at, treatment)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ONGOING', NOW(), 'Scaling')
       RETURNING id`,
      [branchId, bookingId, doctorId, patientId]
    );
    encounterId = encRes.rows[0].id;
    console.log(`✅ Encounter created: ${encounterId}`);

    console.log('✅ [beforeAll] Setup complete!');
  });

  afterAll(async () => {
    console.log('🧹 [afterAll] Cleaning up...');
    await pool.query('DELETE FROM invoices WHERE encounter_id = $1', [encounterId]);
    await pool.query('DELETE FROM encounters WHERE id = $1', [encounterId]);
    await pool.query('DELETE FROM bookings WHERE id = $1', [bookingId]);
    await pool.query('DELETE FROM patients WHERE id = $1', [patientId]);
    await pool.query('DELETE FROM doctors WHERE id = $1', [doctorId]);
    await pool.query('DELETE FROM users WHERE id IN ($1, $2)', [doctorUserId, patientUserId]);
    await pool.query('DELETE FROM users WHERE branch_id = $1', [branchId]);
    await pool.query('DELETE FROM audit_logs WHERE branch_id = $1', [branchId]);
    await pool.query('DELETE FROM branches WHERE id = $1', [branchId]);
    await pool.end();
    console.log('✅ [afterAll] Cleanup complete.');
  });

  it('should generate invoice with treatment price when encounter completed', async () => {
    console.log('🔍 [test] Logging in as doctor...');
    const doctorLogin = await request(app)
      .post('/auth/doctor/login')
      .send({ username: doctorUsername, password: 'Doctor123!' });
    console.log('🔍 [test] Login response status:', doctorLogin.status);
    console.log('🔍 [test] Login response body:', JSON.stringify(doctorLogin.body, null, 2));

    expect(doctorLogin.status).toBe(200);
    // Token ada di body.data.token (bukan access_token)
    const doctorToken = doctorLogin.body.data?.token;
    if (!doctorToken) {
      console.error('❌ [test] Token not found in response:', doctorLogin.body);
      throw new Error('Token not found in login response');
    }
    console.log('✅ [test] Doctor logged in, token:', doctorToken?.slice(0, 20) + '...');

    console.log('🔍 [test] Completing encounter...');
    const completeRes = await request(app)
      .post(`/api/encounters/${encounterId}/complete`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ treatment: 'Scaling' });
    console.log('🔍 [test] Complete response status:', completeRes.status);
    if (completeRes.status !== 200) {
      console.error('❌ [test] Complete failed:', completeRes.body);
    }
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data).toHaveProperty('invoice');
    const invoice = completeRes.body.data.invoice;

    console.log('🔍 [test] Invoice amount:', invoice.amount_due);
    expect(parseFloat(invoice.amount_due)).toBe(250000);
    expect(invoice.status).toBe('UNPAID');
    expect(invoice.invoice_number).toBeDefined();
    console.log('✅ [test] Test passed!');
  });
});
