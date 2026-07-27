import request from 'supertest';
import { app } from '../../src/index';
;
import { Pool } from 'pg';
import { config } from '../../src/config';


const testBranchId = '7196c0cc-62fa-45da-b534-c65dd2a0dec2';
const testDoctorUserId = '1277a1be-9509-448e-a17c-4bee98b2c43b';

describe('Simple Booking Flow', () => {
  let pool: Pool;
  let patientToken: string;
  let adminToken: string;
  let bookingId: string;
  let bookingCode: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: config.database.url });
    
    // Cleanup existing bookings for today
    const today = new Date().toISOString().split('T')[0];
    await pool.query(
      `DELETE FROM bookings WHERE booking_date = $1 AND branch_id = $2 AND status NOT IN ('COMPLETED', 'NO_SHOW')`,
      [today, testBranchId]
    );
    console.log(`🧹 Cleaned bookings for ${today}`);

    const adminRes = await request(app)
      .post('/auth/admin/login')
      .send({ username: 'admin_a', password: 'Admin123!' });
    adminToken = adminRes.body.data?.access_token || adminRes.body.data?.token || adminRes.body.token;
    console.log('Admin token:', adminToken ? '✅' : '❌');
  });

  afterAll(async () => {
    await pool.end();
  });

  test('1. Patient registers and logs in', async () => {
    const timestamp = Date.now();
    const email = `patient-${timestamp}@test.com`;
    const password = 'Patient123!';

    const registerRes = await request(app)
      .post('/auth/patient/register')
      .send({ email, password, fullName: 'Test Patient', phone: '08123456789' });
    
    console.log('Register status:', registerRes.status);
    expect(registerRes.status).toBe(201);

    const loginRes = await request(app)
      .post('/auth/patient/login')
      .send({ username: email, password });
    expect(loginRes.status).toBe(200);
    patientToken = loginRes.body.data?.access_token || loginRes.body.data?.token || loginRes.body.token;
    expect(patientToken).toBeDefined();
    console.log('Patient token:', patientToken ? '✅' : '❌');
  });

  test('2. Patient books appointment (today)', async () => {
    expect(patientToken).toBeDefined();
    const bookingDate = new Date();
    bookingDate.setHours(9, 0, 0, 0);
    console.log('Booking date:', bookingDate.toISOString());

    const bookingRes = await request(app)
      .post('/api/patient/bookings')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        branchId: testBranchId,
        doctorId: testDoctorUserId,
        bookingDate: bookingDate.toISOString(),
        sessionSlotId: 'slot-1',
        notes: 'Test booking',
      });

    console.log('Booking status:', bookingRes.status);
    expect(bookingRes.status).toBe(201);
    bookingId = bookingRes.body.data.id;
    bookingCode = bookingRes.body.data.booking_code || bookingRes.body.data.check_in_code;
    expect(bookingCode).toBeDefined();
    console.log('Booking code:', bookingCode);

    // 🔧 SET SESSION START TO PAST (1 HOUR AGO)
    await pool.query(
      `UPDATE bookings SET 
        status = 'PAYMENT_CONFIRMED',
        session_start = NOW() - INTERVAL '1 hour',
        session_end = NOW() + INTERVAL '2 hours'
       WHERE id = $1`,
      [bookingId]
    );
    console.log('✅ Booking status updated to PAYMENT_CONFIRMED and session_start set to past');
  });

  test('3. Admin checks-in patient via booking code', async () => {
    expect(adminToken).toBeDefined();
    expect(bookingCode).toBeDefined();
    const checkInRes = await request(app)
      .post('/api/admin/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ booking_code: bookingCode, branch_id: testBranchId });

    console.log('Check-in status:', checkInRes.status);
    if (checkInRes.status !== 200) {
      console.log('Check-in error:', checkInRes.body);
    }
    expect(checkInRes.status).toBe(200);
    const queueId = checkInRes.body.data.queue_id || checkInRes.body.data.id;
    expect(queueId).toBeDefined();
    console.log('Queue ID:', queueId);
  });
});
