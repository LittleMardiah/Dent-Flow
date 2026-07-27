import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware';
import {
  getDoctorQueue,
  checkInPatient,
  getQueueStats,
} from '../handlers/doctorQueue.handler';
import { getQueueStatus } from '../handlers/queue.handler';

const router = Router();

router.use(authMiddleware);

// DOCTOR & ADMIN can view queue
router.get(
  '/doctors/:id/queue',
  roleMiddleware(['DOCTOR', 'ADMIN_BRANCH']),
  getDoctorQueue
);

// DOCTOR & ADMIN can view queue stats
router.get(
  '/doctors/:id/queue/stats',
  roleMiddleware(['DOCTOR', 'ADMIN_BRANCH']),
  getQueueStats
);

// ONLY DOCTOR can check-in patient
router.post(
  '/queue/:id/check-in',
  roleMiddleware(['DOCTOR']),  // <-- HARUSNYA DOCTOR
  checkInPatient
);

// PATIENT, DOCTOR, ADMIN can view queue status
router.get(
  '/queue/status',
  roleMiddleware(['PATIENT', 'DOCTOR', 'ADMIN_BRANCH']),
  getQueueStatus
);

export default router;
