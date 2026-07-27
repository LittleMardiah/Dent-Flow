#!/bin/bash
set -e

echo "========================================="
echo " FIX ROUTING + INTEGRATION TEST"
echo "========================================="

# 1. Cari file yang mengandung route /api/doctors/:id/availability
echo "[1/3] Mencari file routing..."
ROUTING_FILE=$(grep -rl "/doctors/:id/availability" src/routes/ 2>/dev/null | head -1)
if [ -z "$ROUTING_FILE" ]; then
  ROUTING_FILE=$(grep -rl "/doctors/:id/availability" src/ 2>/dev/null | head -1)
fi

if [ -z "$ROUTING_FILE" ]; then
  echo "❌ File routing tidak ditemukan! Coba cari manual."
  exit 1
fi

echo "✅ Ditemukan: $ROUTING_FILE"

# 2. Perbaiki role middleware
echo "[2/3] Memperbaiki role middleware di $ROUTING_FILE..."
# Cari baris yang mengandung roleMiddleware dan ADMIN_BRANCH
# Ganti dengan roleMiddleware(['ADMIN_BRANCH', 'PATIENT', 'DOCTOR'])
sed -i 's/roleMiddleware(\[["'\'']ADMIN_BRANCH["'\'']\])/roleMiddleware(['\''ADMIN_BRANCH'\'', '\''PATIENT'\'', '\''DOCTOR'\''])/g' "$ROUTING_FILE"

# Alternatif: jika formatnya beda
sed -i 's/roleMiddleware(\[["'\'']ADMIN_BRANCH["'\'']\])/roleMiddleware(['\''ADMIN_BRANCH'\'', '\''PATIENT'\'', '\''DOCTOR'\''])/g' "$ROUTING_FILE"

# Atau jika pakai string array: roleMiddleware(['ADMIN_BRANCH'])
sed -i 's/roleMiddleware(\[['\''"]ADMIN_BRANCH['\''"]\])/roleMiddleware(['\''ADMIN_BRANCH'\'', '\''PATIENT'\'', '\''DOCTOR'\''])/g' "$ROUTING_FILE"

echo "✅ Role middleware updated."

# 3. Jalankan integration test
echo "[3/3] Menjalankan integration test..."
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit

echo ""
echo "========================================="
echo " ✅ SELESAI"
echo "========================================="
