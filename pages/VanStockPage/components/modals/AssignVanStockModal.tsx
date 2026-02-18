/**
 * Modal for assigning van stock to a technician
 */
import { X } from 'lucide-react';
import { User } from '../../../../types';

interface AssignVanStockModalProps {
  isOpen: boolean;
  availableTechnicians: User[];
  selectedTechnicianId: string;
  vanPlate: string;
  vanCode: string;
  vanNotes: string;
  submitting: boolean;
  onClose: () => void;
  onTechnicianChange: (id: string) => void;
  onVanPlateChange: (plate: string) => void;
  onVanCodeChange: (code: string) => void;
  onNotesChange: (notes: string) => void;
  onSubmit: () => void;
}

export function AssignVanStockModal({
  isOpen,
  availableTechnicians,
  selectedTechnicianId,
  vanPlate,
  vanCode,
  vanNotes,
  submitting,
  onClose,
  onTechnicianChange,
  onVanPlateChange,
  onVanCodeChange,
  onNotesChange,
  onSubmit,
}: AssignVanStockModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--surface)] rounded-2xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-lg">Assign Van Stock</h2>
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
              Select Technician <span className="text-red-500">*</span>
            </label>
            {availableTechnicians.length === 0 ? (
              <p className="text-sm text-slate-500 p-3 bg-slate-50 rounded-lg">
                All technicians already have Van Stock assigned.
              </p>
            ) : (
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedTechnicianId}
                onChange={(e) => onTechnicianChange(e.target.value)}
              >
                <option value="">-- Select a technician --</option>
                {availableTechnicians.map((tech) => (
                  <option key={tech.user_id} value={tech.user_id}>
                    {tech.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Van Plate (License Plate) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., WKL 4521"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={vanPlate}
              onChange={(e) => onVanPlateChange(e.target.value.toUpperCase())}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Van Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., VAN-001 or ABC1234"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={vanCode}
              onChange={(e) => onVanCodeChange(e.target.value.toUpperCase())}
            />
            <p className="text-xs text-slate-500 mt-1">
              Unique identifier (license plate, van number, etc.)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              placeholder="Additional notes about this van..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2}
              value={vanNotes}
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
            disabled={!selectedTechnicianId || !vanPlate.trim() || !vanCode.trim() || submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Assigning...' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}
