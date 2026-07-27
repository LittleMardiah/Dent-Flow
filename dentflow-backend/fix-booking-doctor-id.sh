#!/bin/bash
set -e

echo "========================================="
echo " FIX BOOKING DOCTOR ID TO RECORD ID"
echo "========================================="

# Backup test file
cp tests/integration/booking-flow.e2e.test.ts tests/integration/booking-flow.e2e.test.ts.bak

# Ganti di payload booking: doctorId: testData.doctorId → doctorId: testData.doctorRecordId
sed -i 's/doctorId: testData\.doctorId,/doctorId: testData.doctorRecordId,/g' tests/integration/booking-flow.e2e.test.ts

echo "✅ Booking doctor ID changed to doctorRecordId."

# Tampilkan perubahan
echo "--- Perubahan ---"
diff tests/integration/booking-flow.e2e.test.ts.bak tests/integration/booking-flow.e2e.test.ts || echo "Tidak ada perubahan."
echo "-----------------"

# Jalankan integration test
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit

echo "========================================="
echo " ✅ DONE"
echo "========================================="
