'use client';

import { useState, useEffect, useCallback } from 'react';
import { doctorScheduleApi, DoctorSchedule, DoctorSettings, DaySchedule, TimeSlot } from '@/lib/api/doctorSchedule';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export function useDoctorSchedule(doctorId: string) {
  const [schedule, setSchedule] = useState<DoctorSchedule | null>(null);
  const [settings, setSettings] = useState<DoctorSettings | null>(null);
  const [replacementDoctors, setReplacementDoctors] = useState<Array<{ id: string; fullName: string; specialization: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!doctorId) return;
    try {
      setIsLoading(true);
      setError(null);
      const [scheduleData, replacementsData] = await Promise.all([
        doctorScheduleApi.getSchedule(doctorId),
        doctorScheduleApi.getReplacementDoctors(doctorId),
      ]);
      setSchedule(scheduleData);
      setReplacementDoctors(replacementsData);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat jadwal');
    } finally {
      setIsLoading(false);
    }
  }, [doctorId]);

  const updateSchedule = useCallback(async (data: Partial<DoctorSchedule>) => {
    try {
      setIsSaving(true);
      const updated = await doctorScheduleApi.updateSchedule(doctorId, data);
      setSchedule(updated);
      return updated;
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan jadwal');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [doctorId]);

  const updateAvailability = useCallback(async (data: DoctorSettings['availabilityPreferences']) => {
    try {
      setIsSaving(true);
      const updated = await doctorScheduleApi.updateAvailability(doctorId, data);
      setSettings((prev) => prev ? { ...prev, availabilityPreferences: data } : null);
      return updated;
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan preferensi');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [doctorId]);

  const setDaysOff = useCallback(async (daysOff: string[]) => {
    try {
      setIsSaving(true);
      const updated = await doctorScheduleApi.setDaysOff(doctorId, daysOff);
      setSchedule(updated);
      return updated;
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan hari libur');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [doctorId]);

  const toggleDay = useCallback((dayIndex: number) => {
    if (!schedule) return;
    const updatedSchedule = { ...schedule };
    const day = updatedSchedule.schedule[dayIndex];
    if (day) {
      day.isActive = !day.isActive;
      setSchedule(updatedSchedule);
    }
  }, [schedule]);

  const updateDaySlots = useCallback((dayIndex: number, slots: TimeSlot[]) => {
    if (!schedule) return;
    const updatedSchedule = { ...schedule };
    updatedSchedule.schedule[dayIndex].slots = slots;
    setSchedule(updatedSchedule);
  }, [schedule]);

  const addSlot = useCallback((dayIndex: number) => {
    if (!schedule) return;
    const updatedSchedule = { ...schedule };
    const day = updatedSchedule.schedule[dayIndex];
    if (day) {
      day.slots.push({ start: '09:00', end: '12:00' });
      setSchedule(updatedSchedule);
    }
  }, [schedule]);

  const removeSlot = useCallback((dayIndex: number, slotIndex: number) => {
    if (!schedule) return;
    const updatedSchedule = { ...schedule };
    updatedSchedule.schedule[dayIndex].slots.splice(slotIndex, 1);
    setSchedule(updatedSchedule);
  }, [schedule]);

  const updateSlot = useCallback((dayIndex: number, slotIndex: number, field: keyof TimeSlot, value: string) => {
    if (!schedule) return;
    const updatedSchedule = { ...schedule };
    updatedSchedule.schedule[dayIndex].slots[slotIndex][field] = value;
    setSchedule(updatedSchedule);
  }, [schedule]);

  const setReplacementDoctor = useCallback(async (replacementId: string) => {
    return await updateSchedule({ replacementDoctorId: replacementId });
  }, [updateSchedule]);

  useEffect(() => {
    if (doctorId) {
      fetchAll();
    }
  }, [doctorId, fetchAll]);

  return {
    schedule,
    settings,
    replacementDoctors,
    isLoading,
    isSaving,
    error,
    DAYS,
    fetchAll,
    updateSchedule,
    updateAvailability,
    setDaysOff,
    toggleDay,
    updateDaySlots,
    addSlot,
    removeSlot,
    updateSlot,
    setReplacementDoctor,
  };
}
