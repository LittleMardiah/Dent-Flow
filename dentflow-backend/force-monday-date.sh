#!/bin/bash
set -e

echo "========================================="
echo " FORCE DATE TO MONDAY (2026-07-27)"
echo "========================================="

# Backup test file
cp tests/integration/booking-flow.e2e.test.ts tests/integration/booking-flow.e2e.test.ts.bak.force

# Ganti getNextAvailableDate dengan hardcoded date 2026-07-27
sed -i 's/bookingDate = getNextAvailableDate(testData.availableDays);/bookingDate = new Date("2026-07-27");/g' tests/integration/booking-flow.e2e.test.ts
sed -i 's/dateStr = bookingDate.toISOString().split("T")[0];/dateStr = "2026-07-27";/g' tests/integration/booking-flow.e2e.test.ts

echo "✅ Date forced to 2026-07-27 (Monday)."

# Jalankan integration test
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit

echo "========================================="
echo " ✅ DONE"
echo "========================================="
