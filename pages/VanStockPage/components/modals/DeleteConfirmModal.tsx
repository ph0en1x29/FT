/**
 * Delete/Deactivate confirmation modal
 */
import { VanStock } from '../../../../types';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  vanStock: VanStock | null;
  deleteType: 'deactivate' | 'delete';
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmModal({
  isOpen,
  vanStock,
  deleteType,
  submitting,
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) {
  if (!isOpen || !vanStock) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg text-red-600">
            {deleteType === 'delete' ? 'Delete Van Stock?' : 'Deactivate Van Stock?'}
          </h2>
        </div>
        <div className="p-4">
          {deleteType === 'delete' ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                This will permanently delete <strong>{vanStock.technician_name}'s</strong> van stock
                {vanStock.van_code && <> (<strong>{vanStock.van_code}</strong>)</>}
                {' '}and all its items.
              </p>
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700 font-medium">
                  This action cannot be undone!
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                This will deactivate <strong>{vanStock.technician_name}'s</strong> van stock
                {vanStock.van_code && <> (<strong>{vanStock.van_code}</strong>)</>}.
              </p>
              <p className="text-sm text-slate-500">
                The van stock will be hidden but can be reactivated later.
              </p>
            </div>
          )}
        </div>
        <div className="p-4 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={submitting}
            className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
              deleteType === 'delete'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {submitting
              ? 'Processing...'
              : deleteType === 'delete'
              ? 'Delete Permanently'
              : 'Deactivate'}
          </button>
        </div>
      </div>
    </div>
  );
}
