'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useDoctorQueue } from '@/hooks/useDoctorQueue';
import { useRouter } from 'next/navigation';
import { DoctorLayout } from '@/components/layouts/DoctorLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  Users,
  User,
  Clock,
  Search,
  Phone,
  CheckCircle,
  ChevronRight,
  Loader2,
  AlertCircle,
  Activity,
} from 'lucide-react';

export default function DoctorQueuePage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // Get doctor ID from user (assuming user.id is doctor_id)
  const doctorId = user?.id || '';

  const {
    queue,
    currentPatient,
    nextPatients,
    waitingCount,
    selectedPatient,
    isLoading,
    isDetailLoading,
    isReadyNextLoading,
    error,
    readyNext,
    getPatientQuickView,
    createEncounter,
    setSelectedPatient,
  } = useDoctorQueue(doctorId);

  const [searchQuery, setSearchQuery] = useState('');
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [isEMRModalOpen, setIsEMRModalOpen] = useState(false);

  // EMR form state
  const [emrForm, setEmrForm] = useState({
    complaint: '',
    diagnosis: '',
    treatment: '',
    prescription: '',
    notes: '',
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  const handlePatientClick = async (patientId: string) => {
    await getPatientQuickView(patientId);
    setIsPatientModalOpen(true);
  };

  const handleStartConsultation = () => {
    setIsPatientModalOpen(false);
    setIsEMRModalOpen(true);
    setEmrForm({
      complaint: '',
      diagnosis: '',
      treatment: '',
      prescription: '',
      notes: '',
    });
  };

  const handleSubmitEMR = async () => {
    if (!selectedPatient) return;
    if (!emrForm.complaint.trim() || !emrForm.treatment.trim()) {
      alert('Keluhan dan Tindakan wajib diisi');
      return;
    }

    // Find bookingId from queue (current patient)
    const bookingId = currentPatient?.bookingId || queue.find(q => q.patientId === selectedPatient.id)?.bookingId;
    if (!bookingId) {
      alert('Pasien tidak ditemukan dalam antrian');
      return;
    }

    try {
      await createEncounter({
        bookingId,
        patientId: selectedPatient.id,
        doctorId: doctorId,
        complaint: emrForm.complaint,
        diagnosis: emrForm.diagnosis || undefined,
        treatment: emrForm.treatment,
        prescription: emrForm.prescription || undefined,
        notes: emrForm.notes || undefined,
      });
      setIsEMRModalOpen(false);
      setSelectedPatient(null);
      setEmrForm({
        complaint: '',
        diagnosis: '',
        treatment: '',
        prescription: '',
        notes: '',
      });
    } catch (err) {
      // Error already handled in hook
    }
  };

  const handleReadyNext = async () => {
    await readyNext();
  };

  // Filter queue by search
  const filteredQueue = queue.filter((p) =>
    p.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.queueNumber.toString().includes(searchQuery)
  );

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
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Antrian Hari Ini</h1>
            <p className="text-sm text-gray-500">
              {waitingCount} pasien menunggu • {queue.length} total
            </p>
          </div>
          <Button
            variant="primary"
            onClick={handleReadyNext}
            disabled={isReadyNextLoading || queue.length === 0}
          >
            {isReadyNextLoading ? (
              <Loader2 className="animate-spin mr-2" size={16} />
            ) : (
              <Phone size={16} className="mr-2" />
            )}
            {isReadyNextLoading ? 'Memproses...' : 'Panggil Berikutnya'}
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Current Patient */}
        {currentPatient && (
          <Card className="mb-6 border-l-4 border-l-primary bg-primary/5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold">
                  #{currentPatient.queueNumber}
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-800">
                    {currentPatient.patientName}
                  </p>
                  <p className="text-sm text-gray-500">
                    Check-in: {new Date(currentPatient.checkInTime).toLocaleTimeString('id-ID')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {currentPatient.isWalkIn && (
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 ring-1 ring-amber-300">
                    WALK-IN
                  </span>
                )}
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  Sedang Dilayani
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePatientClick(currentPatient.patientId)}
                >
                  <User size={14} className="mr-1" />
                  Detail
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
              <Users size={16} />
              Menunggu
            </div>
            <p className="text-2xl font-bold text-gray-800">{waitingCount}</p>
          </Card>
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
              <Activity size={16} />
              Dipanggil
            </div>
            <p className="text-2xl font-bold text-primary">
              {queue.filter(p => p.status === 'BEING_CALLED').length}
            </p>
          </Card>
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
              <Clock size={16} />
              Selesai
            </div>
            <p className="text-2xl font-bold text-green-600">
              {queue.filter(p => p.status === 'COMPLETED').length}
            </p>
          </Card>
        </div>

        {/* Next Patients */}
        {nextPatients.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
              Antrian Berikutnya
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {nextPatients.map((patient, index) => (
                <Card key={patient.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-bold text-gray-700">#{patient.queueNumber}</p>
                      <p className="font-medium text-gray-800">{patient.patientName}</p>
                      {patient.isWalkIn && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 ring-1 ring-amber-300">
                          WALK-IN
                        </span>
                      )}
                      <p className="text-xs text-gray-400">
                        {patient.waitTimeMinutes} menit menunggu
                      </p>
                    </div>
                    <button
                      onClick={() => handlePatientClick(patient.patientId)}
                      className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
            placeholder="Cari pasien (nama atau nomor antrian)..."
          />
        </div>

        {/* Full Queue Table */}
        <div className="bg-white rounded-xl shadow-sm border border-neutral overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check-in</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral">
                {filteredQueue.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      {searchQuery ? 'Tidak ada pasien ditemukan' : 'Antrian kosong'}
                    </td>
                  </tr>
                ) : (
                  filteredQueue.map((patient) => {
                    const isCurrent = currentPatient?.id === patient.id;
                    return (
                      <tr key={patient.id} className={`hover:bg-neutral/30 transition-colors ${isCurrent ? 'bg-primary/5' : ''}`}>
                        <td className="px-4 py-3 font-bold text-lg text-gray-700">
                          #{patient.queueNumber}
                        </td>
                        <td className="px-4 py-3 font-medium">{patient.patientName}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {new Date(patient.checkInTime).toLocaleTimeString('id-ID')}
                        </td>
                        <td className="px-4 py-3">
                          {patient.isWalkIn && (
                            <span className="inline-block mr-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 ring-1 ring-amber-300">
                              WALK-IN
                            </span>
                          )}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            patient.status === 'WAITING' ? 'bg-yellow-100 text-yellow-800' :
                            patient.status === 'BEING_CALLED' ? 'bg-blue-100 text-blue-800' :
                            patient.status === 'IN_SERVICE' ? 'bg-purple-100 text-purple-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {patient.status === 'WAITING' ? 'Menunggu' :
                             patient.status === 'BEING_CALLED' ? 'Dipanggil' :
                             patient.status === 'IN_SERVICE' ? 'Dilayani' : 'Selesai'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handlePatientClick(patient.patientId)}
                            className="text-primary hover:underline text-sm"
                          >
                            Detail
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Patient Detail Modal */}
        <Modal
          isOpen={isPatientModalOpen}
          onClose={() => {
            setIsPatientModalOpen(false);
            setSelectedPatient(null);
          }}
          title={`Detail Pasien`}
          confirmText={selectedPatient ? 'Mulai Konsultasi' : 'Tutup'}
          onConfirm={selectedPatient ? handleStartConsultation : () => setIsPatientModalOpen(false)}
          cancelText="Batal"
          variant="primary"
        >
          {isDetailLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          ) : selectedPatient ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-gray-400">Nama</p>
                  <p className="font-medium">{selectedPatient.fullName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Telepon</p>
                  <p className="font-medium">{selectedPatient.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Email</p>
                  <p className="font-medium">{selectedPatient.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Usia</p>
                  <p className="font-medium">{selectedPatient.age || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Total Kunjungan</p>
                  <p className="font-medium">{selectedPatient.totalVisits}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Kunjungan Terakhir</p>
                  <p className="font-medium">
                    {selectedPatient.lastVisit ? new Date(selectedPatient.lastVisit).toLocaleDateString('id-ID') : '-'}
                  </p>
                </div>
              </div>

              {selectedPatient.medicalConditions.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 font-medium">Kondisi Medis</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedPatient.medicalConditions.map((cond, i) => (
                      <span key={i} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">
                        {cond}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedPatient.allergies.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 font-medium">Alergi</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedPatient.allergies.map((allergy, i) => (
                      <span key={i} className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-xs">
                        {allergy}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </Modal>

        {/* EMR Form Modal */}
        <Modal
          isOpen={isEMRModalOpen}
          onClose={() => setIsEMRModalOpen(false)}
          title="Input Rekam Medis (EMR)"
          confirmText="Simpan & Selesai"
          onConfirm={handleSubmitEMR}
          cancelText="Batal"
          variant="primary"
        >
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Keluhan <span className="text-danger">*</span>
              </label>
              <textarea
                value={emrForm.complaint}
                onChange={(e) => setEmrForm({ ...emrForm, complaint: e.target.value })}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none resize-y min-h-[60px]"
                placeholder="Apa yang dikeluhkan pasien?"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Diagnosa
              </label>
              <input
                type="text"
                value={emrForm.diagnosis}
                onChange={(e) => setEmrForm({ ...emrForm, diagnosis: e.target.value })}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                placeholder="ICD-10 atau diagnosa"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tindakan <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={emrForm.treatment}
                onChange={(e) => setEmrForm({ ...emrForm, treatment: e.target.value })}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                placeholder="Tindakan yang dilakukan"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Resep (opsional)
              </label>
              <textarea
                value={emrForm.prescription}
                onChange={(e) => setEmrForm({ ...emrForm, prescription: e.target.value })}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none resize-y min-h-[60px]"
                placeholder="Resep atau anjuran"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catatan (opsional)
              </label>
              <textarea
                value={emrForm.notes}
                onChange={(e) => setEmrForm({ ...emrForm, notes: e.target.value })}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none resize-y min-h-[60px]"
                placeholder="Catatan internal dokter"
              />
            </div>
          </div>
        </Modal>
      </div>
    </DoctorLayout>
  );
}
