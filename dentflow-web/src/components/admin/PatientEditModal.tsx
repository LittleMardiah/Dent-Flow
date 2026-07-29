'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Patient, PatientFormData } from '@/lib/api/patients';

interface PatientEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
  onSubmit: (data: PatientFormData) => Promise<void>;
}

export const PatientEditModal: React.FC<PatientEditModalProps> = ({
  isOpen,
  onClose,
  patient,
  onSubmit,
}) => {
  const [formData, setFormData] = useState<PatientFormData>({
    fullName: '',
    email: '',
    phone: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (patient) {
      setFormData({
        fullName: patient.fullName || '',
        email: patient.email || '',
        phone: patient.phone || '',
      });
    }
  }, [patient, isOpen]);

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
    if (!formData.phone.trim()) {
      setError('Nomor telepon wajib diisi');
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
      title={`Edit Pasien: ${patient?.fullName || ''}`}
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
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nomor Telepon <span className="text-danger">*</span>
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
            required
          />
        </div>
      </div>
    </Modal>
  );
};
