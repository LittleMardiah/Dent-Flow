#!/bin/bash
set -e

echo "========================================="
echo " DEBUG INTEGRATION TEST (REGISTER ERROR)"
echo "========================================="

# Update test file dengan console.log untuk lihat error response
cat > tests/integration/booking-flow.e2e.test.ts << 'TEST_EOF'
import request from 'supertest';
import { app } from '../../src/index';
import { Pool } from 'pg';
import { config } from '../../src/config';

const getTestData = async () => {
  const pool = new Pool({ connectionString: config.database.url });
  const branchRes = await pool.query(
    "SELECT id FROM branches WHERE name = 'Cabang A' LIMIT 1"
  );
  const doctorRes = await pool.query(
    "SELECT id FROM users WHERE username = 'dr_bm_a' AND role = 'DOCTOR' LIMIT 1"
  );
  await pool.end();
  return {
    branchId: branchRes.rows[0]?.id,
    doctorId: doctorRes.rows[0]?.id,
  };
};

describe('E2E Booking Flow', () => {
  let patientToken: string;
  let bookingId: string;
  let bookingCode: string;
  let queueId: string;
  let encounterId: string;
  let invoiceId: string;
  let testData: any;
  let testEmail: string;

  beforeAll(async () => {
    testData = await getTestData();
    expect(testData.branchId).toBeDefined();
    expect(testData.doctorId).toBeDefined();
    testEmail = `e2e-test-${Date.now()}@example.com`;
  });

  test('1. Register patient', async () => {
    const res = await request(app)
      .post('/auth/patient/register')
      .send({
        email: testEmail,
        password: 'Test123!',
        full_name: 'E2E Test User',
        phone: '+6281234567890',  // Ganti phone_number → phone
      });
    // Log response body jika gagal
    if (res.status !== 201) {
      console.log('❌ Register failed!');
      console.log('Status:', res.status);
      console.log('Response body:', JSON.stringify(res.body, null, 2));
    }
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
  });

  test('2. Login patient', async () => {
    const res = await request(app)
      .post('/auth/patient/login')
      .send({
        username: testEmail,
        password: 'Test123!',
      });
    if (res.status !== 200) {
      console.log('❌ Login failed!');
      console.log('Status:', res.status);
      console.log('Response body:', JSON.stringify(res.body, null, 2));
    }
    expect(res.status).toBe(200);
    expect(res.body.data.access_token).toBeDefined();
    patientToken = res.body.data.access_token;
  });

  test('3. Get doctor availability', async () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    const dateStr = date.toISOString().split('T')[0];
    const res = await request(app)
      .get(`/api/doctors/${testData.doctorId}/availability`)
      .query({ date: dateStr, branch_id: testData.branchId })
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.slots.length).toBeGreaterThan(0);
  });

  test('4. Create booking', async () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    const dateStr = date.toISOString().split('T')[0];
    const availRes = await request(app)
      .get(`/api/doctors/${testData.doctorId}/availability`)
      .query({ date: dateStr, branch_id: testData.branchId })
      .set('Authorization', `Bearer ${patientToken}`);
    expect(availRes.status).toBe(200);
    const slots = availRes.body.data.slots;
    expect(slots.length).toBeGreaterThan(0);
    const slotStart = slots[0].start || slots[0].start_time;
    const res = await request(app)
      .post('/api/patient/bookings')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        branch_id: testData.branchId,
        doctor_id: testData.doctorId,
        booking_date: dateStr,
        session_slot_id: slotStart,
      });
    if (res.status !== 201) {
      console.log('❌ Booking failed!');
      console.log('Status:', res.status);
      console.log('Response body:', JSON.stringify(res.body, null, 2));
    }
    expect(res.status).toBe(201);
    bookingId = res.body.data.id;
    bookingCode = res.body.data.check_in_code || res.body.data.booking_code;
    expect(bookingCode).toBeDefined();
  });

  test('5. Admin checks-in patient', async () => {
    const loginRes = await request(app)
      .post('/auth/admin/login')
      .send({
        username: 'admin_a',
        password: 'Admin123!',
      });
    expect(loginRes.status).toBe(200);
    const adminToken = loginRes.body.data.access_token;

    const res = await request(app)
      .post('/api/admin/check-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        check_in_code: bookingCode,
        branch_id: testData.branchId,
      });
    if (res.status !== 200) {
      console.log('❌ Check-in failed!');
      console.log('Status:', res.status);
      console.log('Response body:', JSON.stringify(res.body, null, 2));
    }
    expect(res.status).toBe(200);
    queueId = res.body.data.queue_id || res.body.data.id;
    expect(queueId).toBeDefined();
  });

  test('6. Doctor starts encounter', async () => {
    const loginRes = await request(app)
      .post('/auth/doctor/login')
      .send({
        username: 'dr_bm_a',
        password: 'Doctor123!',
      });
    expect(loginRes.status).toBe(200);
    const doctorToken = loginRes.body.data.access_token;

    const res = await request(app)
      .post('/api/encounters')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        booking_id: bookingId,
        complaint: 'Sakit gigi',
      });
    if (res.status !== 201) {
      console.log('❌ Start encounter failed!');
      console.log('Status:', res.status);
      console.log('Response body:', JSON.stringify(res.body, null, 2));
    }
    expect(res.status).toBe(201);
    encounterId = res.body.data.id;
    expect(encounterId).toBeDefined();
  });

  test('7. Doctor records diagnosis', async () => {
    const loginRes = await request(app)
      .post('/auth/doctor/login')
      .send({
        username: 'dr_bm_a',
        password: 'Doctor123!',
      });
    expect(loginRes.status).toBe(200);
    const doctorToken = loginRes.body.data.access_token;

    const res = await request(app)
      .put(`/api/encounters/${encounterId}`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        diagnosis: 'Karies gigi',
        treatment: 'Filling',
        notes: 'Kontrol 3 bulan',
      });
    if (res.status !== 200) {
      console.log('❌ Record diagnosis failed!');
      console.log('Status:', res.status);
      console.log('Response body:', JSON.stringify(res.body, null, 2));
    }
    expect(res.status).toBe(200);
  });

  test('8. Doctor completes encounter → invoice auto-generated', async () => {
    const loginRes = await request(app)
      .post('/auth/doctor/login')
      .send({
        username: 'dr_bm_a',
        password: 'Doctor123!',
      });
    expect(loginRes.status).toBe(200);
    const doctorToken = loginRes.body.data.access_token;

    const res = await request(app)
      .post(`/api/encounters/${encounterId}/complete`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({});
    if (res.status !== 200) {
      console.log('❌ Complete encounter failed!');
      console.log('Status:', res.status);
      console.log('Response body:', JSON.stringify(res.body, null, 2));
    }
    expect(res.status).toBe(200);
    invoiceId = res.body.data.invoice_id;
    expect(invoiceId).toBeDefined();
  });

  test('9. Admin marks invoice as paid', async () => {
    const loginRes = await request(app)
      .post('/auth/admin/login')
      .send({
        username: 'admin_a',
        password: 'Admin123!',
      });
    expect(loginRes.status).toBe(200);
    const adminToken = loginRes.body.data.access_token;

    const res = await request(app)
      .post(`/api/admin/invoices/${invoiceId}/mark-paid`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        payment_method: 'CASH',
        paid_amount: 200000,
        notes: 'Integration test',
      });
    if (res.status !== 200) {
      console.log('❌ Mark paid failed!');
      console.log('Status:', res.status);
      console.log('Response body:', JSON.stringify(res.body, null, 2));
    }
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PAID');
  });
});

describe('Walk-in Flow', () => {
  test('Admin creates walk-in patient', async () => {
    const loginRes = await request(app)
      .post('/auth/admin/login')
      .send({
        username: 'admin_a',
        password: 'Admin123!',
      });
    expect(loginRes.status).toBe(200);
    const adminToken = loginRes.body.data.access_token;

    const testData = await getTestData();
    const res = await request(app)
      .post('/api/admin/check-in/walk-in')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        pasien_name: 'Walk-in Test',
        pasien_phone: '+6281234567899',
        doctor_id: testData.doctorId,
        branch_id: testData.branchId,
      });
    if (res.status !== 201) {
      console.log('❌ Walk-in failed!');
      console.log('Status:', res.status);
      console.log('Response body:', JSON.stringify(res.body, null, 2));
    }
    expect(res.status).toBe(201);
    expect(res.body.data.queue_number).toBeDefined();
  });
});

describe('Multi-tenant Isolation', () => {
  test('Admin from Branch A cannot access Branch B booking', async () => {
    const loginRes = await request(app)
      .post('/auth/admin/login')
      .send({
        username: 'admin_a',
        password: 'Admin123!',
      });
    expect(loginRes.status).toBe(200);
    const adminToken = loginRes.body.data.access_token;

    const res = await request(app)
      .get('/api/admin/bookings/999')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ branch_id: 'B' });
    if (res.status !== 403) {
      console.log('❌ Multi-tenant isolation failed!');
      console.log('Status:', res.status);
      console.log('Response body:', JSON.stringify(res.body, null, 2));
    }
    expect(res.status).toBe(403);
  });
});
TEST_EOF

echo "✅ Test file updated with debug logs (phone → phone)"
echo ""
echo "========================================="
echo " RUNNING DEBUG INTEGRATION TESTS"
echo "========================================="
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit

echo ""
echo "========================================="
echo " ✅ DEBUG DONE - CHECK OUTPUT ABOVE"
echo "========================================="
