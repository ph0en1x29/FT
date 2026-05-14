/**
 * ServicedExternalsSection — lists customer-owned forklifts (BYO or
 * sold-from-fleet) that Acwer is responsible for servicing for THIS
 * customer.
 *
 * Renders parallel to RentalsSection. RentalsSection covers the Acwer-fleet
 * side of the relationship; this section covers the customer-side.
 *
 * Row click → navigate to the forklift profile (full lifecycle history).
 * Edit (pencil) → inline edit modal so admins can fix make/model/site/etc.
 * without leaving the customer profile (added 2026-05-14 per client req).
 */
import { Building2, ChevronRight, Pencil, ShieldCheck, Truck, UserCheck } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getExternalServicedForklifts } from '../../../services/forkliftService';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { ForkliftStatus, ForkliftType } from '../../../types';
import type { Forklift } from '../../../types';
import AddEditForkliftModal from '../../ForkliftsTabs/components/AddEditForkliftModal';

interface Props {
  customerId: string;
}

interface BYOFormData {
  serial_number: string;
  forklift_no: string;
  customer_forklift_no: string;
  make: string;
  model: string;
  type: ForkliftType;
  hourmeter: number;
  last_hourmeter_update: string;
  last_service_hourmeter: number;
  last_service_date: string;
  year: number | null;
  capacity_kg: number;
  site: string;
  status: ForkliftStatus;
  notes: string;
}

const emptyForm: BYOFormData = {
  serial_number: '',
  forklift_no: '',
  customer_forklift_no: '',
  make: '',
  model: '',
  type: ForkliftType.DIESEL,
  hourmeter: 0,
  last_hourmeter_update: new Date().toISOString().split('T')[0],
  last_service_hourmeter: 0,
  last_service_date: '',
  year: null,
  capacity_kg: 0,
  site: '',
  status: ForkliftStatus.ACTIVE,
  notes: '',
};

const ServicedExternalsSection: React.FC<Props> = ({ customerId }) => {
  const navigate = useNavigate();
  const [forklifts, setForklifts] = useState<Forklift[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Forklift | null>(null);
  const [formData, setFormData] = useState<BYOFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const reload = () => {
    setLoading(true);
    return getExternalServicedForklifts(customerId, { includeDormant: true })
      .then(rows => setForklifts(rows))
      .catch(e => {
        showToast.error(`Failed to load customer-owned forklifts: ${e instanceof Error ? e.message : 'Unknown'}`);
        setForklifts([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getExternalServicedForklifts(customerId, { includeDormant: true })
      .then(rows => {
        if (!cancelled) setForklifts(rows);
      })
      .catch(e => {
        if (!cancelled) {
          showToast.error(`Failed to load customer-owned forklifts: ${e instanceof Error ? e.message : 'Unknown'}`);
          setForklifts([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [customerId]);

  const openEdit = (f: Forklift) => {
    setEditing(f);
    setFormData({
      serial_number: f.serial_number || '',
      forklift_no: f.forklift_no || '',
      customer_forklift_no: f.customer_forklift_no || '',
      make: f.make || '',
      model: f.model || '',
      type: (f.type as ForkliftType) || ForkliftType.DIESEL,
      hourmeter: f.hourmeter || 0,
      last_hourmeter_update: f.last_hourmeter_update ? f.last_hourmeter_update.split('T')[0] : new Date().toISOString().split('T')[0],
      last_service_hourmeter: f.last_service_hourmeter || 0,
      last_service_date: f.last_service_date ? f.last_service_date.split('T')[0] : '',
      year: f.year || null,
      capacity_kg: f.capacity_kg || 0,
      site: f.site || f.location || '',
      status: f.status,
      notes: f.notes || '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await MockDb.updateForklift(editing.forklift_id, formData);
      showToast.success('Forklift updated');
      setEditing(null);
      await reload();
    } catch (err) {
      showToast.error(`Update failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  // Hide entirely when there's nothing to show — keeps the customer page
  // tidy for accounts without any externally-serviced units.
  if (!loading && forklifts.length === 0) return null;

  const sold = forklifts.filter(f => f.acquisition_source === 'sold_from_fleet').length;
  const byo = forklifts.filter(f => f.acquisition_source !== 'sold_from_fleet').length;

  return (
    <div className="bg-[var(--surface)] rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-indigo-600" />
          <h3 className="font-semibold text-slate-800">Customer-owned forklifts under Acwer service</h3>
          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
            {forklifts.length}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {byo > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              <ShieldCheck className="w-3 h-3" /> {byo} BYO
            </span>
          )}
          {sold > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
              <UserCheck className="w-3 h-3" /> {sold} sold from fleet
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-slate-100 max-h-[340px] overflow-y-auto">
        {loading ? (
          <div className="p-4 text-sm text-slate-500">Loading…</div>
        ) : (
          forklifts.map(f => {
            const modelDisplay = [f.make, f.model].filter(Boolean).join(' ').trim();
            const isSold = f.acquisition_source === 'sold_from_fleet';
            return (
              <div
                key={f.forklift_id}
                className="w-full px-4 py-3 hover:bg-slate-50 transition-colors flex items-center gap-3"
              >
                <button
                  onClick={() => navigate(`/forklifts/${f.forklift_id}`)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isSold ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {isSold ? <UserCheck className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-800 truncate">
                      {f.customer_forklift_no || f.serial_number}
                      {f.customer_forklift_no && (
                        <span className="text-xs text-slate-400 font-normal ml-2">SN {f.serial_number}</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {modelDisplay || <span className="text-slate-400">—</span>}
                      <span className="text-slate-400"> · {f.type}</span>
                      {f.hourmeter != null && <span className="text-slate-400"> · {f.hourmeter.toLocaleString()} h</span>}
                      {f.site && <span className="text-slate-400"> · {f.site}</span>}
                    </div>
                    {isSold && f.sold_to_customer_at && (
                      <div className="text-[10px] uppercase tracking-wide text-indigo-500 mt-0.5">
                        Sold {new Date(f.sold_to_customer_at).toLocaleDateString()}
                        {f.sold_price != null && ` · RM ${Number(f.sold_price).toLocaleString()}`}
                      </div>
                    )}
                    {f.service_management_status === 'dormant' && (
                      <div className="text-[10px] uppercase tracking-wide text-slate-400 mt-0.5">Dormant</div>
                    )}
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); openEdit(f); }}
                  className="shrink-0 p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  title="Edit forklift details"
                  aria-label="Edit forklift"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </div>
            );
          })
        )}
      </div>

      {!loading && forklifts.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 flex items-center gap-1.5">
          <Building2 className="w-3 h-3" />
          Click any forklift to view its full ownership history, or the pencil icon to edit details inline.
        </div>
      )}

      <AddEditForkliftModal
        isOpen={editing !== null}
        onClose={() => { if (!saving) setEditing(null); }}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        isEditing={true}
      />
    </div>
  );
};

export default ServicedExternalsSection;
