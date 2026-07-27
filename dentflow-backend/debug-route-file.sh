#!/bin/bash
set -e

echo "========================================="
echo " DEBUG DOCTOR SLOT ROUTES"
echo "========================================="

echo ""
echo "[1/4] Menampilkan isi src/routes/doctorSlot.routes.ts (line 10-30)..."
cat -n src/routes/doctorSlot.routes.ts | sed -n '10,30p'

echo ""
echo "[2/4] Mencari router.get atau router.route yang mengandung 'availability'..."
grep -n "availability" src/routes/doctorSlot.routes.ts

echo ""
echo "[3/4] Menghapus cache Jest (biar perubahan kode kebaca)..."
npx jest --clearCache
echo "✅ Cache cleared"

echo ""
echo "[4/4] Menjalankan integration test lagi..."
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit
