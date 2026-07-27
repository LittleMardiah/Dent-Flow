#!/bin/bash
set -e

echo "========================================="
echo " FIX DOCTOR ID (use doctor_id from doctors table)"
echo "========================================="

# Ambil doctor_id yang benar dari database
DOCTOR_RECORD_ID=$(docker exec -i dentflow-db psql -U dentflow_user -d dentflow -t -c "SELECT id FROM doctors WHERE user_id = '965dedad-11ba-46a3-a402-f88c2029c676' LIMIT 1;" | tr -d ' ')

if [ -z "$DOCTOR_RECORD_ID" ]; then
  echo "❌ Doctor record not found! Trying to get any doctor ID..."
  DOCTOR_RECORD_ID=$(docker exec -i dentflow-db psql -U dentflow_user -d dentflow -t -c "SELECT id FROM doctors LIMIT 1;" | tr -d ' ')
fi

if [ -z "$DOCTOR_RECORD_ID" ]; then
  echo "❌ No doctor found in database! Aborting."
  exit 1
fi

echo "✅ Doctor record ID: $DOCTOR_RECORD_ID"

# Backup test file
cp tests/integration/booking-flow.e2e.test.ts tests/integration/booking-flow.e2e.test.ts.bak

# Ganti doctorId di testData.doctorId menjadi DOCTOR_RECORD_ID
# Ubah bagian where testData.doctorId didefinisikan
sed -i "s/testData.doctorId/'$DOCTOR_RECORD_ID'/g" tests/integration/booking-flow.e2e.test.ts

# Tapi hati-hati: kita juga perlu ubah di bagian getTestData agar return doctor record ID, bukan user ID
# Kita akan override getTestData langsung
cat > /tmp/fix-testdata-patch.js << 'PATCH_EOF'
// Patch getTestData to return doctor record ID instead of user ID
const fs = require('fs');
const path = './tests/integration/booking-flow.e2e.test.ts';
let content = fs.readFileSync(path, 'utf8');

// Replace doctorRes query to get doctor ID from doctors table
content = content.replace(
  /const doctorRes = await pool\.query\(\s*"SELECT id FROM users WHERE username = 'dr_bm_a' AND role = 'DOCTOR' LIMIT 1"\);/,
  `const doctorRes = await pool.query(
    "SELECT d.id FROM doctors d JOIN users u ON d.user_id = u.id WHERE u.username = 'dr_bm_a' LIMIT 1"
  );`
);

// Also handle the case where doctorRes might be used for user ID
content = content.replace(
  /doctorId: doctorRes\.rows\[0\]\?\.id,/,
  'doctorId: doctorRes.rows[0]?.id,'
);

fs.writeFileSync(path, content);
console.log('✅ getTestData patched to return doctor record ID');
PATCH_EOF

node /tmp/fix-testdata-patch.js

echo "✅ Test file updated."

# Tampilkan perubahan
echo "--- Perubahan ---"
diff tests/integration/booking-flow.e2e.test.ts.bak tests/integration/booking-flow.e2e.test.ts || echo "Tidak ada perubahan (mungkin sudah fixed)."
echo "-----------------"

# Jalankan integration test
echo "Running integration test..."
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit

echo "========================================="
echo " ✅ DONE"
echo "========================================="
