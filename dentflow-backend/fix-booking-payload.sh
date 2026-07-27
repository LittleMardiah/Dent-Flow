#!/bin/bash
set -e

echo "========================================="
echo " FIX BOOKING PAYLOAD (camelCase)"
echo "========================================="

# Backup test file
cp tests/integration/booking-flow.e2e.test.ts tests/integration/booking-flow.e2e.test.ts.bak

# Ganti snake_case → camelCase di payload booking
sed -i 's/doctor_id:/doctorId:/g' tests/integration/booking-flow.e2e.test.ts
sed -i 's/booking_date:/bookingDate:/g' tests/integration/booking-flow.e2e.test.ts
sed -i 's/session_slot_id:/sessionSlotId:/g' tests/integration/booking-flow.e2e.test.ts

echo "✅ Payload fields fixed."

# Tampilkan perubahan
echo "--- Perubahan ---"
diff tests/integration/booking-flow.e2e.test.ts.bak tests/integration/booking-flow.e2e.test.ts || echo "Tidak ada perubahan (mungkin sudah fixed)."
echo "-----------------"

# Jalankan integration test
echo "Running integration test..."
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit

echo "========================================="
echo " ✅ DONE"
echo "========================================="
