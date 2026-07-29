'use client';

import { useState, useEffect, useCallback } from 'react';
import { inventoryApi, InventoryItem, InventoryFormData, StockAdjustmentData } from '@/lib/api/inventory';

interface UseInventoryOptions {
  branchId: string;
  autoFetch?: boolean;
}

export function useInventory({ branchId, autoFetch = true }: UseInventoryOptions) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await inventoryApi.getInventory(branchId);
      // Mark low stock items
      const itemsWithStatus = data.map(item => ({
        ...item,
        isLowStock: item.quantity <= item.minLevel,
      }));
      setItems(itemsWithStatus);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data inventaris');
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  const fetchSuppliers = useCallback(async () => {
    try {
      const data = await inventoryApi.getSuppliers(branchId);
      setSuppliers(data);
    } catch (err: any) {
      console.error('Failed to fetch suppliers:', err);
    }
  }, [branchId]);

  const fetchItemDetail = useCallback(async (id: string) => {
    try {
      setIsDetailLoading(true);
      const data = await inventoryApi.getItem(id);
      setSelectedItem(data);
      return data;
    } catch (err: any) {
      setError(err.message || 'Gagal memuat detail item');
      throw err;
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const createItem = useCallback(async (data: InventoryFormData) => {
    try {
      const newItem = await inventoryApi.createItem({ ...data, branchId });
      setItems((prev) => [...prev, { ...newItem, isLowStock: newItem.quantity <= newItem.minLevel }]);
      return newItem;
    } catch (err: any) {
      throw new Error(err.message || 'Gagal menambah item');
    }
  }, [branchId]);

  const updateItem = useCallback(async (id: string, data: Partial<InventoryFormData>) => {
    try {
      const updated = await inventoryApi.updateItem(id, data);
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...updated, isLowStock: updated.quantity <= updated.minLevel }
            : item
        )
      );
      if (selectedItem?.id === id) {
        setSelectedItem(updated);
      }
      return updated;
    } catch (err: any) {
      throw new Error(err.message || 'Gagal mengupdate item');
    }
  }, [selectedItem]);

  const adjustStock = useCallback(async (id: string, data: StockAdjustmentData) => {
    try {
      const updated = await inventoryApi.adjustStock(id, data);
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...updated, isLowStock: updated.quantity <= updated.minLevel }
            : item
        )
      );
      if (selectedItem?.id === id) {
        setSelectedItem(updated);
      }
      return updated;
    } catch (err: any) {
      throw new Error(err.message || 'Gagal menyesuaikan stok');
    }
  }, [selectedItem]);

  const deleteItem = useCallback(async (id: string) => {
    try {
      await inventoryApi.deleteItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      throw new Error(err.message || 'Gagal menghapus item');
    }
  }, []);

  const refresh = useCallback(() => {
    fetchItems();
    fetchSuppliers();
  }, [fetchItems, fetchSuppliers]);

  useEffect(() => {
    if (autoFetch && branchId) {
      fetchItems();
      fetchSuppliers();
    }
  }, [autoFetch, branchId, fetchItems, fetchSuppliers]);

  return {
    items,
    suppliers,
    selectedItem,
    isLoading,
    isDetailLoading,
    error,
    fetchItemDetail,
    createItem,
    updateItem,
    adjustStock,
    deleteItem,
    refresh,
  };
}
