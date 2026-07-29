'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useBooking } from '@/hooks/useBooking';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PatientLayout } from '@/components/layouts/PatientLayout';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  User,
  Stethoscope,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export default function BookingPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const branchId = user?.branchId || 'A';

  const {
    step,
    doctors,
    selectedDoctor,
    slots,
    selectedSlot,
    selectedDate,
    booking,
    isLoading,
    error,
    isPolling,
    fetchDoctors,
    selectDoctor,
    selectSlot,
    setSelectedDate,
    confirmBooking,
    processPayment,
    resetBooking,
    goBack,
    startPolling,
  } = useBooking(branchId);

  const [notes, setNotes] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const pollCleanupRef = useRef<(() => void) | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Fetch doctors on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchDoctors();
    }
  }, [isAuthenticated, fetchDoctors]);

  // Start polling for slot availability when on slot selection step
  useEffect(() => {
    if (step === 'select-slot' && selectedDoctor) {
      pollCleanupRef.current = startPolling() || null;
    }
    return () => {
      if (pollCleanupRef.current) {
        pollCleanupRef.current();
        pollCleanupRef.current = null;
      }
    };
  }, [step, selectedDoctor, startPolling]);

  const handleConfirmBooking = async () => {
    await confirmBooking(notes);
  };

  const handlePayment = async () => {
    if (!booking) return;
    setPaymentProcessing(true);
    try {
      await processPayment(booking.id);
    } catch (err) {
      // Error handled in hook
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handleReset = () => {
    resetBooking();
    fetchDoctors();
  };

  if (authLoading) {
    return (
      <PatientLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
        </div>
      </PatientLayout>
    );
  }

  if (!isAuthenticated) return null;

  // Step indicator
  const steps = ['Pilih Dokter', 'Pilih Waktu', 'Konfirmasi', 'Bayar'];
  const currentStepIndex = ['select-doctor', 'select-slot', 'confirm', 'payment'].indexOf(step);

  return (
    <PatientLayout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Booking Janji Temu</h1>
          {step !== 'select-doctor' && (
            <Button variant="outline" size="sm" onClick={handleReset}>
              Mulai Ulang
            </Button>
          )}
        </div>

        {/* Step Progress */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((label, index) => (
            <div key={index} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                  index <= currentStepIndex
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {index < currentStepIndex ? <Check size={16} /> : index + 1}
              </div>
              <span
                className={`ml-2 text-sm font-medium hidden sm:inline ${
                  index <= currentStepIndex ? 'text-gray-800' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
              {index < steps.length - 1 && (
                <div
                  className={`w-8 sm:w-12 h-0.5 mx-2 ${
                    index < currentStepIndex ? 'bg-primary' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Step Content */}
        <Card className="p-6">
          {/* Step 1: Select Doctor */}
          {step === 'select-doctor' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                Pilih Dokter
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Pilih dokter spesialis yang sesuai dengan kebutuhan Anda.
              </p>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin text-primary" size={32} />
                </div>
              ) : doctors.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Tidak ada dokter tersedia saat ini.
                </div>
              ) : (
                <div className="space-y-3">
                  {doctors.map((doctor) => (
                    <button
                      key={doctor.id}
                      onClick={() => selectDoctor(doctor)}
                      className="w-full text-left p-4 border border-neutral rounded-xl hover:border-primary hover:bg-primary/5 transition-all flex items-center gap-4"
                    >
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                        <User size={24} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">{doctor.fullName}</p>
                        <p className="text-sm text-gray-500">{doctor.specialization}</p>
                      </div>
                      <ChevronRight className="text-gray-400" size={20} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select Slot */}
          {step === 'select-slot' && selectedDoctor && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => goBack()}
                  className="p-2 rounded-lg hover:bg-neutral transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    Pilih Waktu
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedDoctor.fullName} • {selectedDoctor.specialization}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tanggal
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    // Refresh slots with new date
                    if (selectedDoctor) {
                      selectDoctor(selectedDoctor, e.target.value);
                    }
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                <Clock size={14} />
                <span>Slot diperbarui secara real-time</span>
                {isPolling && (
                  <span className="text-xs text-green-500 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Live
                  </span>
                )}
              </div>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin text-primary" size={32} />
                </div>
              ) : slots.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Tidak ada slot tersedia untuk tanggal ini.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {slots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => selectSlot(slot)}
                      disabled={!slot.isAvailable}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${
                        slot.isAvailable
                          ? selectedSlot?.id === slot.id
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-neutral hover:border-primary/50 hover:bg-primary/5'
                          : 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <p className="font-medium">{slot.startTime}</p>
                      <p className="text-xs text-gray-400">{slot.endTime}</p>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <Button
                  variant="primary"
                  disabled={!selectedSlot || isLoading}
                  onClick={() => {}}
                >
                  Lanjut ke Konfirmasi
                  <ChevronRight size={16} className="ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && selectedDoctor && selectedSlot && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => goBack()}
                  className="p-2 rounded-lg hover:bg-neutral transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <h2 className="text-lg font-semibold text-gray-800">
                  Konfirmasi Booking
                </h2>
              </div>

              <div className="space-y-4 bg-neutral/30 p-4 rounded-lg">
                <div className="flex justify-between">
                  <span className="text-gray-500">Dokter</span>
                  <span className="font-medium">{selectedDoctor.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Spesialisasi</span>
                  <span className="font-medium">{selectedDoctor.specialization}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tanggal</span>
                  <span className="font-medium">{selectedDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Waktu</span>
                  <span className="font-medium">
                    {selectedSlot.startTime} - {selectedSlot.endTime}
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catatan (opsional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none resize-y min-h-[80px]"
                  placeholder="Tambahkan catatan untuk dokter..."
                />
              </div>

              <div className="mt-4 flex justify-end gap-3">
                <Button variant="outline" onClick={() => goBack()}>
                  Kembali
                </Button>
                <Button
                  variant="primary"
                  onClick={handleConfirmBooking}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="animate-spin" size={16} /> : 'Konfirmasi'}
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Payment */}
          {step === 'payment' && booking && (
            <div>
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check size={32} className="text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800">Booking Berhasil!</h2>
                <p className="text-gray-500 mt-1">
                  Kode Booking: <span className="font-mono font-bold text-primary">{booking.bookingCode}</span>
                </p>
              </div>

              <div className="space-y-3 bg-neutral/30 p-4 rounded-lg text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Dokter</span>
                  <span className="font-medium">{booking.doctorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tanggal & Waktu</span>
                  <span className="font-medium">
                    {new Date(booking.slotStart).toLocaleDateString('id-ID')}{' '}
                    {new Date(booking.slotStart).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={handlePayment}
                  disabled={paymentProcessing}
                >
                  {paymentProcessing ? (
                    <Loader2 className="animate-spin mr-2" size={16} />
                  ) : null}
                  {paymentProcessing ? 'Memproses...' : 'Bayar DP Rp 50.000'}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => router.push('/patient/dashboard')}
                >
                  Ke Dashboard
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </PatientLayout>
  );
}
