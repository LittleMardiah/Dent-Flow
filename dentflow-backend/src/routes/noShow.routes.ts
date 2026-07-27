import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware';
import { getNoShows, markNoShowManual } from '../handlers/noShow.handler';

const router = Router();

// Semua endpoint membutuhkan authentication & admin role
router.use(authMiddleware);
router.use(roleMiddleware(['ADMIN_BRANCH']));

// GET /api/admin/no-shows - list no-shows untuk branch
router.get('/admin/no-shows', getNoShows);

// PUT /api/admin/bookings/:id/mark-no-show - manual marking
router.put('/admin/bookings/:id/mark-no-show', markNoShowManual);

export default router;
