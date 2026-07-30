'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useDoctorEmr } from '@/hooks/useDoctorEmr';
import { useRouter, useSearchParams } from 'next/navigation';
import { DoctorLayout } from '@/components/layouts/DoctorLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  Activity,
  Heart,
  Thermometer,
  Weight,
  Ruler,
  Plus,
  Trash2,
  Search,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Pill,
} from 'lucide-react';
import { Suspense } from 'react';

// Inner component for search params
function NewEMRContent() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const patientId = searchParams.get('patientId') || '';
  const bookingId = searchParams.get('bookingId') || '';
  const patientName = searchParams.get('patientName') || 'Pasien';

  const doctorId = user?.id || '';

  const {
    complaint,
    setComplaint,
    diagnosis,
    setDiagnosis,
    treatment,
    setTreatment,
    notes,
    setNotes,
    vitalSigns,
    setVitalSigns,
    prescriptions,
    pastPrescriptions,
    inventory,
    isLoading,
    isSubmitting,
    isDraftSaved,
    error,
    addPrescription,
    removePrescription,
    updatePrescription,
    submitEncounter,
    clearDraft,
  } = useDoctorEmr(patientId, doctorId, bookingId);

  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
  const [searchInventory, setSearchInventory] = useState('');
  const [selectedMedication, setSelectedMedication] = useState<any>(null);
  const [newPrescription, setNewPrescription] = useState({
    dosage: '',
    frequency: '',
    duration: '',
    notes: '',
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
    if (!patientId || !bookingId) {
      // Redirect if missing params
      router.push('/doctor/queue');
    }
  }, [authLoading, isAuthenticated, patientId, bookingId, router]);

  const handleAddPrescription = () => {
    if (!selectedMedication) return;
    if (!newPrescription.dosage || !newPrescription.frequency) {
      alert('Dosage dan frekuensi wajib diisi');
      return;
    }
    addPrescription({
      medicationId: selectedMedication.id,
      medicationName: selectedMedication.itemName,
      dosage: newPrescription.dosage,
      frequency: newPrescription.frequency,
      duration: newPrescription.duration,
      notes: newPrescription.notes || undefined,
    });
    setSelectedMedication(null);
    setNewPrescription({ dosage: '', frequency: '', duration: '', notes: '' });
    setSearchInventory('');
    setIsPrescriptionModalOpen(false);
  };

  const handleSubmit = async () => {
    try {
      await submitEncounter();
      router.push('/doctor/queue');
    } catch (err) {
      // Error already handled in hook
    }
  };

  const filteredInventory = inventory.filter((item) =>
    item.itemName.toLowerCase().includes(searchInventory.toLowerCase())
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
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Input Rekam Medis (EMR)</h1>
            <p className="text-sm text-gray-500">
              Pasien: <span className="font-medium">{patientName}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isDraftSaved && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle size={14} /> Draft tersimpan
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/doctor/queue')}
            >
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin mr-2" size={16} />
              ) : null}
              {isSubmitting ? 'Menyimpan...' : 'Simpan & Selesai'}
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Vital Signs */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Activity size={18} className="text-primary" />
              Tanda Vital
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs text-gray-500">Tekanan Darah</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={vitalSigns.bloodPressureSystolic || ''}
                    onChange={(e) =>
                      setVitalSigns({ ...vitalSigns, bloodPressureSystolic: parseFloat(e.target.value) || undefined })
                    }
                    className="w-16 px-2 py-1 border border-neutral rounded text-sm focus:ring-2 focus:ring-primary outline-none"
                    placeholder="120"
                  />
                  <span className="text-gray-400">/</span>
                  <input
                    type="number"
                    value={vitalSigns.bloodPressureDiastolic || ''}
                    onChange={(e) =>
                      setVitalSigns({ ...vitalSigns, bloodPressureDiastolic: parseFloat(e.target.value) || undefined })
                    }
                    className="w-16 px-2 py-1 border border-neutral rounded text-sm focus:ring-2 focus:ring-primary outline-none"
                    placeholder="80"
                  />
                  <span className="text-xs text-gray-400 ml-1">mmHg</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500">Heart Rate</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={vitalSigns.heartRate || ''}
                    onChange={(e) =>
                      setVitalSigns({ ...vitalSigns, heartRate: parseFloat(e.target.value) || undefined })
                    }
                    className="w-20 px-2 py-1 border border-neutral rounded text-sm focus:ring-2 focus:ring-primary outline-none"
                    placeholder="72"
                  />
                  <span className="text-xs text-gray-400">bpm</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500">Suhu</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    value={vitalSigns.temperature || ''}
                    onChange={(e) =>
                      setVitalSigns({ ...vitalSigns, temperature: parseFloat(e.target.value) || undefined })
                    }
                    className="w-20 px-2 py-1 border border-neutral rounded text-sm focus:ring-2 focus:ring-primary outline-none"
                    placeholder="36.5"
                  />
                  <span className="text-xs text-gray-400">°C</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500">Berat</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    value={vitalSigns.weight || ''}
                    onChange={(e) =>
                      setVitalSigns({ ...vitalSigns, weight: parseFloat(e.target.value) || undefined })
                    }
                    className="w-20 px-2 py-1 border border-neutral rounded text-sm focus:ring-2 focus:ring-primary outline-none"
                    placeholder="65"
                  />
                  <span className="text-xs text-gray-400">kg</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500">Tinggi</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    value={vitalSigns.height || ''}
                    onChange={(e) =>
                      setVitalSigns({ ...vitalSigns, height: parseFloat(e.target.value) || undefined })
                    }
                    className="w-20 px-2 py-1 border border-neutral rounded text-sm focus:ring-2 focus:ring-primary outline-none"
                    placeholder="165"
                  />
                  <span className="text-xs text-gray-400">cm</span>
                </div>
              </div>
            </div>
          </Card>

          {/* EMR Form */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <FileText size={18} className="text-primary" />
              Rekam Medis
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Keluhan <span className="text-danger">*</span>
                </label>
                <textarea
                  value={complaint}
                  onChange={(e) => setComplaint(e.target.value)}
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
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
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
                  value={treatment}
                  onChange={(e) => setTreatment(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Tindakan yang dilakukan"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Catatan
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none resize-y min-h-[80px]"
                  placeholder="Catatan internal dokter"
                />
              </div>
            </div>
          </Card>

          {/* Prescriptions */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                <Pill size={18} className="text-primary" />
                Resep
              </h2>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsPrescriptionModalOpen(true)}
              >
                <Plus size={14} className="mr-1" />
                Tambah Obat
              </Button>
            </div>

            {prescriptions.length === 0 ? (
              <p className="text-sm text-gray-400">Belum ada resep ditambahkan.</p>
            ) : (
              <div className="space-y-2">
                {prescriptions.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-neutral/30 rounded-lg">
                    <div>
                      <p className="font-medium">{p.medicationName}</p>
                      <p className="text-sm text-gray-500">
                        {p.dosage} • {p.frequency} • {p.duration || '-'}
                      </p>
                      {p.notes && <p className="text-xs text-gray-400">{p.notes}</p>}
                    </div>
                    <button
                      onClick={() => removePrescription(p.id!)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Past Prescriptions Reference */}
            {pastPrescriptions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-neutral">
                <p className="text-xs text-gray-400 font-medium">Riwayat Resep Sebelumnya</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {pastPrescriptions.slice(0, 5).map((p, idx) => (
                    <span key={idx} className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                      {p.medicationName} ({p.dosage})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Upload Image Placeholder */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Lampiran (X-ray, Lab)
            </h2>
            <div className="border-2 border-dashed border-neutral rounded-lg p-8 text-center">
              <p className="text-sm text-gray-400">Drag & drop file di sini, atau klik untuk upload</p>
              <p className="text-xs text-gray-300 mt-1">Maks 5MB • JPG, PNG, PDF</p>
              <Button variant="outline" size="sm" className="mt-3" disabled>
                Upload (Coming Soon)
              </Button>
            </div>
          </Card>
        </div>

        {/* Prescription Modal */}
        <Modal
          isOpen={isPrescriptionModalOpen}
          onClose={() => {
            setIsPrescriptionModalOpen(false);
            setSelectedMedication(null);
            setSearchInventory('');
            setNewPrescription({ dosage: '', frequency: '', duration: '', notes: '' });
          }}
          title="Tambah Resep"
          confirmText="Tambah"
          onConfirm={handleAddPrescription}
          cancelText="Batal"
          variant="primary"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cari Obat <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  value={searchInventory}
                  onChange={(e) => setSearchInventory(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Cari nama obat..."
                />
              </div>
              {searchInventory && filteredInventory.length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto border border-neutral rounded-lg divide-y">
                  {filteredInventory.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedMedication(item)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral/50 transition-colors ${
                        selectedMedication?.id === item.id ? 'bg-primary/10 text-primary' : ''
                      }`}
                    >
                      {item.itemName} ({item.quantity} {item.unit})
                    </button>
                  ))}
                </div>
              )}
              {selectedMedication && (
                <p className="text-xs text-green-600 mt-1">✓ Terpilih: {selectedMedication.itemName}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dosage <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={newPrescription.dosage}
                  onChange={(e) => setNewPrescription({ ...newPrescription, dosage: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  placeholder="500mg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frekuensi <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={newPrescription.frequency}
                  onChange={(e) => setNewPrescription({ ...newPrescription, frequency: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                  placeholder="3x sehari"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Durasi
              </label>
              <input
                type="text"
                value={newPrescription.duration}
                onChange={(e) => setNewPrescription({ ...newPrescription, duration: e.target.value })}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                placeholder="7 hari"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catatan (opsional)
              </label>
              <input
                type="text"
                value={newPrescription.notes}
                onChange={(e) => setNewPrescription({ ...newPrescription, notes: e.target.value })}
                className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
                placeholder="Setelah makan"
              />
            </div>
          </div>
        </Modal>

        {/* Info: Auto-save */}
        <div className="mt-4 flex items-center justify-between text-xs text-gray-400 border-t border-neutral pt-4">
          <span>💾 Auto-save draft setiap 30 detik</span>
          <span>🔒 Data disimpan secara lokal</span>
        </div>
      </div>
    </DoctorLayout>
  );
}

// Main page with Suspense
export default function NewEMRPage() {
  return (
    <Suspense fallback={
      <DoctorLayout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
        </div>
      </DoctorLayout>
    }>
      <NewEMRContent />
    </Suspense>
  );
}
