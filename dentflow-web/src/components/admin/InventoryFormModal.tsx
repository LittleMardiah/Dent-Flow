'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { InventoryFormData, InventoryItem } from '@/lib/api/inventory';

interface InventoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: InventoryFormData) => Promise<void>;
  item?: InventoryItem | null;
  title?: string;
}

const categories = [
  'Bahan Medis',
  'Obat-obatan',
  'Alat Kesehatan',
  'Bahan Habis Pakai',
  'Peralatan',
  'Lainnya',
];

const units = ['pcs', 'box', 'bottle', 'tube', 'set', 'unit', 'gram', 'ml'];

export const InventoryFormModal: React.FC<InventoryFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  item,
  title = 'Tambah Item',
}) => {
  const [formData, setFormData] = useState<InventoryFormData>({
    itemName: '',
    category: '',
    quantity: 0,
    unit: 'pcs',
    unitCost: 0,
    minLevel: 0,
    supplier: '',
    supplierContact: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setFormData({
        itemName: item.itemName || '',
        category: item.category || '',
        quantity: item.quantity || 0,
        unit: item.unit || 'pcs',
        unitCost: item.unitCost || 0,
        minLevel: item.minLevel || 0,
        supplier: item.supplier || '',
        supplierContact: item.supplierContact || '',
      });
    } else {
      setFormData({
        itemName: '',
        category: '',
        quantity: 0,
        unit: 'pcs',
        unitCost: 0,
        minLevel: 0,
        supplier: '',
        supplierContact: '',
      });
    }
  }, [item, isOpen]);

  const handleSubmit = async () => {
    setError(null);

    if (!formData.itemName.trim()) {
      setError('Nama item wajib diisi');
      return;
    }
    if (!formData.category) {
      setError('Kategori wajib dipilih');
      return;
    }
    if (formData.quantity < 0) {
      setError('Jumlah tidak boleh negatif');
      return;
    }
    if (formData.unitCost < 0) {
      setError('Harga tidak boleh negatif');
      return;
    }
    if (formData.minLevel < 0) {
      setError('Minimum stok tidak boleh negatif');
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

      <div className="space-y-4 max-h-[400px] overflow-y-auto">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nama Item <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            value={formData.itemName}
            onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
            className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
            placeholder="Amalgam Restorative"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kategori <span className="text-danger">*</span>
          </label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
            required
          >
            <option value="">Pilih kategori...</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Jumlah <span className="text-danger">*</span>
            </label>
            <input
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
              min="0"
              step="1"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Satuan <span className="text-danger">*</span>
            </label>
            <select
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
            >
              {units.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Harga Satuan (Rp)
            </label>
            <input
              type="number"
              value={formData.unitCost}
              onChange={(e) => setFormData({ ...formData, unitCost: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
              min="0"
              step="1000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minimum Stok <span className="text-danger">*</span>
            </label>
            <input
              type="number"
              value={formData.minLevel}
              onChange={(e) => setFormData({ ...formData, minLevel: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
              min="0"
              step="1"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Supplier
          </label>
          <input
            type="text"
            value={formData.supplier}
            onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
            className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
            placeholder="PT. Medika Jaya"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kontak Supplier (opsional)
          </label>
          <input
            type="text"
            value={formData.supplierContact}
            onChange={(e) => setFormData({ ...formData, supplierContact: e.target.value })}
            className="w-full px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
            placeholder="081234567890"
          />
        </div>
      </div>
    </Modal>
  );
};
