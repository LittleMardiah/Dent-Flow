import { z } from 'zod';

export const CreateScheduledBookingSchema = z.object({
  doctor_id: z.string().uuid('Doctor ID tidak valid'),
  slot_date_time: z.string().datetime('Format datetime tidak valid'),
  notes: z.string().max(500).optional(),
});

export const ListBookingsQuerySchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  branch_id: z.string().length(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const CancelBookingSchema = z.object({
  booking_id: z.string().uuid(),
});
