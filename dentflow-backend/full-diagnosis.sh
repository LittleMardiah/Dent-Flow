#!/bin/bash
set -e

echo "========================================="
echo " FULL DIAGNOSIS FOR TASK 2.7.2"
echo "========================================="

echo ""
echo "[1/7] Schema users (kolom apa aja)"
docker exec -i dentflow-db psql -U dentflow_user -d dentflow -c "\d users"

echo ""
echo "[2/7] Isi tabel branches"
docker exec -i dentflow-db psql -U dentflow_user -d dentflow -c "SELECT id, name FROM branches LIMIT 5;"

echo ""
echo "[3/7] Isi tabel users (role DOCTOR)"
docker exec -i dentflow-db psql -U dentflow_user -d dentflow -c "SELECT id, username, role FROM users WHERE role = 'DOCTOR' LIMIT 5;"

echo ""
echo "[4/7] Isi tabel doctor_schedules"
docker exec -i dentflow-db psql -U dentflow_user -d dentflow -c "SELECT id, dokter_id, day_of_week, session_start, session_end FROM doctor_schedules LIMIT 5;"

echo ""
echo "[5/7] Isi src/index.ts (bagian route)"
grep -n "app.use" src/index.ts

echo ""
echo "[6/7] Isi DoctorQueueService query (baris SELECT)"
grep -A 5 "SELECT" src/services/doctorQueue.service.ts | head -20

echo ""
echo "[7/7] Cek ada tidaknya user dengan ID 00000000-0000-0000-0000-000000000000"
docker exec -i dentflow-db psql -U dentflow_user -d dentflow -c "SELECT id FROM users WHERE id = '00000000-0000-0000-0000-000000000000';"

echo ""
echo "✅ DIAGNOSIS SELESAI. Kirim output ini ke gua."
