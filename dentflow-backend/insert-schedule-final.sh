#!/bin/bash
set -e

echo "========================================="
echo " INSERT SCHEDULE for dr_bm_a (FINAL)"
echo "========================================="

# 1. Hapus semua schedule untuk dokter ini (kalau ada)
echo "[1/3] Menghapus schedule lama (jika ada)..."
docker exec -i dentflow-db psql -U dentflow_user -d dentflow << 'SQL_DELETE'
DELETE FROM doctor_schedules WHERE dokter_id = '965dedad-11ba-46a3-a402-f88c2029c676';
SQL_DELETE
echo "✅ Schedule lama dihapus (jika ada)."

# 2. Insert schedule baru (12 baris: Senin–Sabtu, 2 sesi)
echo "[2/3] Insert schedule baru..."
docker exec -i dentflow-db psql -U dentflow_user -d dentflow << 'SQL_INSERT'
INSERT INTO doctor_schedules (id, branch_id, dokter_id, day_of_week, session_start, session_end, max_patients_per_session, is_active)
VALUES
  (gen_random_uuid(), '494a607c-d109-4330-a3a9-68f54326f0c7', '965dedad-11ba-46a3-a402-f88c2029c676', 1, '09:00:00', '12:00:00', 4, true),
  (gen_random_uuid(), '494a607c-d109-4330-a3a9-68f54326f0c7', '965dedad-11ba-46a3-a402-f88c2029c676', 1, '13:00:00', '16:00:00', 4, true),
  (gen_random_uuid(), '494a607c-d109-4330-a3a9-68f54326f0c7', '965dedad-11ba-46a3-a402-f88c2029c676', 2, '09:00:00', '12:00:00', 4, true),
  (gen_random_uuid(), '494a607c-d109-4330-a3a9-68f54326f0c7', '965dedad-11ba-46a3-a402-f88c2029c676', 2, '13:00:00', '16:00:00', 4, true),
  (gen_random_uuid(), '494a607c-d109-4330-a3a9-68f54326f0c7', '965dedad-11ba-46a3-a402-f88c2029c676', 3, '09:00:00', '12:00:00', 4, true),
  (gen_random_uuid(), '494a607c-d109-4330-a3a9-68f54326f0c7', '965dedad-11ba-46a3-a402-f88c2029c676', 3, '13:00:00', '16:00:00', 4, true),
  (gen_random_uuid(), '494a607c-d109-4330-a3a9-68f54326f0c7', '965dedad-11ba-46a3-a402-f88c2029c676', 4, '09:00:00', '12:00:00', 4, true),
  (gen_random_uuid(), '494a607c-d109-4330-a3a9-68f54326f0c7', '965dedad-11ba-46a3-a402-f88c2029c676', 4, '13:00:00', '16:00:00', 4, true),
  (gen_random_uuid(), '494a607c-d109-4330-a3a9-68f54326f0c7', '965dedad-11ba-46a3-a402-f88c2029c676', 5, '09:00:00', '12:00:00', 4, true),
  (gen_random_uuid(), '494a607c-d109-4330-a3a9-68f54326f0c7', '965dedad-11ba-46a3-a402-f88c2029c676', 5, '13:00:00', '16:00:00', 4, true),
  (gen_random_uuid(), '494a607c-d109-4330-a3a9-68f54326f0c7', '965dedad-11ba-46a3-a402-f88c2029c676', 6, '09:00:00', '12:00:00', 4, true),
  (gen_random_uuid(), '494a607c-d109-4330-a3a9-68f54326f0c7', '965dedad-11ba-46a3-a402-f88c2029c676', 6, '13:00:00', '16:00:00', 4, true);
SQL_INSERT
echo "✅ Schedule inserted (12 rows)."

# 3. Verifikasi
echo "[3/3] Verifikasi schedule..."
docker exec -i dentflow-db psql -U dentflow_user -d dentflow -c "SELECT day_of_week, session_start, session_end, is_active FROM doctor_schedules WHERE dokter_id = '965dedad-11ba-46a3-a402-f88c2029c676' ORDER BY day_of_week, session_start;"

echo "========================================="
echo " RUNNING INTEGRATION TEST"
echo "========================================="
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit

echo "========================================="
echo " ✅ DONE"
echo "========================================="
