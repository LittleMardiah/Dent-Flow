#!/bin/bash
set -e

echo "========================================="
echo " FINAL FIX: KILL NODE & RUN TEST WITH --no-cache"
echo "========================================="

# 1. Kill all Node processes (excluding current script)
echo "[1/3] Killing all Node processes..."
pkill -f node || echo "⚠️  No Node processes found to kill."
sleep 2

# 2. Clear Jest cache
echo "[2/3] Clearing Jest cache..."
npx jest --clearCache

# 3. Run test with --no-cache
echo "[3/3] Running integration test with --no-cache..."
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit --no-cache

echo ""
echo "========================================="
echo " ✅ TEST DONE"
echo "========================================="
