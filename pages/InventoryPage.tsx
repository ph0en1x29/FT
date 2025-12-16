import React, { useState, useEffect, useMemo } from 'react';
import { Part, User, UserRole } from '../types_with_invoice_tracking';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { 
  Plus, Search, Package, Edit2, Trash2, X, Save, 
  AlertTriangle, Filter, Download, Upload, Clock
} from 'lucide-react';

interface InventoryPageProps {
  currentUser: User;
}

const InventoryPage: React.FC<InventoryPageProps> = ({ currentUser }) => {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStock, setFilterStock] = useState<'all' | 'low' | 'out'>('all');
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  
  // Form data
  const [formData, setFormData] = useState({
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
  });

  const isAdmin = currentUser.role === UserRole.ADMIN;

  useEffect(() => {
    loadParts();
  }, []);

  const loadParts = async () => {
    setLoading(true);
    try {
      const data = await MockDb.getParts();
      setParts(data);
    } catch (error) {
      console.error('Error loading parts:', error);
    }
    setLoading(false);
  };

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
        matchesStock = p.stock_quantity > 0 && p.stock_quantity <= (p.min_stock_level || 10);
      } else if (filterStock === 'out') {
        matchesStock = p.stock_quantity === 0;
      }
      
      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [parts, searchQuery, filterCategory, filterStock]);

  // Group parts by category for display
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
  const stats = useMemo(() => {
    const total = parts.length;
    const lowStock = parts.filter(p => p.stock_quantity > 0 && p.stock_quantity <= (p.min_stock_level || 10)).length;
    const outOfStock = parts.filter(p => p.stock_quantity === 0).length;
    const totalValue = parts.reduce((sum, p) => sum + (p.cost_price * p.stock_quantity), 0);
    return { total, lowStock, outOfStock, totalValue };
  }, [parts]);

  const resetForm = () => {
    setFormData({
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
    });
  };

  const handleAddNew = () => {
    resetForm();
    setEditingPart(null);
    setShowModal(true);
  };

  const handleEdit = (part: Part) => {
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
    });
    setEditingPart(part);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.part_name || !formData.part_code || !formData.category) {
      alert('Please fill in Part Name, Code, and Category');
      return;
    }

    try {
      const partData = {
        ...formData,
        last_updated_by: currentUser.user_id,
        last_updated_by_name: currentUser.name,
        updated_at: new Date().toISOString(),
      };

      if (editingPart) {
        await MockDb.updatePart(editingPart.part_id, partData);
      } else {
        await MockDb.createPart(partData);
      }
      
      await loadParts();
      setShowModal(false);
      resetForm();
      setEditingPart(null);
    } catch (error) {
      alert('Error saving part: ' + (error as Error).message);
    }
  };

  const handleDelete = async (part: Part) => {
    if (!confirm(`Delete "${part.part_name}"?\n\nThis cannot be undone.`)) return;
    
    try {
      await MockDb.deletePart(part.part_id);
      await loadParts();
    } catch (error) {
      alert((error as Error).message);
    }
  };

  const handleExportCSV = () => {
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
  };

  const inputClassName = "w-full px-3 py-2.5 bg-[#f5f5f5] text-[#111827] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/25 placeholder-slate-400 transition-all duration-200";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
          <p className="text-sm text-slate-500 mt-1">
            {filteredParts.length} of {parts.length} items
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          {isAdmin && (
            <button
              onClick={handleAddNew}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Add Part
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
          <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
          <div className="text-sm text-slate-500">Total Items</div>
        </div>
        <div className="bg-amber-50 rounded-xl shadow-sm p-4 border border-amber-200">
          <div className="text-2xl font-bold text-amber-600">{stats.lowStock}</div>
          <div className="text-sm text-amber-700">Low Stock</div>
        </div>
        <div className="bg-red-50 rounded-xl shadow-sm p-4 border border-red-200">
          <div className="text-2xl font-bold text-red-600">{stats.outOfStock}</div>
          <div className="text-sm text-red-700">Out of Stock</div>
        </div>
        <div className="bg-green-50 rounded-xl shadow-sm p-4 border border-green-200">
          <div className="text-2xl font-bold text-green-600">
            RM {stats.totalValue.toLocaleString()}
          </div>
          <div className="text-sm text-green-700">Inventory Value</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, code, category, or supplier..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <select
              className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={filterStock}
              onChange={(e) => setFilterStock(e.target.value as 'all' | 'low' | 'out')}
            >
              <option value="all">All Stock Levels</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>
          </div>
        </div>
      </div>

      {/* Parts by Category */}
      {Object.keys(groupedParts).length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-600 mb-2">No parts found</h3>
          <p className="text-sm text-slate-400">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        Object.keys(groupedParts).sort().map(category => (
          <div key={category} className="bg-white rounded-xl shadow overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-100">
              <h2 className="font-semibold text-slate-700">{category}</h2>
              <p className="text-xs text-slate-500">{groupedParts[category].length} items</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="p-4">Part Name</th>
                    <th className="p-4">SKU</th>
                    <th className="p-4">Stock</th>
                    <th className="p-4">Cost (RM)</th>
                    <th className="p-4">Price (RM)</th>
                    <th className="p-4">Warranty</th>
                    <th className="p-4">Last Updated By</th>
                    {isAdmin && <th className="p-4 text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groupedParts[category].map(p => (
                    <tr key={p.part_id} className="hover:bg-slate-50">
                      <td className="p-4">
                        <div className="font-medium">{p.part_name}</div>
                        {p.supplier && (
                          <div className="text-xs text-slate-400">Supplier: {p.supplier}</div>
                        )}
                        {p.location && (
                          <div className="text-xs text-slate-400">Location: {p.location}</div>
                        )}
                      </td>
                      <td className="p-4 text-slate-500 text-sm font-mono">{p.part_code}</td>
                      <td className="p-4">
                        <div className={`font-bold flex items-center gap-2 ${
                          p.stock_quantity === 0 ? 'text-red-500' :
                          p.stock_quantity <= (p.min_stock_level || 10) ? 'text-amber-500' : 
                          'text-green-600'
                        }`}>
                          {p.stock_quantity}
                          {p.stock_quantity === 0 && (
                            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">OUT</span>
                          )}
                          {p.stock_quantity > 0 && p.stock_quantity <= (p.min_stock_level || 10) && (
                            <AlertTriangle className="w-4 h-4" />
                          )}
                        </div>
                        <div className="text-xs text-slate-400">Min: {p.min_stock_level || 10}</div>
                      </td>
                      <td className="p-4 text-slate-600">{p.cost_price.toFixed(2)}</td>
                      <td className="p-4 font-medium">{p.sell_price.toFixed(2)}</td>
                      <td className="p-4 text-slate-500 text-sm">{p.warranty_months} mo</td>
                      <td className="p-4">
                        {p.last_updated_by_name ? (
                          <div>
                            <div className="text-sm text-slate-700">{p.last_updated_by_name}</div>
                            {p.updated_at && (
                              <div className="text-xs text-slate-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(p.updated_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="p-4">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => handleEdit(p)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(p)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0">
              <h3 className="font-bold text-lg text-slate-800">
                {editingPart ? 'Edit Part' : 'Add New Part'}
              </h3>
              <button 
                onClick={() => { setShowModal(false); setEditingPart(null); resetForm(); }} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Part Name *
                  </label>
                  <input
                    type="text"
                    className={inputClassName}
                    value={formData.part_name}
                    onChange={e => setFormData({...formData, part_name: e.target.value})}
                    placeholder="e.g., Hydraulic Oil Filter"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Part Code *
                  </label>
                  <input
                    type="text"
                    className={inputClassName}
                    value={formData.part_code}
                    onChange={e => setFormData({...formData, part_code: e.target.value.toUpperCase()})}
                    placeholder="e.g., HYD-FIL-001"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Category *
                  </label>
                  <input
                    type="text"
                    className={inputClassName}
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    placeholder="e.g., Hydraulic System"
                    list="categories"
                    required
                  />
                  <datalist id="categories">
                    {categories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Cost Price (RM)
                  </label>
                  <input
                    type="number"
                    className={inputClassName}
                    value={formData.cost_price}
                    onChange={e => setFormData({...formData, cost_price: parseFloat(e.target.value) || 0})}
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Sell Price (RM)
                  </label>
                  <input
                    type="number"
                    className={inputClassName}
                    value={formData.sell_price}
                    onChange={e => setFormData({...formData, sell_price: parseFloat(e.target.value) || 0})}
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Stock Quantity
                  </label>
                  <input
                    type="number"
                    className={inputClassName}
                    value={formData.stock_quantity}
                    onChange={e => setFormData({...formData, stock_quantity: parseInt(e.target.value) || 0})}
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Min Stock Level
                  </label>
                  <input
                    type="number"
                    className={inputClassName}
                    value={formData.min_stock_level}
                    onChange={e => setFormData({...formData, min_stock_level: parseInt(e.target.value) || 10})}
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Warranty (Months)
                  </label>
                  <input
                    type="number"
                    className={inputClassName}
                    value={formData.warranty_months}
                    onChange={e => setFormData({...formData, warranty_months: parseInt(e.target.value) || 0})}
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Supplier
                  </label>
                  <input
                    type="text"
                    className={inputClassName}
                    value={formData.supplier}
                    onChange={e => setFormData({...formData, supplier: e.target.value})}
                    placeholder="e.g., ABC Parts Sdn Bhd"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    className={inputClassName}
                    value={formData.location}
                    onChange={e => setFormData({...formData, location: e.target.value})}
                    placeholder="e.g., Shelf A-12"
                  />
                </div>
              </div>

              {/* Profit margin indicator */}
              {formData.cost_price > 0 && formData.sell_price > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                  <span className="text-blue-700">Profit Margin: </span>
                  <span className="font-bold text-blue-800">
                    {(((formData.sell_price - formData.cost_price) / formData.cost_price) * 100).toFixed(1)}%
                  </span>
                  <span className="text-blue-600 ml-2">
                    (RM {(formData.sell_price - formData.cost_price).toFixed(2)} per unit)
                  </span>
                </div>
              )}

              {/* Buttons */}
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingPart(null); resetForm(); }}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {editingPart ? 'Update' : 'Add Part'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;
