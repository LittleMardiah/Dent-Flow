// ===== VERIFIED: THIS FILE IS LOADED =====
import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware';
import { DoctorScheduleHandler } from '../handlers/doctorSchedule.handler';
import { DoctorScheduleService } from '../services/doctorSchedule.service';
import { getDoctors } from '../handlers/doctorsList.handler';
import {
  getDoctorProfile,
  updateDoctorProfile,
  getDoctorPatients,
} from '../handlers/doctorProfile.handler';

console.log('🔥 LOADING doctorSlot.routes.ts WITH FULL ROLES');

const router = Router();
const doctorScheduleHandler = new DoctorScheduleHandler(new DoctorScheduleService());

console.log("✅ REGISTERING ROUTE GET / (list doctors) with allowedRoles:", ["ADMIN_BRANCH", "PATIENT", "DOCTOR"]);
router.get(
  "/",
  authMiddleware,
  roleMiddleware(["ADMIN_BRANCH", "PATIENT", "DOCTOR"]),
  getDoctors
);

// NOTE: mount /me SEBELUM /:id supaya tidak konflik dengan :id routes
console.log("✅ REGISTERING ROUTE GET /me (doctor profile) with allowedRoles: [DOCTOR]");
router.get(
  '/me',
  authMiddleware,
  roleMiddleware(['DOCTOR']),
  getDoctorProfile
);

console.log("✅ REGISTERING ROUTE PUT /me (update doctor profile) with allowedRoles: [DOCTOR]");
router.put(
  '/me',
  authMiddleware,
  roleMiddleware(['DOCTOR']),
  updateDoctorProfile
);

console.log("✅ REGISTERING ROUTE GET /:id/patients with allowedRoles: [DOCTOR, ADMIN_BRANCH]");
router.get(
  '/:id/patients',
  authMiddleware,
  roleMiddleware(['DOCTOR', 'ADMIN_BRANCH']),
  getDoctorPatients
);

console.log("✅ REGISTERING ROUTE /:id/availability with allowedRoles:", ["PATIENT", "DOCTOR", "ADMIN_BRANCH"]);
router.get(
  "/:id/availability",
  authMiddleware,
  roleMiddleware(["PATIENT", "DOCTOR", "ADMIN_BRANCH"]),
  doctorScheduleHandler.getAvailability.bind(doctorScheduleHandler)
);

router.put(
  '/:id/schedule',
  authMiddleware,
  roleMiddleware(['ADMIN_BRANCH']),
  doctorScheduleHandler.updateSchedule.bind(doctorScheduleHandler)
);

router.put(
  '/:id/leave',
  authMiddleware,
  roleMiddleware(['ADMIN_BRANCH', 'PATIENT', 'DOCTOR']),
  doctorScheduleHandler.setLeave.bind(doctorScheduleHandler)
);

router.delete(
  '/:id/leave',
  authMiddleware,
  roleMiddleware(['ADMIN_BRANCH', 'PATIENT', 'DOCTOR']),
  doctorScheduleHandler.removeLeave.bind(doctorScheduleHandler)
);

export default router;
