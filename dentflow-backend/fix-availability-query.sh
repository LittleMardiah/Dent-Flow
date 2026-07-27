#!/bin/bash
set -e

echo "========================================="
echo " FIX AVAILABILITY QUERY (branch_id → branchId)"
echo "========================================="

# Backup test file
cp tests/integration/booking-flow.e2e.test.ts tests/integration/booking-flow.e2e.test.ts.bak

# Hanya di baris yang mengandung '/api/doctors/.../availability', ganti branchId: → branch_id:
# Atau lebih aman: ganti di query object untuk availability
sed -i 's/query({ date: dateStr, branchId: testData.branchId })/query({ date: dateStr, branch_id: testData.branchId })/g' tests/integration/booking-flow.e2e.test.ts

echo "✅ Availability query fixed (branch_id restored)."

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
