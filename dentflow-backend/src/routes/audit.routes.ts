import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware';
import { getAuditLogs } from '../handlers/audit.handler';

const router = Router();

// All endpoints require authentication and admin role
router.use(authMiddleware);
router.use(roleMiddleware(['ADMIN_BRANCH']));

// GET /api/admin/audit-logs
router.get('/audit-logs', getAuditLogs);

export default router;
