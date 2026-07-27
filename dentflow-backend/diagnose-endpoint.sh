#!/bin/bash
set -e

echo "========================================="
echo " DIAGNOSE ENDPOINT AVAILABILITY"
echo "========================================="

echo ""
echo "[1/4] Cek semua proses Node yang jalan..."
ps aux | grep -E "node|ts-node|nodemon" | grep -v grep || echo "Tidak ada proses Node ditemukan."

echo ""
echo "[2/4] Cek apakah ada server jalan di port 3000..."
curl -s http://localhost:3000/health > /dev/null && echo "✅ Server jalan di port 3000" || echo "❌ Server TIDAK jalan di port 3000"

echo ""
echo "[3/4] Test endpoint availability dengan token patient..."
# Daftar dulu pakai email unik
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:3000/auth/patient/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "diagnose-test@example.com",
    "password": "Test123!",
    "fullName": "Diagnose Test",
    "phone": "+6281234567890"
  }')

TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.data.token')
if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
  echo "✅ Berhasil register & dapat token."
  echo ""
  echo "Test GET /api/doctors/965dedad-11ba-46a3-a402-f88c2029c676/availability?date=$(date -d '+7 days' +%Y-%m-%d)&branch_id=494a607c-d109-4330-a3a9-68f54326f0c7"
  curl -s -X GET "http://localhost:3000/api/doctors/965dedad-11ba-46a3-a402-f88c2029c676/availability?date=$(date -d '+7 days' +%Y-%m-%d)&branch_id=494a607c-d109-4330-a3a9-68f54326f0c7" \
    -H "Authorization: Bearer $TOKEN" \
    | jq .
else
  echo "❌ Gagal register atau token tidak valid."
  echo "Response register: $REGISTER_RESPONSE"
fi

echo ""
echo "[4/4] Cek isi file src/routes/doctorSlot.routes.ts (line 10-16)..."
head -16 src/routes/doctorSlot.routes.ts | tail -7
