import request from 'supertest';
import { app } from '../../src/index';
;
import { Pool } from 'pg';
import { config } from '../../src/config';


const testBranchId = '494a607c-d109-4330-a3a9-68f54326f0c7';
// Doctor record ID (from doctors table)
const testDoctorId = 'd93eabaa-d68b-4886-af34-ab7088a08503';
// Doctor user ID (from users table)
const testDoctorUserId = '22222222-2222-2222-2222-222222222222';

describe('End-to-End Booking Flow', () => {
  let pool: Pool;
  let patientToken: string;
  let adminToken: string;
  let doctorToken: string;
  let bookingId: string;
  let bookingCode: string;
  let queueId: string;
  let encounterId: string;
  let invoiceId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: config.database.url });
    
    // Login admin
    const adminRes = await request(app)
      .post('/auth/admin/login')
      .send({ username: 'admin_a', password: 'Admin123!' });
    adminToken = adminRes.body.data?.access_token || adminRes.body.data?.token || adminRes.body.token;
    console.log('Admin token:', adminToken ? '✅' : '❌');

    // Login doctor
    const doctorRes = await request(app)
      .post('/auth/doctor/login')
      .send({ username: 'dr_general_a', password: 'Doctor123!' });
    doctorToken = doctorRes.body.data?.access_token || doctorRes.body.data?.token || doctorRes.body.token;
    console.log('Doctor token:', doctorToken ? '✅' : '❌');
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
    if (registerRes.status !== 201) {
      console.log('Register error:', registerRes.body);
    }
    expect(registerRes.status).toBe(201);

    const loginRes = await request(app)
      .post('/auth/patient/login')
      .send({ username: email, password });
    expect(loginRes.status).toBe(200);
    patientToken = loginRes.body.data?.access_token || loginRes.body.data?.token || loginRes.body.token;
    expect(patientToken).toBeDefined();
  });

  test('2. Patient books appointment', async () => {
    expect(patientToken).toBeDefined();
    const bookingDate = new Date();
    bookingDate.setDate(bookingDate.getDate() + 7);
    bookingDate.setHours(9, 0, 0, 0);

    const bookingRes = await request(app)
      .post('/api/patient/bookings')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        branchId: testBranchId,
        doctorId: testDoctorUserId,  // booking expects user ID
        bookingDate: bookingDate.toISOString(),
        sessionSlotId: 'slot-1',
        notes: 'Test booking',
      });

    expect(bookingRes.status).toBe(201);
    bookingId = bookingRes.body.data.id;
    bookingCode = bookingRes.body.data.booking_code || bookingRes.body.data.check_in_code;
    expect(bookingCode).toBeDefined();
  });

  test('3. Admin checks-in patient via booking code', async () => {
    expect(adminToken).toBeDefined();
    const checkInRes = await request(app)
      .post('/api/admin/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ check_in_code: bookingCode, branch_id: testBranchId });

    expect(checkInRes.status).toBe(200);
    queueId = checkInRes.body.data.queue_id || checkInRes.body.data.id;
    expect(queueId).toBeDefined();
  });

  test('4. Doctor calls patient and starts encounter', async () => {
    expect(doctorToken).toBeDefined();
    // Use doctor record ID for queue endpoint
    const queueRes = await request(app)
      .get(`/api/doctors/${testDoctorId}/queue?branchId=${testBranchId}`)
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(queueRes.status).toBe(200);

    const checkInQueue = await request(app)
      .post(`/api/queue/${queueId}/check-in`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ branchId: testBranchId });

    expect(checkInQueue.status).toBe(200);
    encounterId = checkInQueue.body.data.encounter_id;
    expect(encounterId).toBeDefined();
  });

  test('5. Doctor records diagnosis and treatment', async () => {
    const updateRes = await request(app)
      .put(`/api/encounters/${encounterId}`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        diagnosis: 'Flu symptoms',
        treatment: 'Rest and hydration',
        notes: 'Patient advised to take paracetamol',
        icd10_code: 'J11.1',
      });

    expect(updateRes.status).toBe(200);
  });

  test('6. Doctor completes encounter → invoice auto-generated', async () => {
    const completeRes = await request(app)
      .post(`/api/encounters/${encounterId}/complete`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({});

    expect(completeRes.status).toBe(200);
    invoiceId = completeRes.body.data.invoice_id;
    expect(invoiceId).toBeDefined();

    const invoiceCheck = await pool.query(
      'SELECT status FROM invoices WHERE id = $1',
      [invoiceId]
    );
    expect(invoiceCheck.rows[0].status).toBe('UNPAID');
  });

  test('7. Admin marks invoice as paid', async () => {
    const markPaidRes = await request(app)
      .post(`/api/admin/invoices/${invoiceId}/mark-paid`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ payment_method: 'CASH', paid_amount: 200000, notes: 'Payment received' });

    expect(markPaidRes.status).toBe(200);
    expect(markPaidRes.body.data.status).toBe('PAID');
  });
});
