#!/bin/bash
set -e

echo "========================================="
echo " VERIFY ROUTE FILE & CLEAR CACHE"
echo "========================================="

# 1. Kill all Node processes
echo "[1/5] Killing all Node processes..."
pkill -f node || echo "⚠️  No Node processes found."

# 2. Clear Jest cache
echo "[2/5] Clearing Jest cache..."
npx jest --clearCache || echo "⚠️  Jest cache clear failed."

# 3. Remove dist folder (if any)
echo "[3/5] Removing dist/ folder..."
rm -rf dist/ || echo "⚠️  dist/ not found."

# 4. Add a unique log line at the top of doctorSlot.routes.ts
echo "[4/5] Adding unique log to doctorSlot.routes.ts..."
sed -i '1i // ===== VERIFIED: THIS FILE IS LOADED =====' src/routes/doctorSlot.routes.ts

# 5. Run the test again
echo "[5/5] Running integration test..."
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit

echo ""
echo "========================================="
echo " ✅ DONE"
echo "========================================="
