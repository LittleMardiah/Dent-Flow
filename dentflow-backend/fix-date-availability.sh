#!/bin/bash
set -e

echo "========================================="
echo " FIX DATE: Use available day_of_week"
echo "========================================="

# Backup
cp tests/integration/booking-flow.e2e.test.ts tests/integration/booking-flow.e2e.test.ts.bak.date

# Rewrite test to dynamically find available date
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
  const userDoctorRes = await pool.query(
    "SELECT id FROM users WHERE username = 'dr_bm_a' AND role = 'DOCTOR' LIMIT 1"
  );
  const doctorRecordRes = await pool.query(
    "SELECT id FROM doctors WHERE user_id = $1 LIMIT 1",
    [userDoctorRes.rows[0]?.id]
  );
  // Get available days of week from doctor_schedules
  const scheduleDaysRes = await pool.query(
    "SELECT DISTINCT day_of_week FROM doctor_schedules WHERE dokter_id = $1 AND is_active = true",
    [userDoctorRes.rows[0]?.id]
  );
  await pool.end();
  return {
    branchId: branchRes.rows[0]?.id,
    userDoctorId: userDoctorRes.rows[0]?.id,
    doctorRecordId: doctorRecordRes.rows[0]?.id,
    availableDays: scheduleDaysRes.rows.map(row => row.day_of_week),
  };
};

const getNextAvailableDate = (availableDays: number[]) => {
  const now = new Date();
  // Start from tomorrow
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  // Loop until we find a day that matches availableDays
  for (let i = 0; i < 30; i++) {
    const day = date.getDay();
    if (availableDays.includes(day)) {
      return date;
    }
    date.setDate(date.getDate() + 1);
  }
  throw new Error('No available date found in next 30 days');
};

describe('E2E Booking Flow', () => {
  let patientToken: string;
  let bookingId: string;
  let bookingCode: string;
  let queueId: string;
  let encounterId: string;
  let invoiceId: string;
  let testData: any;
  let bookingDate: Date;
  let dateStr: string;

  beforeAll(async () => {
    testData = await getTestData();
    expect(testData.branchId).toBeDefined();
    expect(testData.userDoctorId).toBeDefined();
    expect(testData.doctorRecordId).toBeDefined();
    expect(testData.availableDays.length).toBeGreaterThan(0);
    bookingDate = getNextAvailableDate(testData.availableDays);
    dateStr = bookingDate.toISOString().split('T')[0];
    console.log('📅 Selected date:', dateStr, 'day_of_week:', bookingDate.getDay());
  });

  test('1. Login as budi_santoso (seed patient)', async () => {
    const res = await request(app)
      .post('/auth/patient/login')
      .send({
        username: 'budi_santoso',
        password: 'Patient123!',
      });
    console.log('🔍 Login response:', JSON.stringify(res.body, null, 2));
    expect(res.status).toBe(200);
    patientToken = res.body.data.token;
    expect(patientToken).toBeDefined();
  });

  test('2. Get doctor availability', async () => {
    const res = await request(app)
      .get(`/api/doctors/${testData.userDoctorId}/availability`)
      .query({ date: dateStr, branch_id: testData.branchId })
      .set('Authorization', `Bearer ${patientToken}`);
    console.log('🔍 Availability response:', JSON.stringify(res.body, null, 2));
    expect(res.status).toBe(200);
    expect(res.body.data.slots.length).toBeGreaterThan(0);
  });

  test('3. Create booking', async () => {
    const availRes = await request(app)
      .get(`/api/doctors/${testData.userDoctorId}/availability`)
      .query({ date: dateStr, branch_id: testData.branchId })
      .set('Authorization', `Bearer ${patientToken}`);
    expect(availRes.status).toBe(200);
    const slots = availRes.body.data.slots;
    expect(slots.length).toBeGreaterThan(0);
    const slotId = slots[0].start;
    console.log("📦 Payload:", JSON.stringify({ branchId: testData.branchId, doctorId: testData.userDoctorId, bookingDate: dateStr, sessionSlotId: slotId }, null, 2));
    const res = await request(app)
      .post('/api/patient/bookings')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        branchId: testData.branchId,
        doctorId: testData.userDoctorId,
        bookingDate: dateStr,
        sessionSlotId: slotId,
      });
    console.log('🔍 Booking response:', JSON.stringify(res.body, null, 2));
    expect(res.status).toBe(201);
    bookingId = res.body.data.id;
    bookingCode = res.body.data.check_in_code || res.body.data.booking_code;
    expect(bookingCode).toBeDefined();
  });

  test('4. Admin checks-in patient', async () => {
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
    console.log('🔍 Check-in response:', JSON.stringify(res.body, null, 2));
    expect(res.status).toBe(200);
    queueId = res.body.data.queue_id || res.body.data.id;
    expect(queueId).toBeDefined();
  });

  test('5. Doctor starts encounter', async () => {
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
    console.log('🔍 Start encounter response:', JSON.stringify(res.body, null, 2));
    expect(res.status).toBe(201);
    encounterId = res.body.data.id;
    expect(encounterId).toBeDefined();
  });

  test('6. Doctor records diagnosis', async () => {
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
    console.log('🔍 Record diagnosis response:', JSON.stringify(res.body, null, 2));
    expect(res.status).toBe(200);
  });

  test('7. Doctor completes encounter → invoice auto-generated', async () => {
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
    console.log('🔍 Complete encounter response:', JSON.stringify(res.body, null, 2));
    expect(res.status).toBe(200);
    invoiceId = res.body.data.invoice_id;
    expect(invoiceId).toBeDefined();
  });

  test('8. Admin marks invoice as paid', async () => {
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
    console.log('🔍 Mark paid response:', JSON.stringify(res.body, null, 2));
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
        doctor_id: testData.doctorRecordId,
        branch_id: testData.branchId,
      });
    console.log('🔍 Walk-in response:', JSON.stringify(res.body, null, 2));
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
    console.log('🔍 Multi-tenant isolation response:', JSON.stringify(res.body, null, 2));
    expect(res.status).toBe(403);
  });
});
TEST_EOF

echo "✅ Test file updated with dynamic date selection based on doctor schedule."

echo "========================================="
echo " RUNNING INTEGRATION TESTS"
echo "========================================="
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit

echo "========================================="
echo " ✅ DONE"
echo "========================================="
