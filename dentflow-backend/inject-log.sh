#!/bin/bash
set -e

echo "========================================="
echo " INJECT LOG IN DOCTOR SLOT ROUTES"
echo "========================================="

# Tambahkan log di atas router.get
sed -i '/router\.get(/,/^)/c\
console.log("✅ REGISTERING ROUTE /:id/availability with allowedRoles:", ["PATIENT", "DOCTOR", "ADMIN_BRANCH"]);\
router.get(\
  "/:id/availability",\
  authMiddleware,\
  roleMiddleware(["PATIENT", "DOCTOR", "ADMIN_BRANCH"]),\
  doctorScheduleHandler.getAvailability.bind(doctorScheduleHandler)\
);' src/routes/doctorSlot.routes.ts

echo "✅ Log injected."

# Jalankan test
npm run test -- --testPathPatterns="booking-flow.e2e.test.ts" --forceExit
