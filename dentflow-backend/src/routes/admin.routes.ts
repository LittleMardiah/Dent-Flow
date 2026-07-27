import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware';
import { adminWalkInCheckin } from '../handlers/adminWalkIn.handler';
import { adminCheckin } from '../handlers/admin.handler';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware(['ADMIN_BRANCH']));

// Admin check-in via booking code
router.post('/check-in', adminCheckin);

// Admin walk-in check-in
router.post('/check-in/walk-in', adminWalkInCheckin);

export default router;
