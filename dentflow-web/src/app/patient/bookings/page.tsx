'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePatientBookings } from '@/hooks/usePatientBookings';
import { useRouter } from 'next/navigation';
import { PatientLayout } from '@/components/layouts/PatientLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FeedbackModal } from '@/components/patient/FeedbackModal';
import {
  Calendar,
  Clock,
  User,
  Stethoscope,
  MapPin,
  XCircle,
  Calendar as CalendarIcon,
  Download,
  Star,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Edit,
} from 'lucide-react';

export default function PatientBookingsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const {
    bookings,
    isLoading,
    error,
    reschedule,
    cancel,
    submitFeedback,
    downloadICal,
  } = usePatientBookings();

  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || isLoading) {
    return (
      <PatientLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
        </div>
      </PatientLayout>
    );
  }

  if (!isAuthenticated) return null;

  const upcoming = bookings.filter(b => 
    b.status !== 'CANCELLED' && b.status !== 'COMPLETED' && b.status !== 'NO_SHOW'
  );
  const past = bookings.filter(b => 
    b.status === 'COMPLETED' || b.status === 'CANCELLED' || b.status === 'NO_SHOW'
  );

  const handleCancel = async () => {
    if (selectedBooking) {
      await cancel(selectedBooking.id);
      setIsCancelModalOpen(false);
      setSelectedBooking(null);
    }
  };

  const handleReschedule = async () => {
    if (selectedBooking && rescheduleDate && rescheduleTime) {
      await reschedule(selectedBooking.id, {
        date: rescheduleDate,
        time: rescheduleTime,
      });
      setIsRescheduleModalOpen(false);
      setSelectedBooking(null);
      setRescheduleDate('');
      setRescheduleTime('');
    }
  };

  const statusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      PENDING: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
      CONFIRMED: { label: 'Terkonfirmasi', className: 'bg-blue-100 text-blue-800' },
      CHECKED_IN: { label: 'Check-in', className: 'bg-purple-100 text-purple-800' },
      COMPLETED: { label: 'Selesai', className: 'bg-green-100 text-green-800' },
      CANCELLED: { label: 'Dibatalkan', className: 'bg-red-100 text-red-800' },
      NO_SHOW: { label: 'Tidak Datang', className: 'bg-gray-100 text-gray-600' },
    };
    const { label, className } = config[status] || config.PENDING;
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${className}`}>{label}</span>;
  };

  return (
    <PatientLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Janji Temu Saya</h1>
        <p className="text-gray-500 text-sm mb-6">
          Kelola semua janji temu Anda yang akan datang dan yang sudah lewat.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Upcoming Appointments */}
        <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Calendar className="text-primary" size={18} />
          Janji Temu Mendatang
        </h2>

        {upcoming.length === 0 ? (
          <Card className="p-8 text-center text-gray-500">
            <Calendar className="mx-auto text-gray-300 mb-2" size={32} />
            <p>Tidak ada janji temu mendatang.</p>
            <Button
              variant="primary"
              size="sm"
              className="mt-3"
              onClick={() => router.push('/patient/booking')}
            >
              Booking Sekarang
            </Button>
          </Card>
        ) : (
          <div className="space-y-4 mb-8">
            {upcoming.map((booking) => (
              <Card key={booking.id} className="p-5 hover:shadow-md transition-shadow border-l-4 border-l-primary">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  {/* Left - Doctor Info */}
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                        <User size={24} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{booking.doctorName}</p>
                        <p className="text-sm text-gray-500">{booking.specialization}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar size={14} />
                            {booking.date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            {booking.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin size={14} />
                            {booking.branchName}
                          </span>
                        </div>
                      </div>
                    </div>
                    {booking.reason && (
                      <p className="text-sm text-gray-600 mt-2 ml-1">
                        <span className="text-gray-400">Alasan:</span> {booking.reason}
                      </p>
                    )}
                  </div>

                  {/* Right - Status & Actions */}
                  <div className="flex flex-col items-end gap-2 min-w-[120px]">
                    <div className="flex items-center gap-2">
                      {booking.isToday && booking.status === 'CONFIRMED' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 animate-pulse">
                          Hari Ini
                        </span>
                      )}
                      {statusBadge(booking.status)}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {booking.isToday && booking.status === 'CONFIRMED' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => router.push('/patient/check-in')}
                        >
                          Check-in
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadICal(booking)}
                      >
                        <Download size={14} className="mr-1" />
                        iCal
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedBooking(booking);
                          setRescheduleDate(booking.date);
                          setRescheduleTime(booking.time);
                          setIsRescheduleModalOpen(true);
                        }}
                        disabled={booking.status === 'CANCELLED' || booking.status === 'COMPLETED'}
                      >
                        <Edit size={14} className="mr-1" />
                        Ubah
                      </Button>
                      {booking.canCancel && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            setSelectedBooking(booking);
                            setIsCancelModalOpen(true);
                          }}
                        >
                          <XCircle size={14} className="mr-1" />
                          Batal
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Past Appointments */}
        {past.length > 0 && (
          <>
            <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Clock className="text-gray-400" size={18} />
              Riwayat Janji Temu
            </h2>
            <div className="space-y-3">
              {past.map((booking) => (
                <Card key={booking.id} className="p-4 opacity-80 hover:opacity-100 transition-opacity">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center flex-shrink-0">
                        <User size={18} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-600">{booking.doctorName}</p>
                        <p className="text-sm text-gray-400">
                          {booking.date} • {booking.time}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {statusBadge(booking.status)}
                      {booking.status === 'COMPLETED' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedBooking(booking);
                            setIsFeedbackModalOpen(true);
                          }}
                        >
                          <Star size={14} className="mr-1" />
                          Feedback
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Cancel Modal */}
        <Modal
          isOpen={isCancelModalOpen}
          onClose={() => {
            setIsCancelModalOpen(false);
            setSelectedBooking(null);
          }}
          title="Batalkan Janji Temu"
          confirmText="Ya, Batalkan"
          onConfirm={handleCancel}
          cancelText="Kembali"
          variant="danger"
        >
          <div className="space-y-3">
            <p className="text-gray-700">
              Apakah Anda yakin ingin membatalkan janji temu dengan{' '}
              <strong>{selectedBooking?.doctorName}</strong>?
            </p>
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
              ⚠️ DP bersifat non-refundable dan tidak akan dikembalikan.
            </div>
          </div>
        </Modal>

        {/* Reschedule Modal */}
        <Modal
          isOpen={isRescheduleModalOpen}
          onClose={() => {
            setIsRescheduleModalOpen(false);
            setSelectedBooking(null);
          }}
          title="Ubah Jadwal"
          confirmText="Simpan"
          onConfirm={handleReschedule}
          cancelText="Batal"
          variant="primary"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Ubah jadwal janji temu dengan <strong>{selectedBooking?.doctorName}</strong>
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tanggal Baru
              </label>
              <input
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Waktu Baru
              </label>
              <input
                type="time"
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                required
              />
            </div>
          </div>
        </Modal>

        {/* Feedback Modal */}
        <FeedbackModal
          isOpen={isFeedbackModalOpen}
          onClose={() => {
            setIsFeedbackModalOpen(false);
            setSelectedBooking(null);
          }}
          bookingId={selectedBooking?.id || ''}
          doctorName={selectedBooking?.doctorName || ''}
          onSubmit={async (data) => {
            if (selectedBooking) {
              await submitFeedback(selectedBooking.id, data);
            }
          }}
        />
      </div>
    </PatientLayout>
  );
}
