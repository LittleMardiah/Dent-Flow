'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  currentQuantity: number;
  onAdjust: (type: 'add' | 'subtract', quantity: number, notes?: string) => Promise<void>;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  itemName,
  currentQuantity,
  onAdjust,
}) => {
  const [type, setType] = useState<'add' | 'subtract'>('add');
  const [quantity, setQuantity] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    if (quantity <= 0) {
      setError('Jumlah harus lebih dari 0');
      return;
    }

    if (type === 'subtract' && quantity > currentQuantity) {
      setError('Jumlah pengurangan melebihi stok saat ini');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAdjust(type, quantity, notes || undefined);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menyesuaikan stok');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Adjust Stok: ${itemName}`}
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
        <p className="text-sm text-gray-500">
          Stok saat ini: <strong>{currentQuantity}</strong>
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipe Penyesuaian
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={type === 'add'}
                onChange={() => setType('add')}
                className="accent-green-500"
              />
              <span className="text-green-600">Tambah (+)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={type === 'subtract'}
                onChange={() => setType('subtract')}
                className="accent-red-500"
              />
              <span className="text-red-600">Kurangi (-)</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Jumlah <span className="text-danger">*</span>
          </label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
            min="0"
            step="1"
            placeholder="Masukkan jumlah"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Catatan (opsional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none resize-y min-h-[60px]"
            placeholder="Alasan penyesuaian stok..."
          />
        </div>
      </div>
    </Modal>
  );
};
