#!/bin/bash
set -e

echo "========================================="
echo " FIX BOOKING SLOT: id → start"
echo "========================================="

# Backup test file
cp tests/integration/booking-flow.e2e.test.ts tests/integration/booking-flow.e2e.test.ts.bak

# Ganti const slotId = slots[0].id; → const slotId = slots[0].start;
sed -i 's/const slotId = slots\[0\]\.id;/const slotId = slots[0].start;/' tests/integration/booking-flow.e2e.test.ts

# Tambahkan console.log untuk debugging payload (opsional)
sed -i '/console.log(.🔍 Booking response:/i \
  console.log("📦 Payload:", JSON.stringify({ branchId: testData.branchId, doctorId: testData.doctorId, bookingDate: dateStr, sessionSlotId: slotId }, null, 2));' tests/integration/booking-flow.e2e.test.ts

echo "✅ Slot ID fixed (now using start time)."

# Tampilkan perubahan
echo "--- Perubahan ---"
diff tests/integration/booking-flow.e2e.test.ts.bak tests/integration/booking-flow.e2e.test.ts || echo "Tidak ada perubahan."
echo "-----------------"

# Jalankan integration test
echo "Running integration test..."
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit

echo "========================================="
echo " ✅ DONE"
echo "========================================="
