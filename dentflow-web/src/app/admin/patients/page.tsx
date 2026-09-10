'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { useAuth } from '@/context/AuthContext';
import { usePatients } from '@/hooks/usePatients';
import { patientsApi } from '@/lib/api/patients';
import { PatientDetailModal } from '@/components/admin/PatientDetailModal';
import { PatientEditModal } from '@/components/admin/PatientEditModal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useRouter } from 'next/navigation';
import {
  Search,
  Eye,
  Pencil,
  Users,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  User,
} from 'lucide-react';

export default function PatientsPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [accessibleBranches, setAccessibleBranches] = useState<{ id: string; name: string }[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);

  const branchId = activeBranchId || user?.branchId || 'A';
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const {
    patients,
    total,
    totalPages,
    currentPage,
    isLoading,
    error,
    selectedPatient,
    isDetailLoading,
    fetchPatientDetail,
    updatePatient,
    goToPage,
    refresh,
  } = usePatients({
    branchId,
    search: searchQuery,
    page: 1,
    limit: 20,
    autoFetch: true,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Muat daftar branch yang boleh diakses (own + granted)
  useEffect(() => {
    if (!isAuthenticated) return;
    patientsApi
      .getAccessibleBranches()
      .then((branches) => {
        setAccessibleBranches(branches);
        setActiveBranchId((prev) => prev || branches[0]?.id || null);
      })
      .catch((err: any) => {
        console.error('Gagal memuat cabang:', err?.message || err);
      });
  }, [isAuthenticated]);

  // Handle search
  const handleSearch = () => {
    setSearchQuery(searchInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // View patient detail
  const handleViewDetail = async (id: string) => {
    setSelectedPatientId(id);
    await fetchPatientDetail(id);
    setIsDetailModalOpen(true);
  };

  // Edit patient
  const handleEdit = (id: string) => {
    setSelectedPatientId(id);
    setIsEditModalOpen(true);
  };

  if (authLoading || isLoading) {
    return (
      <AdminLayout title="Pasien">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  if (!isAuthenticated) return null;

  const patientForEdit = patients.find((p) => p.id === selectedPatientId);

  return (
    <AdminLayout title="Pasien">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold">Manajemen Pasien</h2>
          <span className="text-sm text-gray-500">{total} pasien</span>
          {accessibleBranches.length > 1 && (
            <select
              data-testid="branch-switcher"
              value={activeBranchId || branchId}
              onChange={(e) => setActiveBranchId(e.target.value)}
              className="px-3 py-1.5 border border-neutral rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary outline-none"
            >
              {accessibleBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="primary" size="sm">
            <UserPlus size={16} className="mr-1" />
            Tambah Pasien
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="text-primary" size={20} />
            <div>
              <p className="text-sm text-gray-500">Total Pasien</p>
              <p className="text-xl font-bold">{total}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <User className="text-green-500" size={20} />
            <div>
              <p className="text-sm text-gray-500">Aktif</p>
              <p className="text-xl font-bold">{patients.filter(p => p.totalBookings && p.totalBookings > 0).length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="text-blue-500" size={20} />
            <div>
              <p className="text-sm text-gray-500">Halaman Ini</p>
              <p className="text-xl font-bold">{patients.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-9 pr-4 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
            placeholder="Cari pasien (nama, telepon, email)..."
          />
        </div>
        <Button variant="primary" onClick={handleSearch}>
          Cari
        </Button>
        <Button variant="outline" onClick={() => { setSearchInput(''); setSearchQuery(''); }}>
          Reset
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telepon</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total Booking</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kunjungan Terakhir</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral">
              {patients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    {isLoading ? 'Memuat...' : 'Tidak ada pasien ditemukan'}
                  </td>
                </tr>
              ) : (
                patients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-neutral/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{patient.fullName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{patient.phone}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{patient.email}</td>
                    <td className="px-4 py-3 text-center text-sm font-medium">
                      {patient.totalBookings || 0}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {patient.lastVisit ? new Date(patient.lastVisit).toLocaleDateString('id-ID') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleViewDetail(patient.id)}
                          className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Detail"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleEdit(patient.id)}
                          className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil size={16} />
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Menampilkan {patients.length} dari {total} pasien
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-neutral hover:bg-neutral/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium px-3 py-1 bg-primary/10 text-primary rounded-lg">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-neutral hover:bg-neutral/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <PatientDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedPatientId(null);
        }}
        patient={selectedPatient}
        isLoading={isDetailLoading}
      />

      <PatientEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedPatientId(null);
        }}
        patient={patientForEdit || null}
        onSubmit={async (data) => {
          if (selectedPatientId) {
            await updatePatient(selectedPatientId, data);
            refresh();
          }
        }}
      />
    </AdminLayout>
  );
}
