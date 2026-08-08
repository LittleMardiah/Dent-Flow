import { Router } from 'express';
import { walkInRateLimiter } from '../middleware/rateLimiter';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware';
import {
  createTemporaryProfile,
  bookWalkInAppointment,
  convertTemporaryToPatient,
} from '../handlers/walkIn.handler';

const router = Router();

// Public endpoint: create temporary profile (no auth)
router.post('/create-profile', walkInRateLimiter, createTemporaryProfile);

// Admin only: book appointment for walk-in
router.post(
  '/book-appointment',
  authMiddleware,
  roleMiddleware(['ADMIN_BRANCH']),
  bookWalkInAppointment
);

// Public endpoint: convert temp to full patient (no auth)
router.post('/convert-to-patient', convertTemporaryToPatient);

export default router;
