'use client';

import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { useAuth } from '@/context/AuthContext';
import { useInventory } from '@/hooks/useInventory';
import { InventoryFormModal } from '@/components/admin/InventoryFormModal';
import { StockAdjustmentModal } from '@/components/admin/StockAdjustmentModal';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useRouter } from 'next/navigation';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

export default function InventoryPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const branchId = user?.branchId || 'A';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);

  const {
    items,
    suppliers,
    selectedItem,
    isLoading,
    error,
    createItem,
    updateItem,
    adjustStock,
    deleteItem,
    refresh,
  } = useInventory({
    branchId,
    autoFetch: true,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Get unique categories for filter
  const categories = Array.from(new Set(items.map(item => item.category))).filter(Boolean);

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchSearch = item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        item.supplier.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = filterCategory ? item.category === filterCategory : true;
    const matchLowStock = showLowStock ? item.isLowStock : true;
    return matchSearch && matchCategory && matchLowStock;
  });

  const lowStockCount = items.filter(item => item.isLowStock).length;
  const totalValue = items.reduce((sum, item) => sum + (item.unitCost * item.quantity), 0);

  if (authLoading || isLoading) {
    return (
      <AdminLayout title="Inventaris">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  if (!isAuthenticated) return null;

  const selectedItemData = items.find(item => item.id === selectedItemId);

  return (
    <AdminLayout title="Inventaris">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold">Inventaris</h2>
          <span className="text-sm text-gray-500">{items.length} item</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw size={16} className="mr-1" />
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={() => {
            setSelectedItemId(null);
            setIsFormModalOpen(true);
          }}>
            <Plus size={16} className="mr-1" />
            Tambah Item
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Package className="text-primary" size={20} />
            <div>
              <p className="text-sm text-gray-500">Total Item</p>
              <p className="text-xl font-bold">{items.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Package className="text-green-500" size={20} />
            <div>
              <p className="text-sm text-gray-500">Total Nilai</p>
              <p className="text-xl font-bold">Rp {totalValue.toLocaleString()}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className={`${lowStockCount > 0 ? 'text-red-500' : 'text-gray-400'}`} size={20} />
            <div>
              <p className="text-sm text-gray-500">Stok Rendah</p>
              <p className={`text-xl font-bold ${lowStockCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                {lowStockCount}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Package className="text-blue-500" size={20} />
            <div>
              <p className="text-sm text-gray-500">Supplier</p>
              <p className="text-xl font-bold">{suppliers.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none"
              placeholder="Cari item atau supplier..."
            />
          </div>
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 border border-neutral rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
        >
          <option value="">Semua Kategori</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 px-3 py-2 border border-neutral rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={showLowStock}
            onChange={(e) => setShowLowStock(e.target.checked)}
            className="accent-primary w-4 h-4"
          />
          <span className="text-sm">Stok Rendah</span>
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stok</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Harga</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    {isLoading ? 'Memuat...' : 'Tidak ada item ditemukan'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isLowStock = item.quantity <= item.minLevel;
                  return (
                    <tr key={item.id} className={`hover:bg-neutral/30 transition-colors ${isLowStock ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3 font-medium">{item.itemName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.category}</td>
                      <td className={`px-4 py-3 text-right font-medium ${isLowStock ? 'text-red-600' : ''}`}>
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        Rp {item.unitCost.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{item.supplier}</td>
                      <td className="px-4 py-3 text-center">
                        {isLowStock ? (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Stok Rendah
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Normal
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setSelectedItemId(item.id);
                              setIsAdjustModalOpen(true);
                            }}
                            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Adjust Stok"
                          >
                            <RefreshCw size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedItemId(item.id);
                              setIsFormModalOpen(true);
                            }}
                            className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`Hapus item "${item.itemName}"?`)) {
                                await deleteItem(item.id);
                              }
                            }}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Hapus"
                          >
                            <Trash2 size={16} />
                          </button>
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

      {/* Supplier List */}
      {suppliers.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Daftar Supplier</h3>
          <div className="flex flex-wrap gap-2">
            {suppliers.map((supplier, index) => (
              <span key={index} className="px-3 py-1 bg-neutral/50 rounded-full text-sm text-gray-600">
                {supplier}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <InventoryFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setSelectedItemId(null);
        }}
        onSubmit={async (data) => {
          if (selectedItemId) {
            await updateItem(selectedItemId, data);
          } else {
            await createItem(data);
          }
          refresh();
        }}
        item={selectedItemData || null}
        title={selectedItemId ? 'Edit Item' : 'Tambah Item'}
      />

      <StockAdjustmentModal
        isOpen={isAdjustModalOpen}
        onClose={() => {
          setIsAdjustModalOpen(false);
          setSelectedItemId(null);
        }}
        itemName={selectedItemData?.itemName || ''}
        currentQuantity={selectedItemData?.quantity || 0}
        onAdjust={async (type, quantity, notes) => {
          if (selectedItemId) {
            await adjustStock(selectedItemId, {
              type,
              quantity,
              notes,
            });
            refresh();
          }
        }}
      />
    </AdminLayout>
  );
}
