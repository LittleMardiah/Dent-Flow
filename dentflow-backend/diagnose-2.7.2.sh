#!/bin/bash
set -e

echo "========================================="
echo " 🔍 DIAGNOSIS TASK 2.7.2"
echo "========================================="

echo ""
echo "[1/4] CEK ROUTE REGISTRATION di src/index.ts..."
echo "---"
grep -n "app.use.*booking" src/index.ts || echo "❌ Booking route TIDAK DITEMUKAN!"
grep -n "app.use.*patient" src/index.ts || echo "❌ Patient route TIDAK DITEMUKAN!"
echo "---"

echo ""
echo "[2/4] CEK QUERY DoctorQueueService..."
echo "---"
grep -A 10 "getQueueForDoctor" src/services/doctorQueue.service.ts | grep -E "SELECT|FROM|JOIN|WHERE" || echo "❌ Query tidak ditemukan!"
echo "---"

echo ""
echo "[3/4] CEK SCHEMA users (via database)..."
docker exec -i dentflow-db psql -U dentflow_user -d dentflow -c "\\d users" 2>/dev/null || echo "⚠️  Database tidak running atau schema tidak bisa diakses"
echo "---"

echo ""
echo "[4/4] CEK AUDIT LOG FK..."
echo "Cek foreign key audit_logs:"
docker exec -i dentflow-db psql -U dentflow_user -d dentflow -c "SELECT conname, confrelid::regclass FROM pg_constraint WHERE conrelid = 'audit_logs'::regclass AND contype = 'f';" 2>/dev/null || echo "⚠️  Tidak bisa cek FK"
echo "---"

echo ""
echo "✅ DIAGNOSIS SELESAI. Kirim output ini ke gua."
