#!/bin/bash
set -e

echo "========================================="
echo " FIX branch_id → branchId"
echo "========================================="

# Backup test file
cp tests/integration/booking-flow.e2e.test.ts tests/integration/booking-flow.e2e.test.ts.bak

# Ganti branch_id: → branchId:
sed -i 's/branch_id:/branchId:/g' tests/integration/booking-flow.e2e.test.ts

echo "✅ branch_id → branchId fixed."

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
