#!/bin/bash
set -e

echo "========================================="
echo " FIX QUERY doctor_schedules (doctor_id → dokter_id)"
echo "========================================="

# Backup
cp src/services/doctorSchedule.service.ts src/services/doctorSchedule.service.ts.bak

# Ganti hanya di query doctor_schedules (line 46)
sed -i '46s/doctor_id = \$1 AND branch_id = \$2/dokter_id = $1 AND branch_id = $2/' src/services/doctorSchedule.service.ts

echo "✅ Query fixed."

# Tampilkan perubahan
echo "--- Perubahan ---"
diff src/services/doctorSchedule.service.ts.bak src/services/doctorSchedule.service.ts || echo "Tidak ada perubahan (mungkin sudah fixed)."
echo "-----------------"

# Jalankan integration test
echo "Running integration test..."
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit

echo "========================================="
echo " ✅ DONE"
echo "========================================="
