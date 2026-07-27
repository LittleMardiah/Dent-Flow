#!/bin/bash
set -e

echo "========================================="
echo " SAFE FIX ROUTE ORDER"
echo "========================================="

# 1. Restore dari backup
echo "[1/4] Restore src/index.ts from backup..."
if [ -f src/index.ts.bak ]; then
  cp src/index.ts.bak src/index.ts
  echo "✅ Restored from backup."
else
  echo "❌ Backup not found! Aborting."
  exit 1
fi

# 2. Hapus baris app.use('/api/doctors', doctorSlotRoutes);
echo "[2/4] Removing old app.use('/api/doctors', doctorSlotRoutes); ..."
sed -i '/app\.use(\/api\/doctors/d' src/index.ts
echo "✅ Removed."

# 3. Sisipkan setelah app.use('/webhooks', webhookRoutes);
echo "[3/4] Inserting app.use('/api/doctors', doctorSlotRoutes); after webhooks..."
sed -i '/app\.use('\/webhooks', webhookRoutes);/a app.use('/api/doctors', doctorSlotRoutes);' src/index.ts
echo "✅ Inserted."

# 4. Jalankan test
echo "[4/4] Running integration test..."
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit

echo "========================================="
echo " ✅ DONE"
echo "========================================="
