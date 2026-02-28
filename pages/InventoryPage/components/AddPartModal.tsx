import { Save,X } from 'lucide-react';
import React from 'react';
import { Part } from '../../../types';
import { isLikelyLiquid } from '../../../types/inventory.types';
import { InventoryFormData } from '../hooks/useInventoryData';

interface AddPartModalProps {
  show: boolean;
  editingPart: Part | null;
  formData: InventoryFormData;
  categories: string[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onFormChange: (data: InventoryFormData) => void;
}

const inputClassName = "w-full px-3 py-2.5 bg-[#f5f5f5] text-[#111827] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/25 placeholder-slate-400 transition-all duration-200";

const AddPartModal: React.FC<AddPartModalProps> = ({
  show,
  editingPart,
  formData,
  categories,
  onClose,
  onSubmit,
  onFormChange,
}) => {
  if (!show) return null;

  const updateField = <K extends keyof InventoryFormData>(field: K, value: InventoryFormData[K]) => {
    onFormChange({ ...formData, [field]: value });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-[var(--surface)] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0">
          <h3 className="font-bold text-lg text-slate-800">
            {editingPart ? 'Edit Part' : 'Add New Part'}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Part Name *
              </label>
              <input
                type="text"
                className={inputClassName}
                value={formData.part_name}
                onChange={e => updateField('part_name', e.target.value)}
                placeholder="e.g., Hydraulic Oil Filter"
                required
              />
            </div>

            {/* Liquid Detection Banner */}
            {isLikelyLiquid(formData.part_name) && !formData.is_liquid && (
              <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-amber-700">This looks like a liquid item. Enable liquid tracking?</span>
                <button
                  type="button"
                  onClick={() => updateField('is_liquid', true)}
                  className="px-3 py-1 bg-amber-500 text-white text-xs font-semibold rounded-full hover:bg-amber-600"
                >
                  Enable
                </button>
              </div>
            )}
            {/* Liquid / Bulk Item Toggle */}
            <div className="col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_liquid}
                  onChange={e => {
                    updateField('is_liquid', e.target.checked);
                    if (e.target.checked) {
                      updateField('base_unit', 'L');
                    } else {
                      updateField('base_unit', 'pcs');
                      updateField('container_unit', '');
                      updateField('container_size', '');
                    }
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-bold text-slate-500 uppercase">Liquid / Bulk Item</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Part Code *
              </label>
              <input
                type="text"
                className={inputClassName}
                value={formData.part_code}
                onChange={e => updateField('part_code', e.target.value.toUpperCase())}
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
                onChange={e => updateField('category', e.target.value)}
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
                onChange={e => updateField('cost_price', parseFloat(e.target.value) || 0)}
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
                onChange={e => updateField('sell_price', parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
              />
            </div>

            {!formData.is_liquid && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Stock Quantity
              </label>
              <input
                type="number"
                className={inputClassName}
                value={formData.stock_quantity}
                onChange={e => updateField('stock_quantity', parseInt(e.target.value) || 0)}
                min="0"
              />
            </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Min Stock Level
              </label>
              <input
                type="number"
                className={inputClassName}
                value={formData.min_stock_level}
                onChange={e => updateField('min_stock_level', parseInt(e.target.value) || 10)}
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
                onChange={e => updateField('warranty_months', parseInt(e.target.value) || 0)}
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
                onChange={e => updateField('supplier', e.target.value)}
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
                onChange={e => updateField('location', e.target.value)}
                placeholder="e.g., Shelf A-12"
              />
            </div>


            {formData.is_liquid && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Base Unit *
                  </label>
                  <select
                    className={inputClassName}
                    value={formData.base_unit}
                    onChange={e => updateField('base_unit', e.target.value)}
                  >
                    <option value="L">Liters (L)</option>
                    <option value="ml">Milliliters (ml)</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="g">Grams (g)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Container Type *
                  </label>
                  <select
                    className={inputClassName}
                    value={formData.container_unit}
                    onChange={e => updateField('container_unit', e.target.value)}
                  >
                    <option value="">Select...</option>
                    <option value="bottle">Bottle</option>
                    <option value="drum">Drum</option>
                    <option value="jerry_can">Jerry Can</option>
                    <option value="pail">Pail</option>
                    <option value="box">Box</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Container Size ({formData.base_unit}) *
                  </label>
                  <input
                    type="number"
                    className={inputClassName}
                    value={formData.container_size}
                    onChange={e => updateField('container_size', parseFloat(e.target.value) || '')}
                    placeholder="e.g., 5 (5L per bottle)"
                    min="0.1"
                    step="0.1"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Sealed Containers
                  </label>
                  <input
                    type="number"
                    className={inputClassName}
                    value={formData.container_quantity}
                    onChange={e => updateField('container_quantity', parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Loose {formData.base_unit}
                  </label>
                  <input
                    type="number"
                    className={inputClassName}
                    value={formData.bulk_quantity}
                    onChange={e => updateField('bulk_quantity', parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.1"
                  />
                </div>

                {typeof formData.container_size === 'number' && formData.container_size > 0 && formData.sell_price > 0 && (
                  <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                    <span className="text-blue-700">Price per {formData.base_unit}: </span>
                    <span className="font-bold text-blue-800">
                      RM {(formData.sell_price / formData.container_size).toFixed(2)}
                    </span>
                    <span className="text-blue-600 ml-3">Total stock: </span>
                    <span className="font-bold text-blue-800">
                      {((formData.container_quantity * formData.container_size) + formData.bulk_quantity).toFixed(1)}{formData.base_unit}
                    </span>
                  </div>
                )}
              </>
            )}
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
              onClick={onClose}
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
  );
};

export default AddPartModal;
