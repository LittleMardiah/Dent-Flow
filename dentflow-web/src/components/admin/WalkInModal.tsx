'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface WalkInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWalkIn: (data: {
    name: string;
    phone: string;
    age?: number;
    doctorId: string;
    branchId: string;
    complaint?: string;
  }) => Promise<any>;
  doctors: { id: string; name: string; specialization: string }[];
  branchId: string;
}

export const WalkInModal: React.FC<WalkInModalProps> = ({
  isOpen,
  onClose,
  onAddWalkIn,
  doctors,
  branchId,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [complaint, setComplaint] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {  // <--- FIX: tanpa parameter
    setError(null);

    if (!name.trim()) {
      setError('Nama pasien wajib diisi');
      return;
    }
    if (!phone.trim()) {
      setError('Nomor telepon wajib diisi');
      return;
    }
    if (!doctorId) {
      setError('Pilih dokter terlebih dahulu');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddWalkIn({
        name: name.trim(),
        phone: phone.trim(),
        age: age ? parseInt(age) : undefined,
        doctorId,
        branchId,
        complaint: complaint.trim() || undefined,
      });
      setName('');
      setPhone('');
      setAge('');
      setDoctorId('');
      setComplaint('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menambahkan walk-in');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tambah Walk-in"
      confirmText={isSubmitting ? 'Memproses...' : 'Tambah'}
      onConfirm={handleSubmit}
      cancelText="Batal"
      variant="primary"
    >
      {error && (
        <div className="bg-danger/10 text-danger p-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      <form className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nama Lengkap <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            placeholder="Masukkan nama pasien"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nomor Telepon <span className="text-danger">*</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            placeholder="081234567890"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Usia (opsional)
          </label>
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            placeholder="25"
            min="0"
            max="150"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Pilih Dokter <span className="text-danger">*</span>
          </label>
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            required
          >
            <option value="">Pilih dokter...</option>
            {doctors.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.name} - {doc.specialization}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Keluhan (opsional)
          </label>
          <textarea
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
            className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-y min-h-[60px]"
            placeholder="Sakit gigi geraham kanan..."
          />
        </div>
      </form>
    </Modal>
  );
};
