'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Invoice, PaymentInput } from '@/lib/api/invoices';

interface InvoiceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  isLoading?: boolean;
  onAddPayment?: (data: PaymentInput) => Promise<void>;
  onSendReminder?: () => Promise<void>;
  onDownloadPDF?: () => Promise<void>;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  isOpen,
  onClose,
  invoice,
  isLoading = false,
  onAddPayment,
  onSendReminder,
  onDownloadPDF,
}) => {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePaymentSubmit = async () => {
    setError(null);
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Nominal harus lebih dari 0');
      return;
    }
    if (amount > (invoice?.amount || 0)) {
      setError('Nominal melebihi total invoice');
      return;
    }

    setIsSubmitting(true);
    try {
      if (onAddPayment) {
        await onAddPayment({
          amount,
          method: paymentMethod,
          notes: paymentNotes || undefined,
        });
      }
      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentNotes('');
    } catch (err: any) {
      setError(err.message || 'Gagal input pembayaran');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusColor = {
    UNPAID: 'bg-red-100 text-red-800',
    PAID: 'bg-green-100 text-green-800',
    OVERDUE: 'bg-orange-100 text-orange-800',
  };

  if (!invoice && !isLoading) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Invoice #${invoice?.invoiceNumber || 'Loading...'}`}
        confirmText="Tutup"
        onConfirm={onClose}
        cancelText={null as any}
        variant="primary"
      >
        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
          </div>
        ) : invoice ? (
          <>
            {/* Status & Info */}
            <div className="flex items-center justify-between mb-4 p-3 bg-neutral/30 rounded-lg">
              <div>
                <p className="text-xs text-gray-400">Status</p>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[invoice.status]}`}>
                  {invoice.status}
                </span>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Total</p>
                <p className="text-lg font-bold text-primary">
                  Rp {invoice.amount.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <p className="text-xs text-gray-400">Pasien</p>
                <p className="font-medium">{invoice.patientName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Tanggal Jatuh Tempo</p>
                <p className="font-medium">{invoice.dueDate}</p>
              </div>
              {invoice.paidAt && (
                <div>
                  <p className="text-xs text-gray-400">Dibayar Pada</p>
                  <p className="font-medium">{invoice.paidAt}</p>
                </div>
              )}
              {invoice.paymentMethod && (
                <div>
                  <p className="text-xs text-gray-400">Metode</p>
                  <p className="font-medium">{invoice.paymentMethod}</p>
                </div>
              )}
            </div>

            {/* Items */}
            {invoice.items && invoice.items.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium mb-2">Item</p>
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-400">
                    <tr>
                      <th className="text-left py-1">Deskripsi</th>
                      <th className="text-right py-1">Qty</th>
                      <th className="text-right py-1">Harga</th>
                      <th className="text-right py-1">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item) => (
                      <tr key={item.id} className="border-t border-neutral/50">
                        <td className="py-1">{item.description}</td>
                        <td className="text-right py-1">{item.quantity}</td>
                        <td className="text-right py-1">Rp {item.unitPrice.toLocaleString()}</td>
                        <td className="text-right py-1 font-medium">Rp {item.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Payment History */}
            {invoice.payments && invoice.payments.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium mb-2">Riwayat Pembayaran</p>
                {invoice.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm border-b border-neutral/50 py-2">
                    <div>
                      <p className="font-medium">Rp {p.amount.toLocaleString()}</p>
                      <p className="text-xs text-gray-400">{p.method} • {p.adminName}</p>
                    </div>
                    <p className="text-xs text-gray-400">{p.paidAt}</p>
                  </div>
                ))}
              </div>
            )}

            {invoice.notes && (
              <div className="mb-4 p-2 bg-neutral/30 rounded-lg text-sm text-gray-600">
                <p className="text-xs text-gray-400">Catatan</p>
                <p>{invoice.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-neutral">
              {invoice.status === 'UNPAID' && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsPaymentModalOpen(true)}
                >
                  Input Pembayaran
                </Button>
              )}
              {onSendReminder && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onSendReminder}
                >
                  Kirim Reminder
                </Button>
              )}
              {onDownloadPDF && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDownloadPDF}
                >
                  Download PDF
                </Button>
              )}
              {invoice.status === 'PAID' && (
                <span className="text-xs text-gray-400 self-center ml-2">
                  ✅ Invoice sudah dibayar (immutable)
                </span>
              )}
            </div>
          </>
        ) : null}
      </Modal>

      {/* Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setError(null);
        }}
        title="Input Pembayaran"
        confirmText={isSubmitting ? 'Memproses...' : 'Simpan'}
        onConfirm={handlePaymentSubmit}
        cancelText="Batal"
        variant="primary"
      >
        {error && (
          <div className="bg-danger/10 text-danger p-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nominal <span className="text-danger">*</span>
            </label>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
              placeholder="Masukkan nominal"
              required
            />
            <p className="text-xs text-gray-400 mt-1">Maksimal: Rp {invoice?.amount.toLocaleString()}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Metode <span className="text-danger">*</span>
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as 'CASH' | 'TRANSFER')}
              className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="CASH">Cash</option>
              <option value="TRANSFER">Transfer</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Catatan (opsional)
            </label>
            <textarea
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none resize-y min-h-[60px]"
              placeholder="Catatan pembayaran..."
            />
          </div>
        </div>
      </Modal>
    </>
  );
};
