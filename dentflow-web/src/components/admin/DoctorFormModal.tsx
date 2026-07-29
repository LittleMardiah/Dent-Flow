'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Doctor, DoctorFormData } from '@/lib/api/doctors';

interface DoctorFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: DoctorFormData) => Promise<void>;
  doctor?: Doctor | null;
  title?: string;
}

export const DoctorFormModal: React.FC<DoctorFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  doctor,
  title = 'Tambah Dokter',
}) => {
  const [formData, setFormData] = useState<DoctorFormData>({
    fullName: '',
    email: '',
    specialization: '',
    licenseNumber: '',
    password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const specializations = [
    'Sp.BM (Bedah Mulut)',
    'Sp.KG (Konservasi Gigi)',
    'Sp.KGA (Kedokteran Gigi Anak)',
    'Sp.PM (Penyakit Mulut)',
    'Sp.Ort (Ortodonti)',
    'Sp.Perio (Periodonsia)',
    'Sp.Pros (Prostodonsia)',
    'Sp.RKG (Radiologi Kedokteran Gigi)',
  ];

  useEffect(() => {
    if (doctor) {
      setFormData({
        fullName: doctor.fullName || '',
        email: doctor.email || '',
        specialization: doctor.specialization || '',
        licenseNumber: doctor.licenseNumber || '',
        password: '',
      });
    } else {
      setFormData({
        fullName: '',
        email: '',
        specialization: '',
        licenseNumber: '',
        password: '',
      });
    }
  }, [doctor, isOpen]);

  const handleSubmit = async () => {
    setError(null);

    if (!formData.fullName.trim()) {
      setError('Nama lengkap wajib diisi');
      return;
    }
    if (!formData.email.trim()) {
      setError('Email wajib diisi');
      return;
    }
    if (!formData.specialization) {
      setError('Spesialisasi wajib dipilih');
      return;
    }
    if (!formData.licenseNumber.trim()) {
      setError('Nomor lisensi wajib diisi');
      return;
    }
    if (!doctor && !formData.password?.trim()) {
      setError('Password wajib diisi untuk dokter baru');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      confirmText={isSubmitting ? 'Memproses...' : 'Simpan'}
      onConfirm={handleSubmit}
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
            Nama Lengkap <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
            placeholder="drg. Siti Nurhaliza"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-danger">*</span>
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
            placeholder="dokter@clinic.com"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Spesialisasi <span className="text-danger">*</span>
          </label>
          <select
            value={formData.specialization}
            onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
            className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
            required
          >
            <option value="">Pilih spesialisasi...</option>
            {specializations.map((spec) => (
              <option key={spec} value={spec}>{spec}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nomor Lisensi <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            value={formData.licenseNumber}
            onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
            className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
            placeholder="SIK-2024-001"
            required
          />
        </div>

        {!doctor && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password <span className="text-danger">*</span>
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
              placeholder="Minimal 8 karakter"
              required
            />
            <p className="text-xs text-gray-400 mt-1">Minimal 8 karakter, huruf besar, kecil, dan angka</p>
          </div>
        )}
      </div>
    </Modal>
  );
};
