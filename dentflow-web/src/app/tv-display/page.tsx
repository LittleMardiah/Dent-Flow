'use client';

import { useSearchParams } from 'next/navigation';
import { useTVDisplay } from '@/hooks/useTVDisplay';
import { Suspense } from 'react';

// Inner component that uses useSearchParams
function TVDisplayContent() {
  const searchParams = useSearchParams();
  const branchId = searchParams.get('branch_id') || 'A';
  const doctorId = searchParams.get('doctor_id') || undefined;

  const { data, status, lastUpdated, isLoading, error, refresh } = useTVDisplay({
    branchId,
    doctorId,
    pollInterval: 3,
  });

  // Status label
  const statusLabels = {
    connected: { label: 'Live', className: 'text-green-500' },
    polling: { label: 'Polling (3s)', className: 'text-yellow-500' },
    offline: { label: 'Offline', className: 'text-red-500' },
  };

  const statusInfo = statusLabels[status] || statusLabels.polling;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-xl">Memuat antrian...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center">
          <p className="text-2xl text-red-500 mb-4">⚠️ Gagal memuat data</p>
          <p className="text-gray-400">{error}</p>
          <button
            onClick={refresh}
            className="mt-4 px-6 py-2 bg-primary rounded-lg hover:bg-primary-dark transition-colors"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  const nowServing = data?.nowServing;
  const nextPatients = data?.nextPatients || [];
  const totalWaiting = data?.totalWaiting || 0;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-primary">DentFlow</h1>
          <p className="text-gray-400 text-sm">Cabang {branchId}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-3 justify-end">
            <span
              data-testid="connection-status"
              data-status={status}
              className={`text-sm font-medium ${statusInfo.className}`}
            >
              ● {statusInfo.label}
            </span>
            <span className="text-gray-500 text-sm" data-testid="total-waiting">
              Antrian: {totalWaiting}
            </span>
          </div>
          {lastUpdated && (
            <p className="text-gray-500 text-xs mt-1">
              Update: {lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          )}
        </div>
      </div>

      {/* Now Serving */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center mb-8">
          <p className="text-gray-400 text-2xl uppercase tracking-widest mb-2">Sekarang Melayani</p>
          {nowServing ? (
            <div className="animate-pulse">
              <p
                data-testid="now-serving-number"
                className="text-8xl md:text-9xl font-bold text-primary"
              >
                #{nowServing.queueNumber}
              </p>
              <p className="text-4xl md:text-5xl font-semibold text-white mt-4">
                {nowServing.patientName}
              </p>
            </div>
          ) : (
            <p className="text-4xl text-gray-500" data-testid="no-patient">
              Belum ada pasien
            </p>
          )}
        </div>

        {/* Next Patients */}
        <div className="w-full max-w-4xl">
          <p className="text-gray-400 text-xl text-center mb-4">Antrian Berikutnya</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {nextPatients.length > 0 ? (
              nextPatients.map((patient, index) => (
                <div
                  key={patient.id}
                  data-testid="queue-card"
                  className="bg-gray-800 rounded-xl p-4 text-center border border-gray-700"
                >
                  <p className="text-3xl font-bold text-gray-300">
                    #{patient.queueNumber}
                  </p>
                  <p className="text-lg text-gray-400 mt-1">{patient.patientName}</p>
                  {index === 0 && (
                    <span className="text-xs text-yellow-500 mt-1 inline-block">Next</span>
                  )}
                </div>
              ))
            ) : (
              <div className="col-span-3 text-center text-gray-500 text-lg">
                Tidak ada antrian menunggu
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-gray-600 text-sm border-t border-gray-800 pt-4">
        © {new Date().getFullYear()} DentFlow • Real-time Queue Display
      </div>
    </div>
  );
}

// Main page with Suspense for useSearchParams
export default function TVDisplayPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-xl">Memuat...</p>
        </div>
      </div>
    }>
      <TVDisplayContent />
    </Suspense>
  );
}
