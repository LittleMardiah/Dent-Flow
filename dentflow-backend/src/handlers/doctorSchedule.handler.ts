import { Request, Response } from 'express';
import { DoctorScheduleService } from '../services/doctorSchedule.service';
import { logger } from '../utils/logger';
import { getErrorMessage, getErrorStack } from '../utils/error.util';

export class DoctorScheduleHandler {
  constructor(private doctorScheduleService: DoctorScheduleService) {}

  /**
   * GET /api/doctors/:id/availability
   * Get available slots for a doctor on a given date
   */
  getAvailability = async (req: Request, res: Response): Promise<void> => {
    try {
      const doctorId = req.params.id as string;
      const { date, branch_id } = req.query;

      if (!branch_id || typeof branch_id !== 'string') {
        res.status(400).json({ success: false, error: 'branch_id is required' });
        return;
      }

      let targetDate: Date;
      if (date && typeof date === 'string') {
        targetDate = new Date(date);
      } else {
        targetDate = new Date();
      }

      const slots = await this.doctorScheduleService.getDoctorAvailability(
        doctorId,
        branch_id,
        targetDate
      );

      res.status(200).json({
        success: true,
        data: {
          doctor_id: doctorId,
          branch_id,
          date: targetDate.toISOString().split('T')[0],
          slots,
        },
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const stack = getErrorStack(error);
      logger.error({ error: message, stack });
      res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR', message: 'Server error' });
    }
  };

  /**
   * PUT /api/doctors/:id/schedule
   * Admin replaces doctor weekly schedule
   */
  updateSchedule = async (req: Request, res: Response): Promise<void> => {
    try {
      const doctorId = req.params.id as string;
      const { schedules } = req.body;
      const branchId = req.user?.branchId;

      if (!branchId) {
        res.status(400).json({ success: false, error: 'BRANCH_REQUIRED', message: 'Admin harus terikat ke cabang' });
        return;
      }

      if (!Array.isArray(schedules)) {
        res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'schedules harus berupa array' });
        return;
      }

      for (const schedule of schedules) {
        const { dayOfWeek, startTime, endTime, maxPatients } = schedule ?? {};
        if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
          res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'dayOfWeek harus 0-6' });
          return;
        }
        if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
          res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'startTime/endTime harus format HH:MM' });
          return;
        }
        if (startTime >= endTime) {
          res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'startTime harus lebih awal dari endTime' });
          return;
        }
        if (maxPatients !== undefined && (!Number.isInteger(maxPatients) || maxPatients < 1)) {
          res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'maxPatients harus bilangan bulat positif' });
          return;
        }
      }

      await this.doctorScheduleService.updateDoctorSchedule(doctorId, branchId, schedules);

      res.status(200).json({
        success: true,
        message: 'Jadwal berhasil diperbarui',
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const stack = getErrorStack(error);
      logger.error({ error: message, stack });

      if (message === 'DOCTOR_NOT_FOUND') {
        res.status(404).json({ success: false, error: 'DOCTOR_NOT_FOUND', message: 'Dokter tidak ditemukan' });
        return;
      }

      res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR', message: 'Server error' });
    }
  };

  /**
   * PUT /api/admin/doctors/:id/leave
   * Admin sets doctor on leave
   */
  setLeave = async (req: Request, res: Response): Promise<void> => {
    try {
      const doctorId = req.params.id as string;
      const { branch_id, start_date, end_date, reason } = req.body;
      const adminId = req.user?.userId;

      if (!adminId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      if (!branch_id || !start_date || !end_date) {
        res.status(400).json({ success: false, error: 'branch_id, start_date, end_date are required' });
        return;
      }

      await this.doctorScheduleService.setDoctorLeave(
        doctorId,
        branch_id,
        new Date(start_date),
        new Date(end_date),
        reason || '',
        adminId
      );

      res.status(200).json({
        success: true,
        message: `Doctor ${doctorId} leave set from ${start_date} to ${end_date}`,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const stack = getErrorStack(error);
      logger.error({ error: message, stack });
      res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR', message: 'Server error' });
    }
  };

  /**
   * DELETE /api/admin/doctors/:id/leave
   * Admin removes doctor leave
   */
  removeLeave = async (req: Request, res: Response): Promise<void> => {
    try {
      const doctorId = req.params.id as string;
      const { start_date, end_date } = req.body;
      const adminId = req.user?.userId;

      if (!adminId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      if (!start_date || !end_date) {
        res.status(400).json({ success: false, error: 'start_date and end_date are required' });
        return;
      }

      await this.doctorScheduleService.removeDoctorLeave(
        doctorId,
        new Date(start_date),
        new Date(end_date)
      );

      res.status(200).json({
        success: true,
        message: `Doctor ${doctorId} leave removed from ${start_date} to ${end_date}`,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const stack = getErrorStack(error);
      logger.error({ error: message, stack });
      res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR', message: 'Server error' });
    }
  };
}
