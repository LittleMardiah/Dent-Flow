import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware';
import {
  getPatientAttendance,
  getNoShowSummary,
} from '../handlers/attendance.handler';

const router = Router();

// All endpoints require authentication
router.use(authMiddleware);

// GET /api/patients/:id/attendance - patient attendance stats
router.get(
  '/patients/:id/attendance',
  roleMiddleware(['PATIENT', 'DOCTOR', 'ADMIN_BRANCH']),
  getPatientAttendance
);

// GET /api/reports/no-show-summary - admin only
router.get(
  '/reports/no-show-summary',
  roleMiddleware(['ADMIN_BRANCH']),
  getNoShowSummary
);

export default router;
