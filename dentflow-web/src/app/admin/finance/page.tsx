'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { useAuth } from '@/context/AuthContext';
import { useInvoices } from '@/hooks/useInvoices';
import { InvoiceDetailModal } from '@/components/admin/InvoiceDetailModal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useRouter } from 'next/navigation';
import {
  DollarSign,
  CreditCard,
  Clock,
  TrendingUp,
  Eye,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  FileText,
} from 'lucide-react';

export default function FinancePage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const branchId = user?.branchId || 'A';
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const {
    invoices,
    summary,
    selectedInvoice,
    isDetailLoading,
    isLoading,
    error,
    total,
    totalPages,
    currentPage,
    fetchInvoiceDetail,
    addPayment,
    sendReminder,
    downloadPDF,
    goToPage,
    refresh,
  } = useInvoices({
    branchId,
    status: statusFilter,
    dateFrom,
    dateTo,
    sortBy,
    sortOrder: 'desc',
    page: 1,
    limit: 20,
    autoFetch: true,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const handleViewDetail = async (id: string) => {
    setSelectedInvoiceId(id);
    await fetchInvoiceDetail(id);
    setIsDetailModalOpen(true);
  };

  const statusColors: Record<string, string> = {
    UNPAID: 'bg-red-100 text-red-800',
    PAID: 'bg-green-100 text-green-800',
    OVERDUE: 'bg-orange-100 text-orange-800',
  };

  if (authLoading || isLoading) {
    return (
      <AdminLayout title="Keuangan">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <AdminLayout title="Keuangan">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="text-xl font-bold">Manajemen Keuangan & Invoice</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Revenue Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="text-green-500" size={20} />
            <div>
              <p className="text-sm text-gray-500">Hari Ini</p>
              <p className="text-xl font-bold">Rp {summary?.today?.toLocaleString() || '0'}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="text-blue-500" size={20} />
            <div>
              <p className="text-sm text-gray-500">Bulan Ini</p>
              <p className="text-xl font-bold">Rp {summary?.thisMonth?.toLocaleString() || '0'}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CreditCard className="text-purple-500" size={20} />
            <div>
              <p className="text-sm text-gray-500">Tahun Ini</p>
              <p className="text-xl font-bold">Rp {summary?.yearToDate?.toLocaleString() || '0'}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Clock className="text-red-500" size={20} />
            <div>
              <p className="text-sm text-gray-500">Belum Dibayar</p>
              <p className="text-xl font-bold text-red-600">
                Rp {summary?.outstanding?.toLocaleString() || '0'}
              </p>
              <p className="text-xs text-gray-400">{summary?.unpaidCount || 0} invoice</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="flex flex-wrap gap-4 mb-4 text-sm text-gray-500">
        <span>Total Invoice: <strong className="text-gray-800">{summary?.totalInvoices || 0}</strong></span>
        <span>• Lunas: <strong className="text-green-600">{summary?.paidCount || 0}</strong></span>
        <span>• Belum Bayar: <strong className="text-red-600">{summary?.unpaidCount || 0}</strong></span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
        >
          <option value="">Semua Status</option>
          <option value="UNPAID">Belum Bayar</option>
          <option value="PAID">Lunas</option>
          <option value="OVERDUE">Overdue</option>
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
          placeholder="Dari"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
          placeholder="Sampai"
        />

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
        >
          <option value="createdAt">Terbaru</option>
          <option value="amount">Nominal Tertinggi</option>
          <option value="dueDate">Jatuh Tempo</option>
        </select>

        <Button variant="outline" size="sm" onClick={() => {
          setStatusFilter('');
          setDateFrom('');
          setDateTo('');
          setSortBy('createdAt');
        }}>
          Reset Filter
        </Button>
      </div>

      {/* Invoice Table */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pasien</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jatuh Tempo</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    {isLoading ? 'Memuat...' : 'Tidak ada invoice ditemukan'}
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-neutral/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-sm">
                      <span className="text-primary">#{invoice.invoiceNumber}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">{invoice.patientName}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      Rp {invoice.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[invoice.status]}`}>
                        {invoice.status === 'UNPAID' ? 'Belum Bayar' :
                         invoice.status === 'PAID' ? 'Lunas' : 'Overdue'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{invoice.dueDate}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleViewDetail(invoice.id)}
                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Detail"
                      >
                        <Eye size={16} />
                      </button>
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
            Menampilkan {invoices.length} dari {total} invoice
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

      {/* Invoice Detail Modal */}
      <InvoiceDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedInvoiceId(null);
        }}
        invoice={selectedInvoice}
        isLoading={isDetailLoading}
        onAddPayment={selectedInvoice ? async (data) => {
          if (selectedInvoiceId) {
            await addPayment(selectedInvoiceId, data);
          }
        } : undefined}
        onSendReminder={selectedInvoice ? async () => {
          if (selectedInvoiceId) {
            await sendReminder(selectedInvoiceId);
          }
        } : undefined}
        onDownloadPDF={selectedInvoice ? async () => {
          if (selectedInvoiceId) {
            await downloadPDF(selectedInvoiceId);
          }
        } : undefined}
      />
    </AdminLayout>
  );
}
