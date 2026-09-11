import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { getErrorMessage, getErrorStack } from '../utils/error.util';
import { pool } from '../config/database';

/**
 * GET /api/doctors?branchId=... or ?branch_id=...
 * List all doctors in a branch.
 *
 * Response contract (frontend lib/api/doctors.ts expects camelCase):
 *   { success: true, data: [{ id, userId, fullName, email, specialization,
 *     licenseNumber, isActive, branchId, branchName, queueCount }] }
 */
export const getDoctors = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId =
      (Array.isArray(req.query.branchId) ? req.query.branchId[0] : req.query.branchId) ||
      (Array.isArray(req.query.branch_id) ? req.query.branch_id[0] : req.query.branch_id);

    if (!branchId || typeof branchId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'branch_id is required',
        message: 'Query parameter branchId (atau branch_id) wajib diisi.',
      });
    }

    const doctorsResult = await pool.query(
      `SELECT d.id, d.branch_id, d.user_id, d.full_name, d.specialization,
              d.license_number, d.is_available, u.email, b.name AS branch_name
       FROM doctors d
       JOIN users u ON u.id = d.user_id
       LEFT JOIN branches b ON b.id = d.branch_id
       WHERE d.branch_id = $1
       ORDER BY d.full_name ASC`,
      [branchId]
    );

    const doctors = doctorsResult.rows;

    if (doctors.length > 0) {
      const ids = doctors.map((d) => d.id);
      const queueResult = await pool.query(
        `SELECT doctor_id, COUNT(*)::int AS cnt
         FROM queues
         WHERE doctor_id = ANY($1::uuid[]) AND status = 'WAITING'
         GROUP BY doctor_id`,
        [ids]
      );
      const queueCountByDoctor = new Map<string, number>(
        queueResult.rows.map((r) => [r.doctor_id, r.cnt])
      );

      for (const d of doctors) {
        d.queueCount = queueCountByDoctor.get(d.id) ?? 0;
      }
    }

    const data = doctors.map((d) => ({
      id: d.id,
      userId: d.user_id,
      fullName: d.full_name,
      email: d.email,
      specialization: d.specialization,
      licenseNumber: d.license_number,
      isActive: d.is_available,
      branchId: d.branch_id,
      branchName: d.branch_name,
      queueCount: d.queueCount,
      user_id: d.user_id,
      full_name: d.full_name,
      license_number: d.license_number,
      branch_id: d.branch_id,
      branch_name: d.branch_name,
      is_available: d.is_available,
      queue_count: d.queueCount,
    }));

    res.status(200).json({ success: true, data });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const stack = getErrorStack(error);
    logger.error({ error: message, stack }, 'GET /api/doctors list failed');
    next(error);
  }
};