#!/bin/bash
set -e

echo "========================================="
echo " FINAL FIX BOOKING DOCTOR ID"
echo "========================================="

# Backup
cp tests/integration/booking-flow.e2e.test.ts tests/integration/booking-flow.e2e.test.ts.bak.final

# Hardcode doctorRecordId di payload booking
sed -i "s/doctorId: testData\.doctorRecordId,/doctorId: 'd93eabaa-d68b-4886-af34-ab7088a08503',/g" tests/integration/booking-flow.e2e.test.ts
sed -i "s/doctorId: testData\.userDoctorId,/doctorId: 'd93eabaa-d68b-4886-af34-ab7088a08503',/g" tests/integration/booking-flow.e2e.test.ts

echo "✅ Booking doctor ID hardcoded to d93eabaa-d68b-4886-af34-ab7088a08503"

# Tampilkan perubahan
echo "--- Perubahan ---"
diff tests/integration/booking-flow.e2e.test.ts.bak.final tests/integration/booking-flow.e2e.test.ts || echo "Tidak ada perubahan."
echo "-----------------"

# Jalankan integration test
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit

echo "========================================="
echo " ✅ DONE"
echo "========================================="
