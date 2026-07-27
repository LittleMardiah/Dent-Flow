import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware';
import {
  createScheduledBooking,
  getPatientBookings,
  getBookingDetail,
  cancelBooking
} from '../handlers/booking.handler';

const router = Router();

router.use(authMiddleware);

router.post('/patient/bookings', roleMiddleware(['PATIENT']), createScheduledBooking);
router.get('/patient/bookings', roleMiddleware(['PATIENT']), getPatientBookings);
router.get('/patient/bookings/:id', roleMiddleware(['PATIENT', 'DOCTOR', 'ADMIN_BRANCH']), getBookingDetail);
router.put('/patient/bookings/:id/cancel', roleMiddleware(['PATIENT', 'ADMIN_BRANCH']), cancelBooking);

export default router;
