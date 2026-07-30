'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePatientEmr } from '@/hooks/usePatientEmr';
import { useRouter } from 'next/navigation';
import { PatientLayout } from '@/components/layouts/PatientLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  FileText,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Eye,
} from 'lucide-react';

export default function PatientHistoryPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const {
    encounters,
    selectedEncounter,
    total,
    totalPages,
    currentPage,
    isLoading,
    isDetailLoading,
    error,
    fetchEncounterDetail,
    goToPage,
  } = usePatientEmr();

  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    await fetchEncounterDetail(id);
  };

  const handleDownloadPDF = (encounter: any) => {
    // TODO: Implement PDF download (placeholder)
    alert('Fitur download PDF akan segera hadir!');
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

  const statusBadge = (status: string) => {
    if (status === 'COMPLETED') {
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Selesai</span>;
    }
    if (status === 'CANCELLED') {
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Dibatalkan</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{status}</span>;
  };

  return (
    <PatientLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Riwayat Medis</h1>
        <p className="text-gray-500 text-sm mb-6">
          Daftar semua kunjungan dan konsultasi Anda dengan dokter.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Tab selector */}
        <div className="flex border-b border-neutral mb-6">
          <button
            className="px-4 py-2 text-sm font-medium border-b-2 border-primary text-primary"
          >
            <FileText size={14} className="inline mr-1" />
            Riwayat Kunjungan
          </button>
          <button
            className="px-4 py-2 text-sm font-medium text-gray-400 border-b-2 border-transparent"
            disabled
          >
            Resep (V2.0)
          </button>
        </div>

        {/* Encounters list */}
        {encounters.length === 0 ? (
          <Card className="p-8 text-center text-gray-500">
            <FileText className="mx-auto text-gray-300 mb-2" size={32} />
            <p>Belum ada riwayat kunjungan medis.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {encounters.map((encounter) => (
              <Card key={encounter.id} className="overflow-hidden">
                <div
                  className="p-4 cursor-pointer hover:bg-neutral/30 transition-colors"
                  onClick={() => toggleExpand(encounter.id)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                      {expandedId === encounter.id ? (
                        <ChevronDown size={18} className="text-gray-400 flex-shrink-0" />
                      ) : (
                        <ChevronRight size={18} className="text-gray-400 flex-shrink-0" />
                      )}
                      <div>
                        <p className="font-medium text-gray-800">
                          {encounter.doctorName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {encounter.reason || 'Konsultasi'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {new Date(encounter.date).toLocaleDateString('id-ID')}
                      </span>
                      <span>{statusBadge(encounter.status)}</span>
                      {encounter.fee !== undefined && (
                        <span className="font-medium text-gray-700">
                          Rp {encounter.fee.toLocaleString()}
                        </span>
                      )}
                      {encounter.paymentStatus === 'PAID' && (
                        <span className="text-xs text-green-600 font-medium">✓ Lunas</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded detail */}
                {expandedId === encounter.id && (
                  <div className="px-4 pb-4 border-t border-neutral pt-4">
                    {isDetailLoading && expandedId === encounter.id ? (
                      <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-4 border-primary border-t-transparent" />
                      </div>
                    ) : selectedEncounter && selectedEncounter.id === encounter.id ? (
                      <div className="space-y-3 text-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-neutral/30 p-3 rounded-lg">
                          <div>
                            <p className="text-xs text-gray-400">Dokter</p>
                            <p className="font-medium">{selectedEncounter.doctorName}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Cabang</p>
                            <p className="font-medium">{selectedEncounter.branchName}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Tanggal</p>
                            <p className="font-medium">
                              {new Date(selectedEncounter.date).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400">Status</p>
                            <p>{statusBadge(selectedEncounter.status)}</p>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs text-gray-400 font-medium">Keluhan</p>
                          <p className="text-gray-700 bg-white p-2 rounded border border-neutral">
                            {selectedEncounter.chiefComplaint || '-'}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-400 font-medium">Tindakan / Catatan</p>
                          <p className="text-gray-700 bg-white p-2 rounded border border-neutral">
                            {selectedEncounter.treatmentNotes || '-'}
                          </p>
                        </div>

                        {selectedEncounter.prescription && (
                          <div>
                            <p className="text-xs text-gray-400 font-medium">Resep</p>
                            <p className="text-gray-700 bg-white p-2 rounded border border-neutral">
                              {selectedEncounter.prescription}
                            </p>
                          </div>
                        )}

                        {/* NOTE: Diagnosis field is deliberately hidden (patient privacy) */}

                        <div className="flex flex-wrap gap-3 pt-2 border-t border-neutral mt-2">
                          {selectedEncounter.invoiceId && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/patient/invoices/${selectedEncounter.invoiceId}`)}
                            >
                              <Eye size={14} className="mr-1" />
                              Lihat Invoice
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadPDF(selectedEncounter)}
                          >
                            <Download size={14} className="mr-1" />
                            Download PDF
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-gray-500">
              Menampilkan {encounters.length} dari {total} kunjungan
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

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-600">
          <span className="font-medium">🔒 Privasi:</span> Diagnosis medis tidak ditampilkan untuk menjaga privasi pasien. 
          Hanya dokter yang dapat melihat informasi diagnosis lengkap.
        </div>
      </div>
    </PatientLayout>
  );
}
