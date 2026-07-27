#!/bin/bash
set -e

echo "========================================="
echo " INSPECT AUTH MIDDLEWARE"
echo "========================================="

echo ""
echo "[1/2] Menampilkan seluruh isi src/middleware/authMiddleware.ts..."
cat -n src/middleware/authMiddleware.ts

echo ""
echo "[2/2] Mencari definisi roleMiddleware..."
grep -n "roleMiddleware" src/middleware/authMiddleware.ts
