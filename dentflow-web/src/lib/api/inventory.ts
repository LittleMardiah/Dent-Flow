import apiClient from '../axios';

export interface InventoryItem {
  id: string;
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  unitCost: number;
  minLevel: number;
  supplier: string;
  supplierContact?: string;
  branchId: string;
  createdAt: string;
  updatedAt: string;
  isLowStock?: boolean;
}

export interface InventoryFormData {
  itemName: string;
  category: string;
  quantity: number;
  unit: string;
  unitCost: number;
  minLevel: number;
  supplier: string;
  supplierContact?: string;
}

export interface StockAdjustmentData {
  quantity: number;
  type: 'add' | 'subtract';
  notes?: string;
}

export const inventoryApi = {
  // Get inventory items
  getInventory: async (branchId: string): Promise<InventoryItem[]> => {
    const response = await apiClient.get(`/inventory?branchId=${branchId}`);
    return response.data.data || [];
  },

  // Get single item
  getItem: async (id: string): Promise<InventoryItem> => {
    const response = await apiClient.get(`/inventory/${id}`);
    return response.data.data;
  },

  // Create new item
  createItem: async (data: InventoryFormData & { branchId: string }): Promise<InventoryItem> => {
    const response = await apiClient.post('/inventory', data);
    return response.data.data;
  },

  // Update item
  updateItem: async (id: string, data: Partial<InventoryFormData>): Promise<InventoryItem> => {
    const response = await apiClient.put(`/inventory/${id}`, data);
    return response.data.data;
  },

  // Adjust stock quantity
  adjustStock: async (id: string, data: StockAdjustmentData): Promise<InventoryItem> => {
    const response = await apiClient.patch(`/inventory/${id}/quantity`, data);
    return response.data.data;
  },

  // Delete item (soft delete)
  deleteItem: async (id: string): Promise<void> => {
    await apiClient.delete(`/inventory/${id}`);
  },

  // Get suppliers list
  getSuppliers: async (branchId: string): Promise<string[]> => {
    const response = await apiClient.get(`/inventory/suppliers?branchId=${branchId}`);
    return response.data.data || [];
  },
};
