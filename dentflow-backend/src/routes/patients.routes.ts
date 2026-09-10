import { Router } from 'express';
import { roleMiddleware } from '../middleware/authMiddleware';
import {
  listPatients,
  getPatientDetail,
  updatePatient,
  softDeletePatient,
  listAccessibleBranches,
  getPatientAuditTrail,
  mergePatients,
} from '../handlers/patient.handler';

const router = Router();

// Auth + tenant isolation sudah ditangani GLOBAL (app.use('/api', authMiddleware, tenantMiddleware)).
// Role check dibatasi per-route SAJA agar subpath lain di /api/patients
// (misal /:id/history milik router patient-history) ikut jatuh ke router tsb.
const ADMIN_DOCTOR = ['ADMIN_BRANCH', 'DOCTOR'];

// GET /api/patients - list pasien (scoped ke branch user)
router.get('/', roleMiddleware(ADMIN_DOCTOR), listPatients);

// GET /api/patients/branches - branch yang boleh diakses (sebelum /:id)
router.get('/branches', roleMiddleware(ADMIN_DOCTOR), listAccessibleBranches);

// POST /api/patients/merge - gabungkan pasien duplikat
router.post('/merge', roleMiddleware(ADMIN_DOCTOR), mergePatients);

// GET /api/patients/:id - detail pasien
router.get('/:id', roleMiddleware(ADMIN_DOCTOR), getPatientDetail);

// GET /api/patients/:id/audit-trail - riwayat audit pasien
router.get('/:id/audit-trail', roleMiddleware(ADMIN_DOCTOR), getPatientAuditTrail);

// PUT /api/patients/:id - update pasien
router.put('/:id', roleMiddleware(ADMIN_DOCTOR), updatePatient);

// DELETE /api/patients/:id - soft delete pasien
router.delete('/:id', roleMiddleware(ADMIN_DOCTOR), softDeletePatient);

export default router;