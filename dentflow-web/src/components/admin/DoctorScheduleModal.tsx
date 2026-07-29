'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';

interface DaySchedule {
  day: string;
  start: string;
  end: string;
  active: boolean;
}

interface DoctorScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctorName: string;
  schedule?: DaySchedule[];
  onSave?: (schedule: DaySchedule[]) => Promise<void>;
}

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export const DoctorScheduleModal: React.FC<DoctorScheduleModalProps> = ({
  isOpen,
  onClose,
  doctorName,
  schedule = [],
  onSave,
}) => {
  const [localSchedule, setLocalSchedule] = useState<DaySchedule[]>(
    DAYS.map((day) => {
      const existing = schedule.find((s) => s.day === day);
      return existing || { day, start: '09:00', end: '17:00', active: false };
    })
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (schedule.length > 0) {
      setLocalSchedule(
        DAYS.map((day) => {
          const existing = schedule.find((s) => s.day === day);
          return existing || { day, start: '09:00', end: '17:00', active: false };
        })
      );
    }
  }, [schedule, isOpen]);

  const toggleDay = (index: number) => {
    const updated = [...localSchedule];
    updated[index].active = !updated[index].active;
    setLocalSchedule(updated);
  };

  const updateTime = (index: number, field: 'start' | 'end', value: string) => {
    const updated = [...localSchedule];
    updated[index][field] = value;
    setLocalSchedule(updated);
  };

  const handleSave = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      if (onSave) {
        await onSave(localSchedule.filter((s) => s.active));
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan jadwal');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Jadwal - ${doctorName}`}
      confirmText={isSubmitting ? 'Memproses...' : 'Simpan'}
      onConfirm={handleSave}
      cancelText="Batal"
      variant="primary"
    >
      {error && (
        <div className="bg-danger/10 text-danger p-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {localSchedule.map((day, index) => (
          <div key={day.day} className="flex items-center gap-3 p-2 bg-neutral/30 rounded-lg">
            <label className="flex items-center gap-2 min-w-[80px] cursor-pointer">
              <input
                type="checkbox"
                checked={day.active}
                onChange={() => toggleDay(index)}
                className="w-4 h-4 accent-primary"
              />
              <span className="font-medium text-sm">{day.day}</span>
            </label>

            {day.active ? (
              <>
                <div className="flex items-center gap-2 flex-1">
                  <label className="text-xs text-gray-500">Mulai</label>
                  <input
                    type="time"
                    value={day.start}
                    onChange={(e) => updateTime(index, 'start', e.target.value)}
                    className="px-2 py-1 border border-neutral rounded text-sm focus:ring-2 focus:ring-primary outline-none w-24"
                  />
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <label className="text-xs text-gray-500">Selesai</label>
                  <input
                    type="time"
                    value={day.end}
                    onChange={(e) => updateTime(index, 'end', e.target.value)}
                    className="px-2 py-1 border border-neutral rounded text-sm focus:ring-2 focus:ring-primary outline-none w-24"
                  />
                </div>
              </>
            ) : (
              <span className="text-xs text-gray-400 flex-1">Tidak praktik</span>
            )}
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-400 mt-4">
        ⚡ Centang hari, atur jam mulai dan selesai praktik.
      </div>
    </Modal>
  );
};
