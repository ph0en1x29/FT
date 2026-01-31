/**
 * Modal for editing van stock details
 */
import React from 'react';
import { User, VanStock } from '../../../../types';
import { X } from 'lucide-react';

interface EditVanStockModalProps {
  isOpen: boolean;
  vanStock: VanStock | null;
  editVanCode: string;
  editVanNotes: string;
  editMaxItems: number;
  editTechnicianId: string;
  allTechnicians: User[];
  submitting: boolean;
  onClose: () => void;
  onVanCodeChange: (code: string) => void;
  onNotesChange: (notes: string) => void;
  onMaxItemsChange: (max: number) => void;
  onTechnicianChange: (id: string) => void;
  onSubmit: () => void;
}

export function EditVanStockModal({
  isOpen,
  vanStock,
  editVanCode,
  editVanNotes,
  editMaxItems,
  editTechnicianId,
  allTechnicians,
  submitting,
  onClose,
  onVanCodeChange,
  onNotesChange,
  onMaxItemsChange,
  onTechnicianChange,
  onSubmit,
}: EditVanStockModalProps) {
  if (!isOpen || !vanStock) return null;

  const technicianChanged = editTechnicianId !== vanStock.technician_id;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-lg">Edit Van Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Assigned Technician <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={editTechnicianId}
              onChange={(e) => onTechnicianChange(e.target.value)}
            >
              <option value="">-- Select a technician --</option>
              {allTechnicians.map((tech) => (
                <option key={tech.user_id} value={tech.user_id}>
                  {tech.name}
                </option>
              ))}
            </select>
            {technicianChanged && (
              <p className="text-xs text-amber-600 mt-1">
                Warning: Changing technician will reassign the van and all its items
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Van Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., VAN-001 or ABC1234"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={editVanCode}
              onChange={(e) => onVanCodeChange(e.target.value.toUpperCase())}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Max Items
            </label>
            <input
              type="number"
              min="1"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={editMaxItems}
              onChange={(e) => onMaxItemsChange(parseInt(e.target.value) || 50)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Notes
            </label>
            <textarea
              placeholder="Additional notes..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2}
              value={editVanNotes}
              onChange={(e) => onNotesChange(e.target.value)}
            />
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={!editVanCode.trim() || !editTechnicianId || submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
