#!/bin/bash
set -e

echo "========================================="
echo " FIND ALL ROUTES FOR /doctors/:id/availability"
echo "========================================="

echo ""
echo "[1/5] Mencari semua file yang mengandung '/doctors/:id/availability'..."
grep -rn "/doctors/:id/availability" src/ --include="*.ts" | grep -v "node_modules" || echo "Tidak ditemukan"

echo ""
echo "[2/5] Mencari semua file yang mengandung 'doctorId' dan 'availability' di routes..."
grep -rn "doctorId.*availability" src/routes/ --include="*.ts" | grep -v "node_modules" || echo "Tidak ditemukan"

echo ""
echo "[3/5] Mencari route yang menggunakan 'app.use' dengan path '/doctors' di index.ts..."
grep -n "app.use.*/doctors" src/index.ts || echo "Tidak ditemukan"

echo ""
echo "[4/5] Mencari semua route dengan method GET dan path 'doctors' di routes..."
grep -rn "get.*doctors" src/routes/ --include="*.ts" | grep -v "node_modules" || echo "Tidak ditemukan"

echo ""
echo "[5/5] Mencari semua file yang mengandung 'roleMiddleware' dan 'availability'..."
grep -rn "roleMiddleware.*availability" src/ --include="*.ts" | grep -v "node_modules" || echo "Tidak ditemukan"
