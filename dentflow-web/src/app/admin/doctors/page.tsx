'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { useAuth } from '@/context/AuthContext';
import { useDoctors } from '@/hooks/useDoctors';
import { DoctorFormModal } from '@/components/admin/DoctorFormModal';
import { DoctorScheduleModal } from '@/components/admin/DoctorScheduleModal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import apiClient from '@/lib/axios';
import { useRouter } from 'next/navigation';
import {
  UserPlus,
  Pencil,
  Power,
  PowerOff,
  Calendar,
  Search,
  Users,
  UserCheck,
  UserX,
} from 'lucide-react';

type ViewMode = 'table' | 'schedule';

const DAY_TO_NUMBER: Record<string, number> = {
  Minggu: 0,
  Senin: 1,
  Selasa: 2,
  Rabu: 3,
  Kamis: 4,
  Jumat: 5,
  Sabtu: 6,
};

const showToast = (message: string, type: 'success' | 'error') => {
  window.dispatchEvent(
    new CustomEvent('websocket-toast', { detail: { message, type } })
  );
};

export default function DoctorsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const branchId = user?.branchId || 'A';
  const { doctors, isLoading, error, createDoctor, updateDoctor, toggleStatus, refresh } =
    useDoctors({ branchId });

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || isLoading) {
    return (
      <AdminLayout title="Dokter">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  if (!isAuthenticated) return null;

  const filteredDoctors = doctors.filter((doc) =>
    doc.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.specialization.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.licenseNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCount = doctors.filter((d) => d.isActive).length;
  const inactiveCount = doctors.filter((d) => !d.isActive).length;

  return (
    <AdminLayout title="Dokter">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold">Manajemen Dokter</h2>
          <span className="text-sm text-gray-500">{doctors.length} dokter</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={viewMode === 'table' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
          >
            <Users size={16} className="mr-1" />
            Tabel
          </Button>
          <Button
            variant={viewMode === 'schedule' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setViewMode('schedule')}
          >
            <Calendar size={16} className="mr-1" />
            Jadwal
          </Button>
          <Button variant="primary" size="sm" onClick={() => {
            setSelectedDoctor(null);
            setIsFormModalOpen(true);
          }}>
            <UserPlus size={16} className="mr-1" />
            Tambah Dokter
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="text-primary" size={20} />
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-xl font-bold">{doctors.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <UserCheck className="text-green-500" size={20} />
            <div>
              <p className="text-sm text-gray-500">Aktif</p>
              <p className="text-xl font-bold text-green-600">{activeCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <UserX className="text-red-500" size={20} />
            <div>
              <p className="text-sm text-gray-500">Nonaktif</p>
              <p className="text-xl font-bold text-red-600">{inactiveCount}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
          placeholder="Cari dokter (nama, spesialisasi, lisensi)..."
        />
      </div>

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-xl shadow-sm border border-neutral overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Spesialisasi</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lisensi</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Antrian</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral">
                {filteredDoctors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      {isLoading ? 'Memuat...' : 'Tidak ada dokter ditemukan'}
                    </td>
                  </tr>
                ) : (
                  filteredDoctors.map((doc) => (
                    <tr key={doc.id} className="hover:bg-neutral/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{doc.fullName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{doc.specialization}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{doc.licenseNumber}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {doc.queueCount !== undefined ? doc.queueCount : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${doc.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {doc.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          <button
                            onClick={() => {
                              setSelectedDoctor(doc);
                              setIsFormModalOpen(true);
                            }}
                            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedDoctor(doc);
                              setIsScheduleModalOpen(true);
                            }}
                            className="p-1.5 text-purple-500 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Jadwal"
                          >
                            <Calendar size={16} />
                          </button>
                          <button
                            onClick={() => toggleStatus(doc.id)}
                            className={`p-1.5 rounded-lg transition-colors ${doc.isActive ? 'text-red-500 hover:bg-red-50' : 'text-green-500 hover:bg-green-50'}`}
                            title={doc.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                          >
                            {doc.isActive ? <PowerOff size={16} /> : <Power size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Schedule View */}
      {viewMode === 'schedule' && (
        <div className="bg-white rounded-xl shadow-sm border border-neutral p-6">
          <p className="text-gray-500 text-center py-8">
            Klik tombol <Calendar size={16} className="inline" /> di tabel untuk melihat jadwal dokter.
          </p>
        </div>
      )}

      {/* Modals */}
      <DoctorFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setSelectedDoctor(null);
        }}
        onSubmit={async (data) => {
          if (selectedDoctor) {
            await updateDoctor(selectedDoctor.id, data);
          } else {
            await createDoctor(data);
          }
          refresh();
        }}
        doctor={selectedDoctor}
        title={selectedDoctor ? 'Edit Dokter' : 'Tambah Dokter'}
      />

      <DoctorScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => {
          setIsScheduleModalOpen(false);
          setSelectedDoctor(null);
        }}
        doctorName={selectedDoctor?.fullName || ''}
        schedule={selectedDoctor?.schedule || []}
        onSave={async (schedule) => {
          if (!selectedDoctor) {
            throw new Error('Dokter belum dipilih');
          }

          try {
            const schedules = schedule.map((item) => ({
              dayOfWeek: DAY_TO_NUMBER[item.day],
              startTime: item.start,
              endTime: item.end,
              maxPatients: 4,
            }));

            await apiClient.put(`/api/doctors/${selectedDoctor.id}/schedule`, {
              schedules,
            });

            showToast('Jadwal berhasil diperbarui', 'success');
            refresh();
          } catch (err: any) {
            const message =
              err?.response?.data?.message ||
              err?.message ||
              'Gagal menyimpan jadwal';
            showToast(message, 'error');
            throw new Error(message);
          }
        }}
      />
    </AdminLayout>
  );
}
