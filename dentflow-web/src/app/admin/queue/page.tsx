'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { useAuth } from '@/context/AuthContext';
import { useQueue } from '@/hooks/useQueue';
import { WalkInModal } from '@/components/admin/WalkInModal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useRouter } from 'next/navigation';
import { 
  RefreshCw, 
  UserPlus, 
  Download, 
  Phone, 
  CheckCircle, 
  Clock, 
  Users,
  Activity,
  Circle,
  Search
} from 'lucide-react';

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { label: string; className: string }> = {
    WAITING: { label: 'Menunggu', className: 'bg-yellow-100 text-yellow-800' },
    BEING_CALLED: { label: 'Dipanggil', className: 'bg-blue-100 text-blue-800' },
    IN_SERVICE: { label: 'Dilayani', className: 'bg-purple-100 text-purple-800' },
    COMPLETED: { label: 'Selesai', className: 'bg-green-100 text-green-800' },
    NO_SHOW: { label: 'Tidak Datang', className: 'bg-red-100 text-red-800' },
  };
  const { label, className } = config[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${className}`}>{label}</span>;
};

// Format waktu
const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
};

// Estimate wait time (dummy)
const getWaitTime = (position: number) => {
  if (position === 0) return 'Segera';
  const minutes = position * 15;
  if (minutes < 60) return `${minutes} menit`;
  return `${Math.floor(minutes / 60)} jam ${minutes % 60} menit`;
};

export default function AdminQueuePage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [filterDoctor, setFilterDoctor] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const branchId = user?.branchId || 'A';
  
  const {
    queue,
    nowServing,
    isLoading,
    error,
    isLive,
    lastUpdated,
    refresh,
    callNext,
    completePatient,
    addWalkIn,
    exportCSV,
  } = useQueue({
    branchId,
    doctorId: filterDoctor || undefined,
    autoRefresh: true,
    refreshInterval: 5,
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || isLoading) {
    return (
      <AdminLayout title="Antrian">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  if (!isAuthenticated) return null;

  // Filter queue by search
  const filteredQueue = queue.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.patientName.toLowerCase().includes(q) || 
           p.queueNumber.toString().includes(q) ||
           p.doctorName.toLowerCase().includes(q);
  });

  // Get list of doctors for filter & walk-in
  const doctors = Array.from(new Map(queue.map(p => [p.doctorId, { id: p.doctorId, name: p.doctorName, specialization: p.serviceType }])).values());

  return (
    <AdminLayout title="Antrian">
      {/* Header with actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold">Daftar Antrian Hari Ini</h2>
          <div className="flex items-center gap-2">
            <Circle 
              size={12} 
              className={isLive ? 'text-green-500 fill-green-500' : 'text-gray-400 fill-gray-400'} 
            />
            <span className="text-xs text-gray-500">
              {isLive ? 'Live' : 'Offline - Polling'}
            </span>
            {lastUpdated && (
              <span className="text-xs text-gray-400">
                • Update: {lastUpdated.toLocaleTimeString('id-ID')}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw size={16} className="mr-1" />
            Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setIsWalkInModalOpen(true)}>
            <UserPlus size={16} className="mr-1" />
            Walk-in
          </Button>
          <Button variant="secondary" size="sm" onClick={exportCSV}>
            <Download size={16} className="mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Now Serving */}
      {nowServing && (
        <Card className="mb-6 border-l-4 border-primary">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Sedang Dilayani</p>
              <p className="text-2xl font-bold text-primary">#{nowServing.queueNumber}</p>
              <p className="text-lg font-medium">{nowServing.patientName}</p>
              <p className="text-sm text-gray-500">
                {nowServing.doctorName} • {nowServing.serviceType}
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="success" 
                size="sm"
                onClick={() => completePatient(nowServing.id)}
              >
                <CheckCircle size={16} className="mr-1" />
                Selesai
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="text-primary" size={20} />
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-xl font-bold">{queue.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Clock className="text-yellow-500" size={20} />
            <div>
              <p className="text-sm text-gray-500">Menunggu</p>
              <p className="text-xl font-bold">{queue.filter(p => p.status === 'WAITING').length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Phone className="text-blue-500" size={20} />
            <div>
              <p className="text-sm text-gray-500">Dipanggil</p>
              <p className="text-xl font-bold">{queue.filter(p => p.status === 'BEING_CALLED').length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Activity className="text-green-500" size={20} />
            <div>
              <p className="text-sm text-gray-500">Dilayani</p>
              <p className="text-xl font-bold">{queue.filter(p => p.status === 'IN_SERVICE').length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              placeholder="Cari nama atau nomor antrian..."
            />
          </div>
        </div>
        <div className="min-w-[200px]">
          <select
            value={filterDoctor}
            onChange={(e) => setFilterDoctor(e.target.value)}
            className="w-full px-4 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          >
            <option value="">Semua Dokter</option>
            {doctors.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.name} - {doc.specialization}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dokter</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Layanan</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-in</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estimasi</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral">
              {filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    {isLoading ? 'Memuat antrian...' : 'Tidak ada pasien dalam antrian'}
                  </td>
                </tr>
              ) : (
                filteredQueue.map((patient, index) => {
                  const isBeingCalled = patient.status === 'BEING_CALLED';
                  const isWaiting = patient.status === 'WAITING';
                  const isInService = patient.status === 'IN_SERVICE';
                  const isCompleted = patient.status === 'COMPLETED';
                  
                  return (
                    <tr key={patient.id} className={`hover:bg-neutral/30 transition-colors ${isBeingCalled ? 'bg-blue-50' : ''} ${isInService ? 'bg-purple-50' : ''}`}>
                      <td className="px-4 py-3 font-bold text-lg text-gray-700">
                        #{patient.queueNumber}
                      </td>
                      <td className="px-4 py-3 font-medium">{patient.patientName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{patient.doctorName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{patient.serviceType}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatTime(patient.checkInTime)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={patient.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {isWaiting ? getWaitTime(filteredQueue.indexOf(patient)) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {isWaiting && (
                            <Button 
                              variant="primary" 
                              size="sm"
                              onClick={() => callNext(patient.id)}
                            >
                              <Phone size={14} className="mr-1" />
                              Panggil
                            </Button>
                          )}
                          {isBeingCalled && (
                            <Button 
                              variant="success" 
                              size="sm"
                              onClick={() => completePatient(patient.id)}
                            >
                              <CheckCircle size={14} className="mr-1" />
                              Selesai
                            </Button>
                          )}
                          {isInService && (
                            <Button 
                              variant="success" 
                              size="sm"
                              onClick={() => completePatient(patient.id)}
                            >
                              <CheckCircle size={14} className="mr-1" />
                              Selesai
                            </Button>
                          )}
                          {isCompleted && (
                            <span className="text-xs text-gray-400">Selesai</span>
                          )}
                          {patient.status === 'NO_SHOW' && (
                            <span className="text-xs text-red-400">No-show</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Walk-in Modal */}
      <WalkInModal
        isOpen={isWalkInModalOpen}
        onClose={() => setIsWalkInModalOpen(false)}
        onAddWalkIn={addWalkIn}
        doctors={doctors}
        branchId={branchId}
      />
    </AdminLayout>
  );
}
