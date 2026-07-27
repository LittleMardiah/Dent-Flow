#!/bin/bash
set -e

echo "========================================="
echo " FIX getTestData: Return userId AND recordId"
echo "========================================="

# Backup
cp tests/integration/booking-flow.e2e.test.ts tests/integration/booking-flow.e2e.test.ts.bak

# Patch getTestData function
cat > /tmp/patch-testdata.js << 'PATCH_EOF'
const fs = require('fs');
const path = './tests/integration/booking-flow.e2e.test.ts';
let content = fs.readFileSync(path, 'utf8');

// Replace getTestData to return both userDoctorId and doctorRecordId
const newGetTestData = `
const getTestData = async () => {
  const pool = new Pool({ connectionString: config.database.url });
  const branchRes = await pool.query(
    "SELECT id FROM branches WHERE name = 'Cabang A' LIMIT 1"
  );
  const userDoctorRes = await pool.query(
    "SELECT id FROM users WHERE username = 'dr_bm_a' AND role = 'DOCTOR' LIMIT 1"
  );
  const doctorRecordRes = await pool.query(
    "SELECT id FROM doctors WHERE user_id = $1 LIMIT 1",
    [userDoctorRes.rows[0]?.id]
  );
  await pool.end();
  return {
    branchId: branchRes.rows[0]?.id,
    userDoctorId: userDoctorRes.rows[0]?.id,
    doctorRecordId: doctorRecordRes.rows[0]?.id,
  };
};
`;

// Find and replace the old getTestData function
content = content.replace(
  /const getTestData = async \(\) => \{[\s\S]*?^\};/m,
  newGetTestData
);

// Also replace usage: testData.doctorId → testData.userDoctorId (for availability)
content = content.replace(/testData\.doctorId/g, (match, offset) => {
  // Only replace in availability calls, not in booking
  return 'testData.userDoctorId';
});

// But we need to be more precise: replace only in availability endpoint
content = content.replace(
  /\/api\/doctors\/\$\{testData\.userDoctorId\}\/availability/g,
  '/api/doctors/${testData.userDoctorId}/availability'
);

// For booking payload, use doctorRecordId
content = content.replace(
  /doctorId: testData\.userDoctorId,/g,
  'doctorId: testData.doctorRecordId,'
);

fs.writeFileSync(path, content);
console.log('✅ getTestData patched to return both userDoctorId and doctorRecordId');
console.log('✅ Availability uses userDoctorId, booking uses doctorRecordId');
PATCH_EOF

node /tmp/patch-testdata.js

echo "✅ Test file updated."

# Tampilkan perubahan
echo "--- Perubahan ---"
diff tests/integration/booking-flow.e2e.test.ts.bak tests/integration/booking-flow.e2e.test.ts || echo "Tidak ada perubahan."
echo "-----------------"

# Jalankan integration test
echo "Running integration test..."
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit

echo "========================================="
echo " ✅ DONE"
echo "========================================="
