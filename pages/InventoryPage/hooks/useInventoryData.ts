import React,{ useCallback,useMemo,useState } from 'react';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { Part,User } from '../../../types';
import { isLikelyLiquid } from '../../../types/inventory.types';
import { getTotalBaseUnits } from '../../../services/liquidInventoryService';

export interface InventoryFormData {
  part_name: string;
  part_code: string;
  category: string;
  cost_price: number;
  sell_price: number;
  warranty_months: number;
  stock_quantity: number;
  min_stock_level: number;
  supplier: string;
  location: string;
  // Liquid inventory fields
  is_liquid: boolean;
  base_unit: string;
  container_unit: string;
  container_size: number | '';
  container_quantity: number;
  bulk_quantity: number;
}

const initialFormData: InventoryFormData = {
  part_name: '',
  part_code: '',
  category: '',
  cost_price: 0,
  sell_price: 0,
  warranty_months: 0,
  stock_quantity: 0,
  min_stock_level: 10,
  supplier: '',
  location: '',
  is_liquid: false,
  base_unit: 'pcs',
  container_unit: '',
  container_size: '',
  container_quantity: 0,
  bulk_quantity: 0,
};

export interface InventoryStats {
  total: number;
  lowStock: number;
  outOfStock: number;
  totalValue: number;
}

export function useInventoryData(currentUser: User) {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStock, setFilterStock] = useState<'all' | 'low' | 'out'>('all');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [formData, setFormData] = useState<InventoryFormData>(initialFormData);

  const loadParts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await MockDb.getParts();
      setParts(data);
    } catch (_error) {
      showToast.error('Failed to load inventory');
    }
    setLoading(false);
  }, []);

  // Get unique categories
  const categories = useMemo(() => {
    return [...new Set(parts.map(p => p.category))].filter(Boolean).sort();
  }, [parts]);

  // Filter parts
  const filteredParts = useMemo(() => {
    return parts.filter(p => {
      const matchesSearch =
        p.part_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.part_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.supplier || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = filterCategory === 'all' || p.category === filterCategory;

      let matchesStock = true;
      if (filterStock === 'low') {
        if (p.is_liquid) {
          const total = (p.container_quantity || 0) + (p.bulk_quantity || 0);
          matchesStock = total > 0 && total <= (p.min_stock_level || 10);
        } else {
          matchesStock = p.stock_quantity > 0 && p.stock_quantity <= (p.min_stock_level || 10);
        }
      } else if (filterStock === 'out') {
        if (p.is_liquid) {
          matchesStock = ((p.container_quantity || 0) + (p.bulk_quantity || 0)) === 0;
        } else {
          matchesStock = p.stock_quantity === 0;
        }
      }

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [parts, searchQuery, filterCategory, filterStock]);

  // Group parts by category
  const groupedParts = useMemo(() => {
    return filteredParts.reduce((acc, part) => {
      if (!acc[part.category]) {
        acc[part.category] = [];
      }
      acc[part.category].push(part);
      return acc;
    }, {} as Record<string, Part[]>);
  }, [filteredParts]);

  // Stats
  const stats: InventoryStats = useMemo(() => {
    const total = parts.length;
    const lowStock = parts.filter(p => {
      if (p.is_liquid) {
        const total = (p.container_quantity || 0) + (p.bulk_quantity || 0);
        return total > 0 && total <= (p.min_stock_level || 10);
      }
      return p.stock_quantity > 0 && p.stock_quantity <= (p.min_stock_level || 10);
    }).length;
    const outOfStock = parts.filter(p => {
      if (p.is_liquid) {
        return ((p.container_quantity || 0) + (p.bulk_quantity || 0)) === 0;
      }
      return p.stock_quantity === 0;
    }).length;
    const totalValue = parts.reduce((sum, p) => {
      if (p.is_liquid) {
        return sum + (p.cost_price * (p.container_quantity || 0));
      }
      return sum + (p.cost_price * p.stock_quantity);
    }, 0);
    return { total, lowStock, outOfStock, totalValue };
  }, [parts]);

  const resetForm = useCallback(() => {
    setFormData(initialFormData);
  }, []);

  const handleAddNew = useCallback(() => {
    resetForm();
    setEditingPart(null);
    setShowModal(true);
  }, [resetForm]);

  const handleEdit = useCallback((part: Part) => {
    setFormData({
      part_name: part.part_name,
      part_code: part.part_code,
      category: part.category,
      cost_price: part.cost_price,
      sell_price: part.sell_price,
      warranty_months: part.warranty_months,
      stock_quantity: part.stock_quantity,
      min_stock_level: part.min_stock_level || 10,
      supplier: part.supplier || '',
      location: part.location || '',
      is_liquid: part.is_liquid || false,
      base_unit: part.base_unit || 'pcs',
      container_unit: part.container_unit || '',
      container_size: part.container_size || '',
      container_quantity: part.container_quantity || 0,
      bulk_quantity: part.bulk_quantity || 0,
    });
    setEditingPart(part);
    setShowModal(true);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.part_name || !formData.part_code || !formData.category) {
      showToast.error('Please fill in Part Name, Code, and Category');
      return;
    }

    try {
      const containerSize = typeof formData.container_size === 'number' ? formData.container_size : 0;
      const partData = {
        ...formData,
        container_size: containerSize || null,
        container_unit: formData.container_unit || null,
        price_per_base_unit: containerSize > 0 ? formData.sell_price / containerSize : null,
        last_updated_by: currentUser.user_id,
        last_updated_by_name: currentUser.name,
        updated_at: new Date().toISOString(),
      };

      if (editingPart) {
        await MockDb.updatePart(editingPart.part_id, partData);
        showToast.success('Part updated successfully');
      } else {
        await MockDb.createPart(partData);
        showToast.success('Part added successfully');
      }

      await loadParts();
      setShowModal(false);
      resetForm();
      setEditingPart(null);
    } catch (error) {
      showToast.error('Failed to save part', (error as Error).message);
    }
  }, [formData, editingPart, currentUser, loadParts, resetForm]);

  const handleDelete = useCallback(async (part: Part) => {
    if (!confirm(`Delete "${part.part_name}"?\n\nThis cannot be undone.`)) return;

    try {
      await MockDb.deletePart(part.part_id);
      await loadParts();
      showToast.success('Part deleted');
    } catch (error) {
      showToast.error('Failed to delete part', (error as Error).message);
    }
  }, [loadParts]);

  const handleExportCSV = useCallback(() => {
    const headers = ['Part Code', 'Part Name', 'Category', 'Cost Price', 'Sell Price', 'Stock', 'Min Stock', 'Warranty (months)', 'Supplier', 'Location', 'Last Updated By', 'Updated At'];
    const rows = parts.map(p => [
      p.part_code,
      p.part_name,
      p.category,
      p.cost_price,
      p.sell_price,
      p.stock_quantity,
      p.min_stock_level || 10,
      p.warranty_months,
      p.supplier || '',
      p.location || '',
      p.last_updated_by_name || '',
      p.updated_at || '',
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }, [parts]);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditingPart(null);
    resetForm();
  }, [resetForm]);

  return {
    // State
    parts,
    loading,
    searchQuery,
    filterCategory,
    filterStock,
    showModal,
    editingPart,
    formData,
    // Derived
    categories,
    filteredParts,
    groupedParts,
    stats,
    // Setters
    setSearchQuery,
    setFilterCategory,
    setFilterStock,
    setFormData,
    // Actions
    loadParts,
    handleAddNew,
    handleEdit,
    handleSubmit,
    handleDelete,
    handleExportCSV,
    closeModal,
  };
}
