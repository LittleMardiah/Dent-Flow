import { Request, Response, NextFunction } from 'express';
import { EncounterService } from '../services/encounter.service';
import { logger } from '../utils/logger';

const encounterService = new EncounterService();

/**
 * POST /api/encounters
 * Start a new encounter (doctor only)
 */
export const startEncounter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bookingId, complaint, diagnosis, treatment, prescription, notes } = req.body;
    const doctorId = req.user?.userId;
    const branchId = req.user?.branchId;

    if (!doctorId || !branchId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'bookingId is required' });
    }

    const encounter = await encounterService.startEncounter(bookingId, doctorId, branchId, {
      complaint,
      diagnosis,
      treatment,
      prescription,
      notes,
    });
    res.status(201).json({
      success: true,
      data: encounter,
      message: 'Pemeriksaan berhasil dimulai',
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Error starting encounter');
    if (err.message === 'BOOKING_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Booking tidak ditemukan' });
    }
    if (err.message === 'BOOKING_NOT_READY_FOR_ENCOUNTER') {
      return res.status(409).json({ success: false, message: 'Booking belum siap untuk pemeriksaan' });
    }
    if (err.message === 'ENCOUNTER_ALREADY_EXISTS') {
      return res.status(409).json({ success: false, message: 'Pemeriksaan sudah dibuat untuk booking ini' });
    }
    next(error);
  }
};

/**
 * PUT /api/encounters/:id
 * Update encounter (doctor only)
 * NOTE: Service signature: updateEncounter(id, data, doctorId)
 */
export const updateEncounter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const encounterId = String(req.params.id);
    const doctorId = req.user?.userId;
    const { complaint, diagnosis, treatment, prescription, notes } = req.body;

    if (!doctorId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Correct order: (id, data, doctorId)
    const updated = await encounterService.updateEncounter(
      encounterId,
      {
        complaint,
        diagnosis,
        treatment,
        prescription,
        notes,
      },
      doctorId
    );

    res.status(200).json({
      success: true,
      data: updated,
      message: 'Pemeriksaan berhasil diperbarui',
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Error updating encounter');
    if (err.message === 'ENCOUNTER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Pemeriksaan tidak ditemukan' });
    }
    if (err.message === 'ENCOUNTER_NOT_ONGOING') {
      return res.status(409).json({ success: false, message: 'Pemeriksaan sudah selesai atau dibatalkan' });
    }
    if (err.message === 'NO_FIELDS_TO_UPDATE') {
      return res.status(400).json({ success: false, message: 'Tidak ada field yang diupdate' });
    }
    next(error);
  }
};

/**
 * POST /api/encounters/:id/complete
 * Complete encounter (doctor only) -> triggers invoice
 */
export const completeEncounter = async (req: Request, res: Response, next: NextFunction) => {
  console.log("🔍 [completeEncounter] START for encounterId:", req.params.id);
  try {
    const encounterId = String(req.params.id);
    const doctorId = req.user?.userId;

    if (!doctorId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const result = await encounterService.completeEncounter(encounterId, doctorId);
  console.log("🔍 [completeEncounter] AFTER service call, result:", result);
    res.status(200).json({
      success: true,
      data: {
        encounter: result.encounter,
        invoice: result.invoice,
      },
      message: 'Pemeriksaan selesai, invoice dibuat',
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Error completing encounter');
    if (err.message === 'ENCOUNTER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Pemeriksaan tidak ditemukan' });
    }
    if (err.message === 'ENCOUNTER_NOT_ONGOING') {
      return res.status(409).json({ success: false, message: 'Pemeriksaan sudah selesai atau dibatalkan' });
    }
    next(error);
  }
};

/**
 * GET /api/encounters/:id
 * Get encounter by ID (patient or doctor)
 */
export const getEncounter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const encounterId = String(req.params.id);
    const userId = req.user?.userId;
    const userRole = req.user?.role || ''; // default to empty string

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const encounter = await encounterService.getEncounterById(encounterId, userId, userRole);
    res.status(200).json({
      success: true,
      data: encounter,
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err.message, stack: err.stack }, 'Error getting encounter');
    if (err.message === 'ENCOUNTER_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Pemeriksaan tidak ditemukan' });
    }
    if (err.message === 'ACCESS_DENIED') {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki akses ke pemeriksaan ini' });
    }
    next(error);
  }
};
