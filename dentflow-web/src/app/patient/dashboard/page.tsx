'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePatient } from '@/hooks/usePatient';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { HealthTipsCarousel } from '@/components/patient/HealthTipsCarousel';
import { PatientLayout } from '@/components/layouts/PatientLayout';
import {
  Calendar,
  Clock,
  User,
  Stethoscope,
  ChevronRight,
  Plus,
  Home,
} from 'lucide-react';

export default function PatientDashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { dashboard, isLoading, refresh } = usePatient();

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

  const upcoming = dashboard?.upcomingAppointment;
  const recentBookings = dashboard?.recentBookings || [];

  return (
    <PatientLayout>
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          Selamat datang, {user?.name || 'Pasien'}! 👋
        </h1>
        <p className="text-gray-500 mt-1">
          Kelola janji temu dan kesehatan gigi Anda di sini.
        </p>
      </div>

      {/* Quick Action */}
      <div className="mb-6">
        <Button
          variant="primary"
          size="lg"
          className="w-full md:w-auto"
          onClick={() => router.push('/patient/booking')}
        >
          <Plus size={18} className="mr-2" />
          Booking Janji Temu Baru
        </Button>
      </div>

      {/* Upcoming Appointment */}
      {upcoming ? (
        <Card className="mb-6 border-l-4 border-primary">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500">Janji Temu Berikutnya</p>
              <h3 className="text-lg font-bold text-gray-800">
                {upcoming.doctorName}
              </h3>
              <p className="text-sm text-gray-600">
                {upcoming.specialization}
              </p>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {upcoming.date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {upcoming.time}
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/patient/bookings/${upcoming.id}`)}
            >
              Lihat Detail
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="mb-6 p-6 text-center bg-neutral/30">
          <Calendar className="mx-auto text-gray-400 mb-2" size={32} />
          <p className="text-gray-500">Belum ada janji temu mendatang.</p>
          <Button
            variant="primary"
            size="sm"
            className="mt-3"
            onClick={() => router.push('/patient/booking')}
          >
            Booking Sekarang
          </Button>
        </Card>
      )}

      {/* Health Tips */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          💡 Tips Kesehatan Gigi
        </h2>
        <HealthTipsCarousel />
      </div>

      {/* Recent Bookings */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">
            📋 Riwayat Booking Terbaru
          </h2>
          <button
            onClick={() => router.push('/patient/bookings')}
            className="text-sm text-primary hover:underline flex items-center"
          >
            Lihat Semua <ChevronRight size={14} />
          </button>
        </div>

        {recentBookings.length === 0 ? (
          <Card className="p-6 text-center text-gray-500">
            Belum ada riwayat booking.
          </Card>
        ) : (
          <div className="space-y-3">
            {recentBookings.map((booking) => (
              <Card key={booking.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-800">{booking.doctorName}</p>
                    <p className="text-sm text-gray-500">{booking.date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        booking.status === 'PAYMENT_CONFIRMED'
                          ? 'bg-green-100 text-green-800'
                          : booking.status === 'PENDING_PAYMENT'
                          ? 'bg-yellow-100 text-yellow-800'
                          : booking.status === 'CANCELLED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {booking.status === 'PAYMENT_CONFIRMED'
                        ? 'Terkonfirmasi'
                        : booking.status === 'PENDING_PAYMENT'
                        ? 'Menunggu Bayar'
                        : booking.status === 'CANCELLED'
                        ? 'Dibatalkan'
                        : booking.status}
                    </span>
                    <button
                      onClick={() => router.push(`/patient/bookings/${booking.id}`)}
                      className="text-primary hover:underline text-sm"
                    >
                      Detail
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PatientLayout>
  );
}
