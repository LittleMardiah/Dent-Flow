'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { PatientDetail } from '@/lib/api/patients';
import { format } from 'date-fns';

interface PatientDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientDetail | null;
  isLoading?: boolean;
}

export const PatientDetailModal: React.FC<PatientDetailModalProps> = ({
  isOpen,
  onClose,
  patient,
  isLoading = false,
}) => {
  const [activeTab, setActiveTab] = useState<'bookings' | 'encounters' | 'invoices'>('bookings');

  if (!patient && !isLoading) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Detail Pasien: ${patient?.fullName || 'Loading...'}`}
      confirmText="Tutup"
      onConfirm={onClose}
      cancelText={null as any}
      variant="primary"
    >
      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
        </div>
      ) : patient ? (
        <>
          {/* Info pasien */}
          <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-neutral/30 rounded-lg">
            <div>
              <p className="text-xs text-gray-400">Nama</p>
              <p className="font-medium">{patient.fullName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Email</p>
              <p className="font-medium">{patient.email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Telepon</p>
              <p className="font-medium">{patient.phone}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Bergabung</p>
              <p className="font-medium">{format(new Date(patient.createdAt), 'dd MMM yyyy')}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-neutral mb-4">
            <button
              onClick={() => setActiveTab('bookings')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'bookings'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Booking ({patient.bookings?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('encounters')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'encounters'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              EMR ({patient.encounters?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'invoices'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Invoice ({patient.invoices?.length || 0})
            </button>
          </div>

          {/* Content */}
          <div className="max-h-[300px] overflow-y-auto">
            {activeTab === 'bookings' && (
              patient.bookings?.length ? (
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-400">
                    <tr>
                      <th className="text-left py-1">Tanggal</th>
                      <th className="text-left py-1">Dokter</th>
                      <th className="text-left py-1">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patient.bookings.map((b: any) => (
                      <tr key={b.id} className="border-t border-neutral/50">
                        <td className="py-2">{b.bookingDate || '-'}</td>
                        <td className="py-2">{b.doctorName || '-'}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            b.status === 'PAYMENT_CONFIRMED' ? 'bg-green-100 text-green-800' :
                            b.status === 'PENDING_PAYMENT' ? 'bg-yellow-100 text-yellow-800' :
                            b.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {b.status || '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-center text-gray-400 py-4">Tidak ada booking</p>
              )
            )}

            {activeTab === 'encounters' && (
              patient.encounters?.length ? (
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-400">
                    <tr>
                      <th className="text-left py-1">Tanggal</th>
                      <th className="text-left py-1">Dokter</th>
                      <th className="text-left py-1">Diagnosis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patient.encounters.map((e: any) => (
                      <tr key={e.id} className="border-t border-neutral/50">
                        <td className="py-2">{e.createdAt ? format(new Date(e.createdAt), 'dd MMM yyyy') : '-'}</td>
                        <td className="py-2">{e.doctorName || '-'}</td>
                        <td className="py-2">{e.diagnosis || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-center text-gray-400 py-4">Tidak ada EMR</p>
              )
            )}

            {activeTab === 'invoices' && (
              patient.invoices?.length ? (
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-400">
                    <tr>
                      <th className="text-left py-1">Invoice</th>
                      <th className="text-left py-1">Total</th>
                      <th className="text-left py-1">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patient.invoices.map((inv: any) => (
                      <tr key={inv.id} className="border-t border-neutral/50">
                        <td className="py-2">{inv.invoiceNumber || inv.id.slice(0, 8)}</td>
                        <td className="py-2">Rp {inv.totalAmount?.toLocaleString() || '0'}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            inv.status === 'PAID' ? 'bg-green-100 text-green-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {inv.status || 'UNPAID'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-center text-gray-400 py-4">Tidak ada invoice</p>
              )
            )}
          </div>
        </>
      ) : null}
    </Modal>
  );
};
