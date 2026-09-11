'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DoctorLayout } from '@/components/layouts/DoctorLayout';
import { Button } from '@/components/ui/Button';
import { Search, Plus, Eye, ChevronLeft, ChevronRight, Filter, AlertCircle } from 'lucide-react';
import { doctorProfileApi, EncounterItem, PaginatedEncounters } from '@/lib/api/doctorProfile';

export default function DoctorEmrPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [encounters, setEncounters] = useState<EncounterItem[]>([]);
  const [totalEncounters, setTotalEncounters] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    const fetchEncounters = async () => {
      if (!isAuthenticated) return;

      try {
        setIsLoading(true);
        setError(null);

        const result: PaginatedEncounters = await doctorProfileApi.getMyEncounters({
          page: currentPage,
          limit: 20,
          status: statusFilter || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        });

        setEncounters(result.data || []);
        setTotalEncounters(result.total || 0);
        setTotalPages(result.totalPages || 1);
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.message || 'Gagal memuat data EMR');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEncounters();
  }, [isAuthenticated, currentPage, statusFilter, dateFrom, dateTo]);

  const filteredEncounters = useMemo(() => {
    if (!searchQuery.trim()) return encounters;
    const q = searchQuery.toLowerCase();
    return encounters.filter(
      (e) =>
        e.patientName?.toLowerCase().includes(q) ||
        e.complaint?.toLowerCase().includes(q)
    );
  }, [encounters, searchQuery]);

  const handleFilterChange = () => {
    setCurrentPage(1);
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

  return (
    <DoctorLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Riwayat EMR</h1>
            <p className="text-sm text-gray-500">{totalEncounters} rekam medis</p>
          </div>
          <Button
            variant="primary"
            onClick={() => {
              const confirmed = window.confirm(
                'Anda akan diarahkan ke antrian untuk memilih pasien. Lanjutkan?'
              );
              if (confirmed) {
                router.push('/doctor/queue');
              }
            }}
          >
            <Plus size={16} className="mr-2" />
            EMR Baru
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral p-4 mb-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Cari</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
                  placeholder="Nama pasien / keluhan..."
                />
              </div>
            </div>

            {/* Status */}
            <div className="min-w-[140px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  handleFilterChange();
                }}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
              >
                <option value="">Semua</option>
                <option value="DRAFT">Draft</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>

            {/* Date From */}
            <div className="min-w-[150px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Dari Tanggal</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  handleFilterChange();
                }}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
              />
            </div>

            {/* Date To */}
            <div className="min-w-[150px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Sampai Tanggal</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  handleFilterChange();
                }}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pasien</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tindakan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral">
                {filteredEncounters.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      {searchQuery || statusFilter || dateFrom || dateTo
                        ? 'Tidak ada EMR ditemukan'
                        : 'Belum ada riwayat EMR'}
                    </td>
                  </tr>
                ) : (
                  filteredEncounters.map((encounter) => (
                    <tr key={encounter.id} className="hover:bg-neutral/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(encounter.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{encounter.patientName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">
                        {encounter.treatment || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            encounter.status === 'COMPLETED'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {encounter.status === 'COMPLETED' ? 'Selesai' : 'Draft'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/doctor/emr/${encounter.id}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
                        >
                          <Eye size={14} />
                          Lihat Detail
                        </Link>
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
              Halaman {currentPage} dari {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft size={16} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </DoctorLayout>
  );
}
