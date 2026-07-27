#!/bin/bash
set -e

echo "========================================="
echo " 🔧 FIX ROUTE CONFLICT (AI SEBELAH)"
echo "========================================="

echo ""
echo "[1/4] CEK isi src/routes/admin.routes.ts (sebelum fix)..."
cat src/routes/admin.routes.ts

echo ""
echo "[2/4] VALIDASI: apakah ada router.use(authMiddleware) di admin.routes.ts?"
if grep -q "router.use(authMiddleware)" src/routes/admin.routes.ts; then
  echo "✅ Terdeteksi: router.use(authMiddleware) ada. Kita perbaiki."
else
  echo "⚠️  Tidak ditemukan router.use(authMiddleware). Lanjut cek index.ts..."
fi

echo ""
echo "[3/4] PERBAIKI admin.routes.ts (hapus global middleware, pake per-route)..."
cat > src/routes/admin.routes.ts << 'ADMIN_EOF'
import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware';
import { checkInPatient, addWalkIn } from '../handlers/checkin.handler';

const router = Router();

// POST /api/admin/check-in - Admin check-in patient via booking code
router.post(
  '/check-in',
  authMiddleware,
  roleMiddleware(['ADMIN_BRANCH']),
  checkInPatient
);

// POST /api/admin/check-in/walk-in - Admin add walk-in patient
router.post(
  '/check-in/walk-in',
  authMiddleware,
  roleMiddleware(['ADMIN_BRANCH']),
  addWalkIn
);

export default router;
ADMIN_EOF

echo "✅ admin.routes.ts sudah diperbaiki (global middleware dihapus)."

echo ""
echo "[4/4] JALANKAN INTEGRATION TEST..."
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit

echo ""
echo "========================================="
echo " ✅ SELESAI"
echo "========================================="
