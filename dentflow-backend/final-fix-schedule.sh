#!/bin/bash
set -e

echo "========================================="
echo " FINAL FIX: CLEAN & RE-INSERT SCHEDULE"
echo "========================================="

# 1. Hapus semua schedule untuk dokter ini
echo "[1/4] Menghapus semua schedule untuk dr_bm_a..."
docker exec -i dentflow-db psql -U dentflow_user -d dentflow << 'SQL'
DELETE FROM doctor_schedules WHERE dokter_id = '965dedad-11ba-46a3-a402-f88c2029c676';
SQL
echo "✅ Schedule dihapus."

# 2. Insert schedule baru (Senin–Sabtu, 2 sesi)
echo "[2/4] Insert schedule baru..."
docker exec -i dentflow-db psql -U dentflow_user -d dentflow << 'SQL'
INSERT INTO doctor_schedules (id, branch_id, dokter_id, day_of_week, session_start, session_end, max_patients_per_session, is_active)
SELECT gen_random_uuid(), '494a607c-d109-4330-a3a9-68f54326f0c7', '965dedad-11ba-46a3-a402-f88c2029c676', day_of_week, session_start, session_end, 4, true
FROM (
  VALUES 
    (1, '09:00:00', '12:00:00'),
    (1, '13:00:00', '16:00:00'),
    (2, '09:00:00', '12:00:00'),
    (2, '13:00:00', '16:00:00'),
    (3, '09:00:00', '12:00:00'),
    (3, '13:00:00', '16:00:00'),
    (4, '09:00:00', '12:00:00'),
    (4, '13:00:00', '16:00:00'),
    (5, '09:00:00', '12:00:00'),
    (5, '13:00:00', '16:00:00'),
    (6, '09:00:00', '12:00:00'),
    (6, '13:00:00', '16:00:00')
) AS v(day_of_week, session_start, session_end);
SQL
echo "✅ Schedule inserted."

# 3. Verifikasi schedule
echo "[3/4] Verifikasi schedule yang sekarang..."
docker exec -i dentflow-db psql -U dentflow_user -d dentflow -c "SELECT day_of_week, session_start, session_end, is_active FROM doctor_schedules WHERE dokter_id = '965dedad-11ba-46a3-a402-f88c2029c676' ORDER BY day_of_week;"

# 4. Jalankan integration test
echo "[4/4] Menjalankan integration test..."
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit

echo "========================================="
echo " ✅ SELESAI"
echo "========================================="
