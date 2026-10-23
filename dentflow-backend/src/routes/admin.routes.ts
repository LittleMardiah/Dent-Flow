import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware';
import { adminWalkInCheckin } from '../handlers/adminWalkIn.handler';
import { adminCheckin } from '../handlers/admin.handler';
import { exportAdminQueues, getAdminQueues } from '../handlers/adminQueue.handler';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware(['ADMIN_BRANCH']));

// Admin queue board (today's queue for branch)
router.get('/queues', getAdminQueues);

// Admin queue CSV export (today, no pagination)
router.get('/queues/export', exportAdminQueues);

// Admin check-in via booking code
router.post('/check-in', adminCheckin);

// Admin walk-in check-in
router.post('/check-in/walk-in', adminWalkInCheckin);

export default router;
