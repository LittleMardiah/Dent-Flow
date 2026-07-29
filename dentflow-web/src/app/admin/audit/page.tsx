'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { useAuth } from '@/context/AuthContext';
import { useAuditLogs } from '@/hooks/useAuditLogs';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Clock,
  User,
  Activity,
} from 'lucide-react';

export default function AuditPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const branchId = user?.branchId || 'A';

  const [filterAction, setFilterAction] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const {
    logs,
    total,
    totalPages,
    currentPage,
    actions,
    isLoading,
    isExporting,
    error,
    exportCSV,
    goToPage,
    refresh,
  } = useAuditLogs({
    branchId,
    action: filterAction,
    dateFrom: filterDateFrom,
    dateTo: filterDateTo,
    search: filterSearch,
    page: 1,
    limit: 50,
    autoFetch: true,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const handleSearch = () => {
    setFilterSearch(searchInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const actionLabels: Record<string, string> = {
    USER_REGISTERED: 'Registrasi User',
    USER_LOGIN: 'Login',
    USER_LOGOUT: 'Logout',
    PASSWORD_RESET: 'Reset Password',
    BOOKING_CREATED: 'Booking Dibuat',
    BOOKING_CANCELLED: 'Booking Dibatalkan',
    CHECK_IN_SUCCESS: 'Check-in Berhasil',
    ENCOUNTER_STARTED: 'EMR Dimulai',
    ENCOUNTER_COMPLETED: 'EMR Selesai',
    PAYMENT_CONFIRMED: 'Pembayaran Dikonfirmasi',
    INVOICE_GENERATED: 'Invoice Dibuat',
    INVOICE_MARKED_PAID: 'Invoice Dibayar',
    QUEUE_CALLED: 'Antrian Dipanggil',
    WALK_IN_ADDED: 'Walk-in Ditambahkan',
    SYSTEM_HEALTH_CHECK: 'Health Check',
  };

  if (authLoading || isLoading) {
    return (
      <AdminLayout title="Audit Log">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <AdminLayout title="Audit Log">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold">Audit Log</h2>
          <span className="text-sm text-gray-500">{total} entri</span>
          <span className="text-xs text-gray-400 bg-neutral/50 px-2 py-1 rounded-full">
            Immutable
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={exportCSV} disabled={isExporting}>
            <Download size={16} className="mr-1" />
            {isExporting ? 'Memproses...' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
        <div className="flex items-center gap-2">
          <FileText size={16} />
          <span>Audit log bersifat <strong>immutable</strong> — data tidak dapat diedit atau dihapus.</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
        >
          <option value="">Semua Aksi</option>
          {actions.map((action) => (
            <option key={action} value={action}>
              {actionLabels[action] || action}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={filterDateFrom}
          onChange={(e) => setFilterDateFrom(e.target.value)}
          className="px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
          placeholder="Dari"
        />
        <input
          type="date"
          value={filterDateTo}
          onChange={(e) => setFilterDateTo(e.target.value)}
          className="px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
          placeholder="Sampai"
        />

        <div className="flex-1 min-w-[200px] flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-9 pr-4 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
              placeholder="Cari user atau resource..."
            />
          </div>
          <Button variant="primary" size="sm" onClick={handleSearch}>
            Cari
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setFilterAction('');
            setFilterDateFrom('');
            setFilterDateTo('');
            setSearchInput('');
            setFilterSearch('');
          }}
        >
          Reset
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resource</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    {isLoading ? 'Memuat...' : 'Tidak ada log ditemukan'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(log.timestamp).toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3 font-medium">{log.userName || 'System'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {actionLabels[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {log.resource} {log.resourceId && <span className="text-xs text-gray-400">#{log.resourceId.slice(0, 8)}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{log.ipAddress || '-'}</td>
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
            Menampilkan {logs.length} dari {total} entri
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
    </AdminLayout>
  );
}
