#!/bin/bash
set -e

echo "========================================="
echo " ADD LOGGING TO BOOKING SERVICE"
echo "========================================="

# Backup
cp src/services/booking.service.ts src/services/booking.service.ts.bak.log

# Tambahkan log sebelum query schedule
sed -i '/const scheduleResult = await client.query(/i \
      console.log("🔍 [BookingService] doctorUserId:", doctorUserId);\
      console.log("🔍 [BookingService] dayOfWeek:", dayOfWeek);\
      console.log("🔍 [BookingService] timeStr:", timeStr);\
' src/services/booking.service.ts

echo "✅ Logs added. Running test..."
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit

echo "========================================="
echo " ✅ DONE"
echo "========================================="
