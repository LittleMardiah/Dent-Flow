import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware';
import {
  getPatientHistory,
  getMedicalRecords,
} from '../handlers/patientHistory.handler';

const router = Router();

// Semua endpoint membutuhkan authentication
router.use(authMiddleware);

// GET /patients/:id/history - patient history (patient, doctor, admin)
router.get(
  '/patients/:id/history',
  roleMiddleware(['PATIENT', 'DOCTOR', 'ADMIN_BRANCH']),
  getPatientHistory
);

// GET /patients/:id/medical-records - medical records (doctor only)
router.get(
  '/patients/:id/medical-records',
  roleMiddleware(['DOCTOR']),
  getMedicalRecords
);

export default router;
