#!/bin/bash
set -e

echo "========================================="
echo " FINAL FIX: Use correct branch ID in test"
echo "========================================="

# Ganti branchId di testData agar match dengan doctor
# Hardcode branchId = '494a607c-d109-4330-a3a9-68f54326f0c7'
sed -i "s/branchId: branchRes.rows\[0\]?.id,/branchId: '494a607c-d109-4330-a3a9-68f54326f0c7',/g" tests/integration/booking-flow.e2e.test.ts

# Juga di payload booking, pake doctorId user_id (bukan record id)
sed -i "s/doctorId: 'd93eabaa-d68b-4886-af34-ab7088a08503',/doctorId: '965dedad-11ba-46a3-a402-f88c2029c676',/g" tests/integration/booking-flow.e2e.test.ts

echo "✅ Branch ID fixed to match doctor, doctorId fixed to user_id."

npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit
