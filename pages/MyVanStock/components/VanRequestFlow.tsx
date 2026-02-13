/**
 * VanRequestFlow — Tech view to browse available vans, search parts, and request access.
 * Shown when tech's van is in service or they want to find parts in other vans.
 */
import { Search, Send, Truck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  getVanFleetOverview,
  searchPartAcrossVans,
  submitVanAccessRequest,
} from '../../../services/inventoryService';
import { showToast } from '../../../services/toastService';
import type { User, VanFleetItem } from '../../../types';

interface Props {
  currentUser: User;
  onClose: () => void;
  onRequestSubmitted: () => void;
}

export default function VanRequestFlow({ currentUser, onClose, onRequestSubmitted }: Props) {
  const [vans, setVans] = useState<VanFleetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{
    van_stock_id: string; van_plate?: string; van_code?: string;
    technician_name: string; part_name: string; quantity: number;
  }>>([]);
  const [searching, setSearching] = useState(false);
  const [requestModal, setRequestModal] = useState<VanFleetItem | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getVanFleetOverview();
        setVans(data.filter(v =>
          v.van_status === 'active' &&
          v.technician_id !== currentUser.user_id &&
          !v.temporary_tech_id
        ));
      } catch {
        showToast.error('Failed to load available vans');
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser.user_id]);

  const handleSearch = async () => {
    if (!searchTerm.trim() || searching) return;
    setSearching(true);
    try {
      const results = await searchPartAcrossVans(searchTerm.trim());
      setSearchResults(results);
    } catch {
      showToast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!requestModal || !reason.trim() || submitting) return;
    setSubmitting(true);
    try {
      const ok = await submitVanAccessRequest(
        requestModal.van_stock_id,
        { id: currentUser.user_id, name: currentUser.name },
        reason.trim()
      );
      if (ok) {
        showToast.success('Request submitted — waiting for supervisor approval');
        setRequestModal(null);
        setReason('');
        onRequestSubmitted();
      } else {
        showToast.error('Failed to submit request');
      }
    } catch {
      showToast.error('Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-theme-surface rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-theme">
          <div>
            <h2 className="text-lg font-semibold text-theme flex items-center gap-2">
              <Truck className="w-5 h-5" /> Find Available Van
            </h2>
            <p className="text-xs text-theme-muted mt-1">Browse vans or search for specific parts</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-theme-surface-2 rounded">
            <X className="w-5 h-5 text-theme-muted" />
          </button>
        </div>

        {/* Part Search */}
        <div className="p-4 border-b border-theme">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Search for a part across all vans..."
                className="w-full pl-9 pr-3 py-2 border border-theme rounded-lg bg-theme-surface text-theme text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button onClick={handleSearch} disabled={searching || !searchTerm.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {searching ? '...' : 'Search'}
            </button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="text-xs font-medium text-theme-muted">{searchResults.length} result(s)</div>
              {searchResults.map((r) => (
                <div key={`${r.van_stock_id}-${r.part_name}`} className="flex items-center justify-between p-2 bg-theme-surface-2 rounded-lg text-sm">
                  <div>
                    <span className="font-medium text-theme">{r.part_name}</span>
                    <span className="text-theme-muted"> × {r.quantity}</span>
                    <div className="text-xs text-theme-muted">
                      {r.van_plate || r.van_code || 'Van'} — {r.technician_name}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const van = vans.find(v => v.van_stock_id === r.van_stock_id);
                      if (van) setRequestModal(van);
                    }}
                    className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Request
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Available Vans */}
        <div className="p-4">
          <div className="text-sm font-medium text-theme mb-3">
            Available Vans ({vans.length})
          </div>
          {loading ? (
            <div className="text-center text-theme-muted py-8">Loading...</div>
          ) : vans.length === 0 ? (
            <div className="text-center text-theme-muted py-8">No available vans right now</div>
          ) : (
            <div className="space-y-2">
              {vans.map(van => (
                <div key={van.van_stock_id} className="flex items-center justify-between p-3 border border-theme rounded-lg hover:bg-theme-surface-2 transition-colors">
                  <div>
                    <div className="font-medium text-theme text-sm">
                      {van.van_plate || van.van_code || 'Unnamed Van'}
                      {van.van_code && van.van_plate && (
                        <span className="text-theme-muted font-normal"> ({van.van_code})</span>
                      )}
                    </div>
                    <div className="text-xs text-theme-muted">
                      {van.technician_name} • {van.item_count} items
                    </div>
                  </div>
                  <button
                    onClick={() => setRequestModal(van)}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    <Send className="w-3 h-3" /> Request
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Request Modal */}
      {requestModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={e => { e.stopPropagation(); setRequestModal(null); }}>
          <div className="bg-theme-surface rounded-xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-theme mb-1">Request Access</h3>
            <p className="text-xs text-theme-muted mb-4">
              {requestModal.van_plate || requestModal.van_code || 'Van'} — {requestModal.technician_name}
            </p>
            <label className="block text-xs font-medium text-theme-muted mb-1">Reason *</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g., My van is in service, need brake parts for today's jobs"
              rows={3}
              className="w-full px-3 py-2 border border-theme rounded-lg bg-theme-surface text-theme text-sm focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setRequestModal(null)}
                className="px-4 py-2 border border-theme rounded-lg text-sm text-theme-muted hover:bg-theme-surface-2">
                Cancel
              </button>
              <button onClick={handleSubmitRequest} disabled={!reason.trim() || submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
