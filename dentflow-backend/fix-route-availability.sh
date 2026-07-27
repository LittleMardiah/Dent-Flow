#!/bin/bash
set -e

echo "========================================="
echo " FIX ROUTE AVAILABILITY (doctorSlot.routes.ts)"
echo "========================================="

# 1. Cari file yang mengandung roleMiddleware dan /availability
echo "[1/3] Mencari file route yang mengandung '/availability'..."
ROUTE_FILE=$(grep -rl "/availability" src/routes/ | head -1)
if [ -z "$ROUTE_FILE" ]; then
  echo "❌ Tidak ditemukan file route dengan /availability di src/routes/"
  exit 1
fi
echo "✅ Ditemukan: $ROUTE_FILE"

# 2. Tampilkan baris yang mengandung roleMiddleware di file tersebut
echo "[2/3] Baris yang mengandung roleMiddleware di $ROUTE_FILE:"
grep -n "roleMiddleware" "$ROUTE_FILE" || echo "Tidak ada roleMiddleware di file ini."

# 3. Ganti roleMiddleware(['ADMIN_BRANCH']) menjadi roleMiddleware(['ADMIN_BRANCH', 'PATIENT', 'DOCTOR'])
echo "[3/3] Mengganti roleMiddleware..."
# Backup dulu
cp "$ROUTE_FILE" "$ROUTE_FILE.bak"

# Sed pattern: replace roleMiddleware(['ADMIN_BRANCH']) with roleMiddleware(['ADMIN_BRANCH', 'PATIENT', 'DOCTOR'])
# Menangani variasi penulisan (spasi, single quote, double quote)
sed -i "s/roleMiddleware(\['ADMIN_BRANCH'\]/roleMiddleware(['ADMIN_BRANCH', 'PATIENT', 'DOCTOR']/g" "$ROUTE_FILE"
sed -i 's/roleMiddleware(\["ADMIN_BRANCH"\])/roleMiddleware(["ADMIN_BRANCH", "PATIENT", "DOCTOR"])/g' "$ROUTE_FILE"
sed -i "s/roleMiddleware(\[['\"]ADMIN_BRANCH['\"]\])/roleMiddleware(['ADMIN_BRANCH', 'PATIENT', 'DOCTOR'])/g" "$ROUTE_FILE"

echo "✅ File $ROUTE_FILE telah diperbarui."

# Tampilkan perubahan
echo "--- Perubahan ---"
diff "$ROUTE_FILE.bak" "$ROUTE_FILE" || echo "Tidak ada perubahan terdeteksi (mungkin sudah sesuai)."
echo "-----------------"

# 4. Jalankan integration test
echo "========================================="
echo " RUNNING INTEGRATION TESTS"
echo "========================================="
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit

echo ""
echo "========================================="
echo " ✅ SELESAI"
echo "========================================="
