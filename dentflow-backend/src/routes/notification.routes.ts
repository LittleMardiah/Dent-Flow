import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware';
import { NotificationHandler } from '../handlers/notification.handler';
import { NotificationService } from '../services/notification.service';

const router = Router();
const notificationService = new NotificationService();
const notificationHandler = new NotificationHandler(notificationService);

// All routes require admin authentication
router.use(authMiddleware, roleMiddleware(['ADMIN_BRANCH']));

// POST /api/admin/bookings/:id/send-reminder
router.post('/bookings/:id/send-reminder', notificationHandler.sendReminder);

// POST /api/admin/bookings/:id/send-confirmation
router.post('/bookings/:id/send-confirmation', notificationHandler.sendConfirmation);

export default router;
