#!/bin/bash
set -e

echo "========================================="
echo " FINAL FIX ROUTE ORDER (AWK METHOD)"
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

# 2. Hapus baris app.use('/api/doctors', doctorSlotRoutes); jika ada
echo "[2/4] Removing old app.use('/api/doctors', doctorSlotRoutes); ..."
sed -i '/app\.use(\/api\/doctors/d' src/index.ts
echo "✅ Removed."

# 3. Sisipkan setelah app.use('/webhooks', webhookRoutes); menggunakan AWK
echo "[3/4] Inserting app.use('/api/doctors', doctorSlotRoutes); after webhooks..."
awk '
  /app\.use\('\''\/webhooks'\'', webhookRoutes\);/ {
    print
    print "app.use('\''/api/doctors'\'', doctorSlotRoutes);"
    next
  }
  { print }
' src/index.ts > src/index.ts.tmp && mv src/index.ts.tmp src/index.ts
echo "✅ Inserted."

# 4. Tampilkan hasil (baris 38-48)
echo "--- Updated src/index.ts (lines 38-48) ---"
sed -n '38,48p' src/index.ts

# 5. Jalankan integration test
echo "[4/4] Running integration test..."
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit

echo "========================================="
echo " ✅ DONE"
echo "========================================="
