'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useDoctorSchedule } from '@/hooks/useDoctorSchedule';
import { useRouter } from 'next/navigation';
import { DoctorLayout } from '@/components/layouts/DoctorLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  User,
  Mail,
  Phone,
  Stethoscope,
  DollarSign,
  Settings,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
} from 'lucide-react';

export default function DoctorSchedulePage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const doctorId = user?.id || '';

  const {
    schedule,
    replacementDoctors,
    isLoading,
    isSaving,
    error,
    DAYS,
    updateSchedule,
    updateAvailability,
    setDaysOff,
    toggleDay,
    addSlot,
    removeSlot,
    updateSlot,
    setReplacementDoctor,
  } = useDoctorSchedule(doctorId);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isDaysOffModalOpen, setIsDaysOffModalOpen] = useState(false);
  const [selectedDaysOff, setSelectedDaysOff] = useState<string[]>([]);
  const [settingsForm, setSettingsForm] = useState({
    phone: '',
    email: '',
    licenseNumber: '',
    specialization: '',
    consultationFee: 0,
    maxPatientsPerDay: 20,
    alertIfOverbooking: true,
    bufferBetweenAppointments: 15,
  });

  // Settings form state (placeholder)
  const [replacementDoctorId, setReplacementDoctorId] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (schedule?.replacementDoctorId) {
      setReplacementDoctorId(schedule.replacementDoctorId);
    }
  }, [schedule]);

  const handleSaveSchedule = async () => {
    if (!schedule) return;
    try {
      await updateSchedule({ schedule: schedule.schedule });
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateAvailability({
        maxPatientsPerDay: settingsForm.maxPatientsPerDay,
        alertIfOverbooking: settingsForm.alertIfOverbooking,
        bufferBetweenAppointments: settingsForm.bufferBetweenAppointments,
      });
      setIsSettingsModalOpen(false);
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleSaveDaysOff = async () => {
    try {
      await setDaysOff(selectedDaysOff);
      setIsDaysOffModalOpen(false);
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleReplacementChange = async (id: string) => {
    setReplacementDoctorId(id);
    await setReplacementDoctor(id);
  };

  if (authLoading || isLoading) {
    return (
      <DoctorLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
        </div>
      </DoctorLayout>
    );
  }

  if (!isAuthenticated) return null;

  const weekStart = new Date(selectedDate);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday

  return (
    <DoctorLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Jadwal & Pengaturan</h1>
            <p className="text-sm text-gray-500">Kelola jadwal praktik dan preferensi Anda</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsSettingsModalOpen(true)}
            >
              <Settings size={16} className="mr-1" />
              Pengaturan
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveSchedule}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save size={16} className="mr-1" />}
              {isSaving ? 'Menyimpan...' : 'Simpan Jadwal'}
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(newDate.getDate() - 7);
              setSelectedDate(newDate);
            }}
            className="p-2 rounded-lg hover:bg-neutral transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="font-medium text-gray-700">
            {weekStart.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={() => {
              const newDate = new Date(selectedDate);
              newDate.setDate(newDate.getDate() + 7);
              setSelectedDate(newDate);
            }}
            className="p-2 rounded-lg hover:bg-neutral transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Weekly Calendar */}
        <Card className="p-4">
          <div className="grid grid-cols-7 gap-2">
            {DAYS.map((day, index) => {
              const daySchedule = schedule?.schedule[index];
              const isActive = daySchedule?.isActive ?? false;
              const slots = daySchedule?.slots ?? [];
              const isDayOff = schedule?.daysOff?.includes(day) ?? false;

              return (
                <div key={day} className={`p-3 rounded-lg border ${isDayOff ? 'bg-red-50 border-red-200' : isActive ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{day}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleDay(index)}
                        className={`text-xs px-2 py-0.5 rounded transition-colors ${isActive ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'}`}
                      >
                        {isActive ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  </div>

                  {isActive && !isDayOff && (
                    <div className="space-y-1">
                      {slots.map((slot, slotIndex) => (
                        <div key={slotIndex} className="flex items-center gap-1 text-xs">
                          <input
                            type="time"
                            value={slot.start}
                            onChange={(e) => updateSlot(index, slotIndex, 'start', e.target.value)}
                            className="w-12 px-1 py-0.5 border border-neutral rounded text-xs focus:ring-1 focus:ring-primary outline-none"
                          />
                          <span className="text-gray-400">-</span>
                          <input
                            type="time"
                            value={slot.end}
                            onChange={(e) => updateSlot(index, slotIndex, 'end', e.target.value)}
                            className="w-12 px-1 py-0.5 border border-neutral rounded text-xs focus:ring-1 focus:ring-primary outline-none"
                          />
                          <button
                            onClick={() => removeSlot(index, slotIndex)}
                            className="text-red-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addSlot(index)}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <Plus size={12} /> Tambah
                      </button>
                    </div>
                  )}

                  {isDayOff && (
                    <p className="text-xs text-red-500 text-center mt-1">Libur</p>
                  )}

                  {!isActive && !isDayOff && (
                    <p className="text-xs text-gray-400 text-center mt-1">Tidak aktif</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-green-50 border border-green-200 rounded inline-block" />
              Aktif
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-gray-50 border border-gray-200 rounded inline-block" />
              Tidak aktif
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-red-50 border border-red-200 rounded inline-block" />
              Libur
            </span>
          </div>
        </Card>

        {/* Days Off & Replacement */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <Card>
            <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <CalendarIcon size={18} className="text-primary" />
              Hari Libur
            </h3>
            <div className="flex flex-wrap gap-2">
              {schedule?.daysOff?.length ? (
                schedule.daysOff.map((day) => (
                  <span key={day} className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-sm">
                    {day}
                  </span>
                ))
              ) : (
                <p className="text-sm text-gray-400">Tidak ada hari libur</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                setSelectedDaysOff(schedule?.daysOff || []);
                setIsDaysOffModalOpen(true);
              }}
            >
              Atur Hari Libur
            </Button>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <User size={18} className="text-primary" />
              Dokter Pengganti
            </h3>
            <select
              value={replacementDoctorId}
              onChange={(e) => handleReplacementChange(e.target.value)}
              className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
            >
              <option value="">Pilih dokter pengganti</option>
              {replacementDoctors.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.fullName} - {doc.specialization}
                </option>
              ))}
            </select>
            {schedule?.replacementDoctorId && (
              <p className="text-xs text-green-600 mt-2">
                ✅ Dokter pengganti telah diatur
              </p>
            )}
          </Card>
        </div>

        {/* Settings Modal */}
        <Modal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          title="Pengaturan Preferensi"
          confirmText="Simpan"
          onConfirm={handleSaveSettings}
          cancelText="Batal"
          variant="primary"
        >
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Maks Pasien per Hari</label>
              <input
                type="number"
                value={settingsForm.maxPatientsPerDay}
                onChange={(e) => setSettingsForm({ ...settingsForm, maxPatientsPerDay: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settingsForm.alertIfOverbooking}
                  onChange={(e) => setSettingsForm({ ...settingsForm, alertIfOverbooking: e.target.checked })}
                  className="accent-primary"
                />
                <span className="text-sm">Alert jika overbooking</span>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buffer Antar Appointment (menit)</label>
              <input
                type="number"
                value={settingsForm.bufferBetweenAppointments}
                onChange={(e) => setSettingsForm({ ...settingsForm, bufferBetweenAppointments: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>
        </Modal>

        {/* Days Off Modal */}
        <Modal
          isOpen={isDaysOffModalOpen}
          onClose={() => setIsDaysOffModalOpen(false)}
          title="Atur Hari Libur"
          confirmText="Simpan"
          onConfirm={handleSaveDaysOff}
          cancelText="Batal"
          variant="primary"
        >
          <div className="space-y-2">
            <p className="text-sm text-gray-500">Pilih hari libur (centang hari yang ingin diliburkan)</p>
            {DAYS.map((day) => (
              <label key={day} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedDaysOff.includes(day)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedDaysOff([...selectedDaysOff, day]);
                    } else {
                      setSelectedDaysOff(selectedDaysOff.filter((d) => d !== day));
                    }
                  }}
                  className="accent-primary"
                />
                <span className="text-sm">{day}</span>
              </label>
            ))}
          </div>
        </Modal>
      </div>
    </DoctorLayout>
  );
}
