import { z } from 'zod';

// Keluhan & Tindakan TIDAK boleh kosong (empty/whitespace) saat dikirim.
// Omit field diperbolehkan (mulai pemeriksaan dulu, EMR diisi setelahnya via PUT),
// tapi EMR kosong tidak boleh tersimpan. Trim supaya "   " ditolak.
const optionalNonEmpty = (label: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === null ? undefined : v.trim() || null))
    .refine((v) => v !== null, `${label} wajib diisi`);

// Schema untuk POST /api/encounters — startEncounter / simpan EMR.
export const StartEncounterSchema = z.object({
  bookingId: z.string().uuid('bookingId tidak valid'),
  complaint: optionalNonEmpty('Keluhan'),
  treatment: optionalNonEmpty('Tindakan'),
  diagnosis: z.string().trim().optional(),
  prescription: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});