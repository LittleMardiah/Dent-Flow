'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePatientInvoices } from '@/hooks/usePatientInvoices';
import { useRouter } from 'next/navigation';
import { PatientLayout } from '@/components/layouts/PatientLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  FileText,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  CreditCard,
  Download,
  Filter,
} from 'lucide-react';

export default function PatientInvoicesPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const {
    invoices,
    selectedInvoice,
    total,
    totalPages,
    currentPage,
    statusFilter,
    isLoading,
    isDetailLoading,
    isPaying,
    error,
    fetchInvoiceDetail,
    payInvoice,
    setStatusFilter,
    goToPage,
  } = usePatientInvoices();

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

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

  const handlePayInvoice = async (id: string) => {
    setIsPaymentModalOpen(true);
    setSelectedInvoiceId(id);
    await fetchInvoiceDetail(id);
  };

  const confirmPayment = async () => {
    if (!selectedInvoiceId) return;
    setPaymentProcessing(true);
    try {
      await payInvoice(selectedInvoiceId);
    } catch (err) {
      // Error handled in hook
    } finally {
      setPaymentProcessing(false);
      setIsPaymentModalOpen(false);
    }
  };

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

  const statusColors: Record<string, string> = {
    UNPAID: 'bg-yellow-100 text-yellow-800',
    PAID: 'bg-green-100 text-green-800',
    OVERDUE: 'bg-red-100 text-red-800',
  };

  const statusLabels: Record<string, string> = {
    UNPAID: 'Belum Bayar',
    PAID: 'Lunas',
    OVERDUE: 'Overdue',
  };

  const selectedInvoiceData = selectedInvoice || (selectedInvoiceId ? invoices.find(i => i.id === selectedInvoiceId) : null);

  return (
    <PatientLayout>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Invoice & Pembayaran</h1>
        <p className="text-gray-500 text-sm mb-6">
          Lihat dan kelola semua invoice Anda.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Filter */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <span className="text-sm text-gray-600">Filter:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
          >
            <option value="">Semua</option>
            <option value="UNPAID">Belum Bayar</option>
            <option value="PAID">Lunas</option>
            <option value="OVERDUE">Overdue</option>
          </select>
          <button
            onClick={() => setStatusFilter('')}
            className="text-sm text-primary hover:underline"
          >
            Reset
          </button>
        </div>

        {/* Invoice list */}
        {invoices.length === 0 ? (
          <Card className="p-8 text-center text-gray-500">
            <FileText className="mx-auto text-gray-300 mb-2" size={32} />
            <p>Tidak ada invoice ditemukan.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <Card key={invoice.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex-1 min-w-[150px]">
                    <p className="font-medium text-gray-800">
                      #{invoice.invoiceNumber}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(invoice.date).toLocaleDateString('id-ID')}
                    </p>
                  </div>

                  <div className="flex-1 min-w-[100px]">
                    <p className="font-semibold text-gray-800">
                      Rp {invoice.amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400">
                      Jatuh tempo: {new Date(invoice.dueDate).toLocaleDateString('id-ID')}
                    </p>
                  </div>

                  <div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[invoice.status]}`}>
                      {statusLabels[invoice.status] || invoice.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewDetail(invoice.id)}
                      className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Detail"
                    >
                      <Eye size={18} />
                    </button>

                    {invoice.status === 'UNPAID' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handlePayInvoice(invoice.id)}
                      >
                        <CreditCard size={14} className="mr-1" />
                        Bayar
                      </Button>
                    )}

                    {invoice.status === 'PAID' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // TODO: Download PDF receipt
                          alert('Download PDF akan segera hadir!');
                        }}
                      >
                        <Download size={14} className="mr-1" />
                        Receipt
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
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
                <ChevronRightIcon size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Detail Modal */}
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedInvoiceId(null);
          }}
          title={`Invoice #${selectedInvoiceData?.invoiceNumber || 'Detail'}`}
          confirmText="Tutup"
          onConfirm={() => {
            setIsDetailModalOpen(false);
            setSelectedInvoiceId(null);
          }}
          cancelText={null as any}
          variant="primary"
        >
          {isDetailLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
            </div>
          ) : selectedInvoiceData ? (
            <div className="space-y-3">
              {/* Status */}
              <div className="flex items-center justify-between p-3 bg-neutral/30 rounded-lg">
                <span className="text-sm text-gray-500">Status</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[selectedInvoiceData.status]}`}>
                  {statusLabels[selectedInvoiceData.status] || selectedInvoiceData.status}
                </span>
              </div>

              {/* Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400">Tanggal</p>
                  <p className="font-medium">{new Date(selectedInvoiceData.date).toLocaleDateString('id-ID')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Jatuh Tempo</p>
                  <p className="font-medium">{new Date(selectedInvoiceData.dueDate).toLocaleDateString('id-ID')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Total</p>
                  <p className="font-bold text-primary">Rp {selectedInvoiceData.amount.toLocaleString()}</p>
                </div>
                {selectedInvoiceData.paymentMethod && (
                  <div>
                    <p className="text-xs text-gray-400">Metode</p>
                    <p className="font-medium">{selectedInvoiceData.paymentMethod}</p>
                  </div>
                )}
              </div>

              {/* Payment History Timeline */}
              {selectedInvoiceData.payments && selectedInvoiceData.payments.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">Riwayat Pembayaran</p>
                  <div className="space-y-2">
                    {selectedInvoiceData.payments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between text-sm border-b border-neutral/50 py-2">
                        <div>
                          <p className="font-medium">Rp {payment.amount.toLocaleString()}</p>
                          <p className="text-xs text-gray-400">{payment.method}</p>
                        </div>
                        <p className="text-xs text-gray-400">
                          {new Date(payment.paidAt).toLocaleString('id-ID')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Jika PAID, tampilkan pesan immutable */}
              {selectedInvoiceData.status === 'PAID' && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
                  <CheckCircle size={16} />
                  <span>✅ Pembayaran telah diterima. Invoice ini sudah lunas dan tidak dapat diubah.</span>
                </div>
              )}

              {selectedInvoiceData.status === 'UNPAID' && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700 flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>⚠️ Invoice ini belum dibayar. Segera lakukan pembayaran sebelum jatuh tempo.</span>
                </div>
              )}
            </div>
          ) : null}
        </Modal>

        {/* Payment Modal */}
        <Modal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setSelectedInvoiceId(null);
          }}
          title="Konfirmasi Pembayaran"
          confirmText={paymentProcessing ? 'Memproses...' : 'Bayar Sekarang'}
          onConfirm={confirmPayment}
          cancelText="Batal"
          variant="primary"
        >
          <div className="space-y-3">
            {selectedInvoiceData && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Invoice</span>
                  <span className="font-medium">#{selectedInvoiceData.invoiceNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total</span>
                  <span className="font-bold text-primary">Rp {selectedInvoiceData.amount.toLocaleString()}</span>
                </div>
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
                  ⚠️ Anda akan diarahkan ke halaman pembayaran Midtrans.
                  Pastikan koneksi internet stabil.
                </div>
                <p className="text-xs text-gray-400 text-center">
                  Payment will be processed securely via Midtrans.
                </p>
              </>
            )}
          </div>
        </Modal>
      </div>
    </PatientLayout>
  );
}
