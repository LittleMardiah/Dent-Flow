#!/bin/bash
set -e

echo "========================================="
echo " TASK 2.7.3 - INTEGRATION TEST SUITE (FIXED)"
echo "========================================="

# 1. PASTIKAN FILE TEST ADA
echo "[1/4] Checking integration test file..."
if [ ! -f "tests/integration/booking-flow.e2e.test.ts" ]; then
  echo "❌ Test file not found! Creating it..."
  mkdir -p tests/integration
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

  beforeAll(async () => {
    testData = await getTestData();
    expect(testData.branchId).toBeDefined();
    expect(testData.doctorId).toBeDefined();
  });

  test('1. Login patient', async () => {
    const res = await request(app)
      .post('/auth/patient/login')
      .send({
        username: 'budi_santoso',
        password: 'Patient123!',
      });
    expect(res.status).toBe(200);
    patientToken = res.body.data.access_token;
    expect(patientToken).toBeDefined();
  });

  test('2. Create booking', async () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    const dateStr = date.toISOString().split('T')[0];
    const res = await request(app)
      .post('/api/patient/bookings')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        branch_id: testData.branchId,
        doctor_id: testData.doctorId,
        booking_date: dateStr,
        session_slot_id: '09:00',
      });
    expect(res.status).toBe(201);
    bookingId = res.body.data.id;
    bookingCode = res.body.data.check_in_code || res.body.data.booking_code;
    expect(bookingCode).toBeDefined();
  });

  test('3. Admin checks-in patient', async () => {
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
    expect(res.status).toBe(200);
    queueId = res.body.data.queue_id || res.body.data.id;
    expect(queueId).toBeDefined();
  });

  test('4. Doctor starts encounter', async () => {
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
    expect(res.status).toBe(201);
    encounterId = res.body.data.id;
    expect(encounterId).toBeDefined();
  });

  test('5. Doctor records diagnosis', async () => {
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
    expect(res.status).toBe(200);
  });

  test('6. Doctor completes encounter → invoice auto-generated', async () => {
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
    expect(res.status).toBe(200);
    invoiceId = res.body.data.invoice_id;
    expect(invoiceId).toBeDefined();
  });

  test('7. Admin marks invoice as paid', async () => {
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
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PAID');
  });
});
TEST_EOF
  echo "✅ Test file created"
else
  echo "✅ Test file already exists"
fi

# 2. JALANKAN INTEGRATION TEST (PAKAI --testPathPatterns)
echo "[2/4] Running integration tests with correct Jest flag..."
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit

# 3. UPDATE LOGBOOK
echo "[3/4] Updating LOGBOOK..."
cat >> LOGBOOK.txt << 'LOG_EOF'

Task 2.7.3 - Integration test suite (end-to-end booking flow)
Status: ✅ SELESAI

Fungsi:
- Menguji end-to-end flow bisnis: booking → check-in → encounter → invoice.
- Automation: 100% otomatis via Jest + supertest.

Apa yang dilakukan:
1. Buat integration test file dengan 7 test cases (full booking flow).
2. Jalankan integration test dengan Jest (--testPathPatterns).
3. Verifikasi semua test pass.

Hasil Verifikasi:
- ✅ 7 integration test cases dibuat.
- ✅ Semua test pass (0 failures).
- ✅ End-to-end flow berhasil (booking → invoice).
- ✅ Invoice auto-generated setelah encounter complete.

Catatan:
- Payment webhook dan NO-SHOW detection akan di-cover di integration test terpisah.

Referensi:
- TDD Section 5 (API Contract)
- STP Section 6 (Test Strategy)
LOG_EOF

# 4. TAMPILKAN HASIL
echo "[4/4] Done!"
echo ""
echo "========================================="
echo " ✅ TASK 2.7.3 COMPLETE"
echo "========================================="
echo "📁 Integration test: tests/integration/booking-flow.e2e.test.ts"
echo "📝 LOGBOOK updated"
echo ""
echo "📊 Coverage should now increase."
echo "Next: Task 2.7.4 - Database integrity & foreign key validation"
