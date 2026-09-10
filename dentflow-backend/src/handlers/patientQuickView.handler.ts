import { Request, Response, NextFunction } from 'express';

import { logger } from '../utils/logger';
import { getErrorMessage, getErrorStack } from '../utils/error.util';
import { pool } from '../config/database';


/**
 * GET /patients/:id/quick-view
 * Quick patient summary for the doctor queue panel.
 * Response: { success, data: PatientQuickView }
 */
export const getPatientQuickView = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patientId = String(req.params.id);

    const result = await pool.query(
      `SELECT p.id, p.full_name, p.phone, p.date_of_birth,
              u.email,
              (SELECT COUNT(*) FROM encounters e WHERE e.patient_id = p.id) as total_visits,
              (SELECT MAX(e.completed_at) FROM encounters e WHERE e.patient_id = p.id) as last_visit
       FROM patients p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = $1`,
      [patientId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pasien tidak ditemukan' });
    }

    const row = result.rows[0];
    const age =
      row.date_of_birth
        ? Math.floor((Date.now() - new Date(row.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
        : undefined;

    res.status(200).json({
      success: true,
      data: {
        id: row.id,
        fullName: row.full_name,
        phone: row.phone || '',
        email: row.email || '',
        age,
        medicalConditions: [],
        allergies: [],
        lastVisit: row.last_visit || '',
        totalVisits: parseInt(row.total_visits) || 0,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: getErrorMessage(error), stack: getErrorStack(error) }, 'Patient quick view error');
    next(error);
  }
};