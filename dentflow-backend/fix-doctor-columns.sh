#!/bin/bash
set -e

echo "========================================="
echo " FIX DOCTOR COLUMN NAMES"
echo "========================================="

# Backup
cp src/services/doctorSchedule.service.ts src/services/doctorSchedule.service.ts.bak

# 1. Fix doctor_leaves query: dokter_id → doctor_id
echo "[1/3] Fix doctor_leaves query (dokter_id → doctor_id)..."
sed -i 's/WHERE dokter_id = \$1 AND branch_id = \$2/WHERE doctor_id = $1 AND branch_id = $2/g' src/services/doctorSchedule.service.ts

# 2. Fix bookings query: dokter_id → doctor_id
echo "[2/3] Fix bookings query (dokter_id → doctor_id)..."
sed -i 's/WHERE dokter_id = \$1 AND branch_id = \$3/WHERE doctor_id = $1 AND branch_id = $3/g' src/services/doctorSchedule.service.ts

# 3. Pastikan query doctor_schedules tetap pakai dokter_id (tidak berubah)
echo "[3/3] Memastikan doctor_schedules tetap pakai dokter_id..."
# Tidak perlu diubah

echo "✅ Changes applied."

# Tampilkan perubahan
echo "--- Changes made ---"
diff src/services/doctorSchedule.service.ts.bak src/services/doctorSchedule.service.ts || echo "No differences found."
echo "-------------------"

# Jalankan integration test
echo "Running integration test..."
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit

echo "========================================="
echo " ✅ DONE"
echo "========================================="
