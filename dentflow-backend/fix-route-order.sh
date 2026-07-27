#!/bin/bash
set -e

echo "========================================="
echo " FIX ROUTE ORDER - MOVE doctorSlotRoutes UP"
echo "========================================="

# Backup index.ts
cp src/index.ts src/index.ts.bak

# Hapus baris yang mengandung app.use('/api/doctors', doctorSlotRoutes)
sed -i '/app.use('\/api\/doctors', doctorSlotRoutes);/d' src/index.ts

# Sisipkan baris tersebut setelah app.use('/health', healthRoutes) dan sebelum app.use('/api', bookingRoutes)
# Cari posisi setelah baris app.use('/webhooks', webhookRoutes) atau sebelum app.use('/api', bookingRoutes)
sed -i '/app.use('\/api', bookingRoutes);/i app.use('/api/doctors', doctorSlotRoutes);' src/index.ts

echo "✅ doctorSlotRoutes moved to top of /api routes."

echo "========================================="
echo " RUNNING TEST AGAIN"
echo "========================================="
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit
