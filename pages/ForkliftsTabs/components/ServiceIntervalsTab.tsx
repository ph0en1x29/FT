/* eslint-disable max-lines */
import {
Battery,
Edit2,
Flame,
Fuel,
Loader2,
Plus,
Settings,
Trash2,
Wrench,
X
} from 'lucide-react';
import React,{ useEffect,useState } from 'react';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { ServiceInterval,TabProps } from '../types';

const FORKLIFT_TYPES = ['Diesel', 'Electric', 'LPG'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Emergency'];

const inputClassName = "w-full px-3 py-2.5 bg-[#f5f5f5] text-[#111827] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/25 placeholder-slate-400";

const ServiceIntervalsTab: React.FC<TabProps> = ({ _currentUser }) => {
  const [intervals, setIntervals] = useState<ServiceInterval[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingInterval, setEditingInterval] = useState<ServiceInterval | null>(null);

  const [formData, setFormData] = useState({
    forklift_type: 'Diesel',
    service_type: '',
    hourmeter_interval: 500,
    calendar_interval_days: null as number | null,
    priority: 'Medium',
    estimated_duration_hours: null as number | null,
    name: '',
  });

  useEffect(() => {
    loadIntervals();
  }, []);

  const loadIntervals = async () => {
    setLoading(true);
    try {
      const data = await MockDb.getServiceIntervals();
      setIntervals(data);
    } catch (_e) {
      showToast.error('Failed to load service intervals');
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Diesel': return <Fuel className="w-4 h-4 text-amber-500" />;
      case 'Electric': return <Battery className="w-4 h-4 text-green-500" />;
      case 'LPG': return <Flame className="w-4 h-4 text-orange-500" />;
      default: return <Wrench className="w-4 h-4 text-slate-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Emergency': return 'bg-red-100 text-red-700';
      case 'High': return 'bg-orange-100 text-orange-700';
      case 'Medium': return 'bg-yellow-100 text-yellow-700';
      case 'Low': return 'bg-green-100 text-green-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const filteredIntervals = selectedType === 'all' 
    ? intervals 
    : intervals.filter(i => i.forklift_type === selectedType);

  const resetForm = () => {
    setFormData({
      forklift_type: 'Diesel',
      service_type: '',
      hourmeter_interval: 500,
      calendar_interval_days: null,
      priority: 'Medium',
      estimated_duration_hours: null,
      name: '',
    });
  };

  const handleAdd = async () => {
    if (!formData.service_type) {
      showToast.error('Service type is required');
      return;
    }

    try {
      await MockDb.createServiceInterval({
        forklift_type: formData.forklift_type,
        service_type: formData.service_type,
        hourmeter_interval: formData.hourmeter_interval,
        calendar_interval_days: formData.calendar_interval_days,
        priority: formData.priority,
        estimated_duration_hours: formData.estimated_duration_hours,
        name: formData.name || null,
        checklist_items: [],
      });
      showToast.success('Service interval created');
      setShowAddModal(false);
      resetForm();
      await loadIntervals();
    } catch (_e) {
      showToast.error('Failed to create service interval');
    }
  };

  const handleUpdate = async () => {
    if (!editingInterval) return;
    
    try {
      await MockDb.updateServiceInterval(editingInterval.interval_id, {
        forklift_type: formData.forklift_type,
        service_type: formData.service_type,
        hourmeter_interval: formData.hourmeter_interval,
        calendar_interval_days: formData.calendar_interval_days,
        priority: formData.priority,
        estimated_duration_hours: formData.estimated_duration_hours,
        name: formData.name || null,
      });
      showToast.success('Service interval updated');
      setEditingInterval(null);
      resetForm();
      await loadIntervals();
    } catch (_e) {
      showToast.error('Failed to update service interval');
    }
  };

  const handleDelete = async (interval: ServiceInterval) => {
    if (!confirm(`Delete service interval "${interval.service_type}"?`)) return;
    
    try {
      await MockDb.deleteServiceInterval(interval.interval_id);
      showToast.success('Service interval deleted');
      await loadIntervals();
    } catch (_e) {
      showToast.error('Failed to delete service interval');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Actions Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedType('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${selectedType === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            All
          </button>
          {FORKLIFT_TYPES.map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${selectedType === type ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {getTypeIcon(type)} {type}
            </button>
          ))}
        </div>
        <button
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
        >
          <Plus className="w-4 h-4" /> Add Interval
        </button>
      </div>

      {/* ACWER Defaults Reference */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-800 mb-2">ACWER Service Defaults</h4>
        <div className="grid grid-cols-3 gap-4 text-sm text-blue-700">
          <div className="flex items-center gap-2"><Battery className="w-4 h-4 text-green-500" /> Electric: Every 3 months</div>
          <div className="flex items-center gap-2"><Fuel className="w-4 h-4 text-amber-500" /> Diesel: Every 500 hours</div>
          <div className="flex items-center gap-2"><Flame className="w-4 h-4 text-orange-500" /> LPG: Every 350 hours</div>
        </div>
      </div>

      {/* Intervals List */}
      {filteredIntervals.length === 0 ? (
        <div className="card-theme rounded-xl p-12 text-center">
          <Settings className="w-12 h-12 text-theme-muted opacity-40 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-theme mb-2">No service intervals</h3>
          <p className="text-sm text-theme-muted">Add service intervals to track maintenance schedules</p>
        </div>
      ) : (
        <div className="card-theme rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-theme-surface-2 border-b border-theme">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Service</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Interval</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Priority</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-theme-muted uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {filteredIntervals.map(interval => (
                <tr key={interval.interval_id} className="clickable-row">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(interval.forklift_type)}
                      <span className="text-sm font-medium">{interval.forklift_type}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm">{interval.service_type}</span>
                    {interval.name && <span className="text-xs text-slate-500 ml-2">({interval.name})</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">
                      {interval.hourmeter_interval > 0 && <span>{interval.hourmeter_interval} hrs</span>}
                      {interval.calendar_interval_days && (
                        <span className="text-slate-500 ml-2">/ {interval.calendar_interval_days} days</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(interval.priority)}`}>
                      {interval.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        setFormData({
                          forklift_type: interval.forklift_type,
                          service_type: interval.service_type,
                          hourmeter_interval: interval.hourmeter_interval,
                          calendar_interval_days: interval.calendar_interval_days,
                          priority: interval.priority,
                          estimated_duration_hours: interval.estimated_duration_hours,
                          name: interval.name || '',
                        });
                        setEditingInterval(interval);
                      }}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(interval)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded ml-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingInterval) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-[var(--surface)] rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">
                {editingInterval ? 'Edit Service Interval' : 'Add Service Interval'}
              </h3>
              <button onClick={() => { setShowAddModal(false); setEditingInterval(null); resetForm(); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Forklift Type</label>
                <select className={inputClassName} value={formData.forklift_type} onChange={e => setFormData({...formData, forklift_type: e.target.value})}>
                  {FORKLIFT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Service Type *</label>
                <input type="text" className={inputClassName} value={formData.service_type} onChange={e => setFormData({...formData, service_type: e.target.value})} placeholder="e.g., Regular Maintenance" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hourmeter Interval</label>
                  <input type="number" className={inputClassName} value={formData.hourmeter_interval} onChange={e => setFormData({...formData, hourmeter_interval: parseInt(e.target.value) || 0})} min="0" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Calendar Days</label>
                  <input type="number" className={inputClassName} value={formData.calendar_interval_days || ''} onChange={e => setFormData({...formData, calendar_interval_days: e.target.value ? parseInt(e.target.value) : null})} min="0" placeholder="Optional" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Priority</label>
                <select className={inputClassName} value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => { setShowAddModal(false); setEditingInterval(null); resetForm(); }} className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">
                  Cancel
                </button>
                <button type="button" onClick={editingInterval ? handleUpdate : handleAdd} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                  {editingInterval ? 'Update' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceIntervalsTab;
