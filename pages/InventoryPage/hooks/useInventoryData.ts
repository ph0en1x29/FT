import React,{ useCallback,useEffect,useMemo,useState } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { showToast } from '../../../services/toastService';
import { Part,User } from '../../../types';
import { recordInventoryMovement } from '../../../services/inventoryMovementsService';
import {
  getInventoryCatalogStats,
  getPartCategories,
  getPartCodes,
  getPartsForExport,
  getPartsPage,
  createPart,
  deletePart,
  updatePart,
} from '../../../services/partsService';

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
  liquidMismatch: number;
  totalValue: number;
}

interface UseInventoryDataOptions {
  enabled?: boolean;
  shouldLoadImportSupport?: boolean;
}

const INVENTORY_PAGE_SIZE = 50;
const EMPTY_PARTS: Part[] = [];

export function useInventoryData(currentUser: User, options: UseInventoryDataOptions = {}) {
  const { enabled = true, shouldLoadImportSupport = false } = options;
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStock, setFilterStock] = useState<'all' | 'low' | 'out'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [formData, setFormData] = useState<InventoryFormData>(initialFormData);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, filterCategory, filterStock]);

  const partsQuery = useQuery({
    queryKey: ['inventory', 'parts-catalog', debouncedSearchQuery, filterCategory, filterStock, currentPage, INVENTORY_PAGE_SIZE],
    queryFn: () => getPartsPage({
      searchQuery: debouncedSearchQuery,
      category: filterCategory,
      stock: filterStock,
      page: currentPage,
      pageSize: INVENTORY_PAGE_SIZE,
    }),
    enabled,
    staleTime: 60 * 1000,
    placeholderData: previousData => previousData,
  });

  const categoriesQuery = useQuery({
    queryKey: ['inventory', 'part-categories'],
    queryFn: getPartCategories,
    enabled,
    staleTime: 30 * 60 * 1000,
  });

  const statsQuery = useQuery({
    queryKey: ['inventory', 'catalog-stats'],
    queryFn: getInventoryCatalogStats,
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const partCodesQuery = useQuery({
    queryKey: ['inventory', 'part-codes'],
    queryFn: getPartCodes,
    enabled: shouldLoadImportSupport,
    staleTime: 10 * 60 * 1000,
  });

  const parts = partsQuery.data?.parts ?? EMPTY_PARTS;
  const totalCount = partsQuery.data?.total || 0;
  const loading = partsQuery.isLoading;

  useEffect(() => {
    if (currentPage > 1 && partsQuery.data && partsQuery.data.parts.length === 0 && partsQuery.data.total > 0) {
      setCurrentPage(Math.max(1, Math.ceil(partsQuery.data.total / INVENTORY_PAGE_SIZE)));
    }
  }, [currentPage, partsQuery.data]);

  // Get unique categories
  const categories = categoriesQuery.data || [];

  const filteredParts = parts;

  // Group parts by category
  const groupedParts = useMemo(() => {
    return parts.reduce((acc, part) => {
      if (!acc[part.category]) {
        acc[part.category] = [];
      }
      acc[part.category].push(part);
      return acc;
    }, {} as Record<string, Part[]>);
  }, [parts]);

  // Stats
  const stats: InventoryStats = statsQuery.data || {
    total: 0,
    lowStock: 0,
    outOfStock: 0,
    liquidMismatch: 0,
    totalValue: 0,
  };

  const loadParts = useCallback(async () => {
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory', 'parts-catalog'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory', 'catalog-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory', 'part-categories'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory', 'part-codes'] }),
      ]);
    } catch {
      showToast.error('Failed to refresh inventory');
    }
  }, [queryClient]);

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

    if (formData.is_liquid && (!formData.container_unit || formData.container_unit === '')) {
      showToast.error('Container type is required for liquid items');
      return;
    }

    if (formData.is_liquid && (!formData.container_size || formData.container_size === 0)) {
      showToast.error('Container size is required for liquid items');
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
        // Log stock adjustment if quantity changed
        const oldQty = editingPart.stock_quantity || 0;
        const newQty = formData.stock_quantity || 0;
        if (oldQty !== newQty) {
          try {
            await recordInventoryMovement({
              part_id: editingPart.part_id,
              movement_type: 'adjustment',
              container_qty_change: newQty - oldQty,
              bulk_qty_change: 0,
              performed_by: currentUser.user_id,
              performed_by_name: currentUser.name,
              notes: `Manual stock adjustment: ${oldQty} → ${newQty}`,
              store_container_qty_after: newQty,
              store_bulk_qty_after: editingPart.bulk_quantity || 0,
            });
          } catch (mvErr) {
            console.warn('Movement log failed:', mvErr instanceof Error ? mvErr.message : mvErr);
          }
        }
        await updatePart(editingPart.part_id, partData);
        showToast.success('Part updated successfully');
      } else {
        await createPart(partData);
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
      await deletePart(part.part_id);
      await loadParts();
      showToast.success('Part deleted');
    } catch (error) {
      showToast.error('Failed to delete part', (error as Error).message);
    }
  }, [loadParts]);

  const handleExportCSV = useCallback(async () => {
    try {
      const rowsSource = await getPartsForExport({
        searchQuery: debouncedSearchQuery,
        category: filterCategory,
        stock: filterStock,
      });
      const headers = ['Part Code', 'Part Name', 'Category', 'Cost Price', 'Sell Price', 'Stock Qty', 'Min Stock', 'Stock Value (Cost)', 'Stock Value (Sell)', 'Low Stock', 'Warranty (months)', 'Supplier', 'Location', 'Unit', 'Last Updated By', 'Updated At'];
      const rows = rowsSource.map(p => {
        const isLow = p.stock_quantity <= (p.min_stock_level || 0) && (p.min_stock_level || 0) > 0;
        return [
          p.part_code,
          p.part_name,
          p.category,
          p.cost_price,
          p.sell_price,
          p.stock_quantity,
          p.min_stock_level || 10,
          (p.stock_quantity * (p.cost_price ?? 0)).toFixed(2),
          (p.stock_quantity * (p.sell_price ?? 0)).toFixed(2),
          isLow ? 'YES' : '',
          p.warranty_months,
          p.supplier || '',
          p.location || '',
          p.unit || 'pcs',
          p.last_updated_by_name || '',
          p.updated_at || '',
        ];
      });

      const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } catch (error) {
      showToast.error('Failed to export inventory', (error as Error).message);
    }
  }, [debouncedSearchQuery, filterCategory, filterStock]);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setEditingPart(null);
    resetForm();
  }, [resetForm]);

  const totalPages = Math.max(1, Math.ceil(totalCount / INVENTORY_PAGE_SIZE));
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return {
    // State
    parts,
    loading,
    isFetching: partsQuery.isFetching,
    searchQuery,
    filterCategory,
    filterStock,
    currentPage,
    pageSize: INVENTORY_PAGE_SIZE,
    showModal,
    editingPart,
    formData,
    // Derived
    categories,
    filteredParts,
    groupedParts,
    stats,
    statsLoading: statsQuery.isLoading,
    totalCount,
    totalPages,
    canGoPrev,
    canGoNext,
    importPartCodes: partCodesQuery.data || [],
    // Setters
    setSearchQuery,
    setFilterCategory,
    setFilterStock,
    setCurrentPage,
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
