import React, { useState, useEffect } from 'react';
import { SupabaseDb } from '../services/supabaseService';
import { showToast } from '../services/toastService';
import { User } from '../types_with_invoice_tracking';
import { 
  Settings, Plus, Edit2, Trash2, Save, X, Clock, Calendar,
  AlertTriangle, CheckCircle, Wrench, Fuel, Battery, Flame
} from 'lucide-react';

interface ServiceInterval {
  interval_id: string;
  forklift_type: string;
  service_type: string;
  hourmeter_interval: number;
  calendar_interval_days: number | null;
  priority: string;
  checklist_items: string[];
  estimated_duration_hours: number | null;
  name: string | null;
  is_active: boolean;
  created_at: string;
}

interface Props {
  currentUser: User;
}

const FORKLIFT_TYPES = ['Diesel', 'Electric', 'LPG'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Emergency'];

const ServiceIntervalsConfig: React.FC<Props> = ({ currentUser }) => {
  const [intervals, setIntervals] = useState<ServiceInterval[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');

  // Form state for add/edit
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
      const data = await SupabaseDb.getServiceIntervals();
      setIntervals(data);
    } catch (e) {
      showToast.error('Failed to load service intervals');
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Diesel': return <Fuel className="w-4 h-4 text-amber-400" />;
      case 'Electric': return <Battery className="w-4 h-4 text-green-400" />;
      case 'LPG': return <Flame className="w-4 h-4 text-orange-400" />;
      default: return <Wrench className="w-4 h-4 text-slate-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Emergency': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'High': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'Medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Low': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
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
    if (!formData.service_type.trim()) {
      showToast.error('Service type is required');
      return;
    }
    if (formData.hourmeter_interval <= 0) {
      showToast.error('Hourmeter interval must be greater than 0');
      return;
    }

    const result = await SupabaseDb.createServiceInterval({
      forklift_type: formData.forklift_type,
      service_type: formData.service_type,
      hourmeter_interval: formData.hourmeter_interval,
      calendar_interval_days: formData.calendar_interval_days || undefined,
      priority: formData.priority,
      estimated_duration_hours: formData.estimated_duration_hours || undefined,
      name: formData.name || formData.service_type,
    });

    if (result) {
      showToast.success('Service interval created');
      setShowAddModal(false);
      resetForm();
      loadIntervals();
    } else {
      showToast.error('Failed to create service interval');
    }
  };

  const handleEdit = (interval: ServiceInterval) => {
    setEditingId(interval.interval_id);
    setFormData({
      forklift_type: interval.forklift_type,
      service_type: interval.service_type,
      hourmeter_interval: interval.hourmeter_interval,
      calendar_interval_days: interval.calendar_interval_days,
      priority: interval.priority,
      estimated_duration_hours: interval.estimated_duration_hours,
      name: interval.name || '',
    });
  };

  const handleSaveEdit = async (intervalId: string) => {
    if (!formData.service_type.trim()) {
      showToast.error('Service type is required');
      return;
    }

    const result = await SupabaseDb.updateServiceInterval(intervalId, {
      forklift_type: formData.forklift_type,
      service_type: formData.service_type,
      hourmeter_interval: formData.hourmeter_interval,
      calendar_interval_days: formData.calendar_interval_days,
      priority: formData.priority,
      estimated_duration_hours: formData.estimated_duration_hours,
      name: formData.name || formData.service_type,
    });

    if (result) {
      showToast.success('Service interval updated');
      setEditingId(null);
      resetForm();
      loadIntervals();
    } else {
      showToast.error('Failed to update service interval');
    }
  };

  const handleDelete = async (intervalId: string, serviceName: string) => {
    if (!confirm(`Delete service interval "${serviceName}"?`)) return;

    const success = await SupabaseDb.deleteServiceInterval(intervalId);
    if (success) {
      showToast.success('Service interval deactivated');
      loadIntervals();
    } else {
      showToast.error('Failed to delete service interval');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    resetForm();
  };

  // ACWER default intervals reference
  const acwerDefaults = [
    { type: 'Electric', interval: '3 months (calendar)', hours: null },
    { type: 'Diesel', interval: '500 hours', hours: 500 },
    { type: 'LPG', interval: '350 hours', hours: 350 },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-theme-primary flex items-center gap-2">
            <Settings className="w-7 h-7 text-indigo-500" />
            Service Intervals Config
          </h1>
          <p className="text-theme-secondary text-sm mt-1">
            Configure service intervals by forklift type. Changes affect prediction calculations.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Interval
        </button>
      </div>

      {/* ACWER Reference Card */}
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 mb-6">
        <h3 className="text-sm font-semibold text-indigo-400 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          ACWER Default Service Intervals
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {acwerDefaults.map((d) => (
            <div key={d.type} className="flex items-center gap-2 text-sm text-theme-secondary">
              {getTypeIcon(d.type)}
              <span className="font-medium text-theme-primary">{d.type}:</span>
              <span>{d.interval}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedType('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
            selectedType === 'all'
              ? 'bg-indigo-600 text-white'
              : 'bg-theme-card text-theme-secondary hover:bg-theme-hover'
          }`}
        >
          All Types
        </button>
        {FORKLIFT_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap flex items-center gap-2 ${
              selectedType === type
                ? 'bg-indigo-600 text-white'
                : 'bg-theme-card text-theme-secondary hover:bg-theme-hover'
            }`}
          >
            {getTypeIcon(type)}
            {type}
          </button>
        ))}
      </div>

      {/* Intervals List */}
      {loading ? (
        <div className="bg-theme-card rounded-xl p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-theme-secondary mt-3">Loading intervals...</p>
        </div>
      ) : filteredIntervals.length === 0 ? (
        <div className="bg-theme-card rounded-xl p-8 text-center">
          <Wrench className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-theme-secondary">No service intervals configured.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-3 text-indigo-400 hover:text-indigo-300 text-sm font-medium"
          >
            + Add your first interval
          </button>
        </div>
      ) : (
        <div className="bg-theme-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-theme-hover">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-theme-secondary uppercase">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-theme-secondary uppercase">Service</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-theme-secondary uppercase">Hourmeter</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-theme-secondary uppercase">Calendar</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-theme-secondary uppercase">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-theme-secondary uppercase">Duration</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-theme-secondary uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border">
                {filteredIntervals.filter(i => i.is_active).map((interval) => (
                  <tr key={interval.interval_id} className="hover:bg-theme-hover transition">
                    {editingId === interval.interval_id ? (
                      // Edit Mode
                      <>
                        <td className="px-4 py-3">
                          <select
                            value={formData.forklift_type}
                            onChange={(e) => setFormData({ ...formData, forklift_type: e.target.value })}
                            className="bg-theme-input border border-theme-border rounded px-2 py-1 text-sm text-theme-primary w-24"
                          >
                            {FORKLIFT_TYPES.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={formData.service_type}
                            onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                            className="bg-theme-input border border-theme-border rounded px-2 py-1 text-sm text-theme-primary w-32"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={formData.hourmeter_interval}
                            onChange={(e) => setFormData({ ...formData, hourmeter_interval: parseInt(e.target.value) || 0 })}
                            className="bg-theme-input border border-theme-border rounded px-2 py-1 text-sm text-theme-primary w-20"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={formData.calendar_interval_days || ''}
                            onChange={(e) => setFormData({ ...formData, calendar_interval_days: e.target.value ? parseInt(e.target.value) : null })}
                            placeholder="days"
                            className="bg-theme-input border border-theme-border rounded px-2 py-1 text-sm text-theme-primary w-20"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={formData.priority}
                            onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                            className="bg-theme-input border border-theme-border rounded px-2 py-1 text-sm text-theme-primary w-24"
                          >
                            {PRIORITIES.map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.5"
                            value={formData.estimated_duration_hours || ''}
                            onChange={(e) => setFormData({ ...formData, estimated_duration_hours: e.target.value ? parseFloat(e.target.value) : null })}
                            placeholder="hrs"
                            className="bg-theme-input border border-theme-border rounded px-2 py-1 text-sm text-theme-primary w-16"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleSaveEdit(interval.interval_id)}
                              className="p-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded transition"
                              title="Save"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-1.5 bg-slate-500/20 hover:bg-slate-500/30 text-slate-400 rounded transition"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      // View Mode
                      <>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {getTypeIcon(interval.forklift_type)}
                            <span className="text-sm font-medium text-theme-primary">{interval.forklift_type}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-theme-primary">{interval.service_type}</span>
                          {interval.name && interval.name !== interval.service_type && (
                            <span className="text-xs text-theme-secondary block">{interval.name}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-sm text-theme-primary">
                            <Clock className="w-3.5 h-3.5 text-theme-secondary" />
                            {interval.hourmeter_interval} hrs
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {interval.calendar_interval_days ? (
                            <div className="flex items-center gap-1 text-sm text-theme-primary">
                              <Calendar className="w-3.5 h-3.5 text-theme-secondary" />
                              {interval.calendar_interval_days} days
                            </div>
                          ) : (
                            <span className="text-xs text-theme-secondary">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(interval.priority)}`}>
                            {interval.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {interval.estimated_duration_hours ? (
                            <span className="text-sm text-theme-secondary">{interval.estimated_duration_hours}h</span>
                          ) : (
                            <span className="text-xs text-theme-secondary">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleEdit(interval)}
                              className="p-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 rounded transition"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(interval.interval_id, interval.service_type)}
                              className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-theme-card rounded-xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-theme-border">
              <h2 className="text-lg font-semibold text-theme-primary">Add Service Interval</h2>
              <button
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className="p-1 hover:bg-theme-hover rounded transition"
              >
                <X className="w-5 h-5 text-theme-secondary" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">Forklift Type</label>
                <select
                  value={formData.forklift_type}
                  onChange={(e) => setFormData({ ...formData, forklift_type: e.target.value })}
                  className="w-full bg-theme-input border border-theme-border rounded-lg px-3 py-2 text-theme-primary"
                >
                  {FORKLIFT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">Service Type *</label>
                <input
                  type="text"
                  value={formData.service_type}
                  onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                  placeholder="e.g., PM Service, Oil Change"
                  className="w-full bg-theme-input border border-theme-border rounded-lg px-3 py-2 text-theme-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-theme-secondary mb-1">Hourmeter Interval *</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.hourmeter_interval}
                      onChange={(e) => setFormData({ ...formData, hourmeter_interval: parseInt(e.target.value) || 0 })}
                      className="w-full bg-theme-input border border-theme-border rounded-lg px-3 py-2 text-theme-primary pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-secondary text-sm">hrs</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-secondary mb-1">Calendar Interval</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.calendar_interval_days || ''}
                      onChange={(e) => setFormData({ ...formData, calendar_interval_days: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="Optional"
                      className="w-full bg-theme-input border border-theme-border rounded-lg px-3 py-2 text-theme-primary pr-14"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-secondary text-sm">days</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-theme-secondary mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full bg-theme-input border border-theme-border rounded-lg px-3 py-2 text-theme-primary"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-secondary mb-1">Est. Duration</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      value={formData.estimated_duration_hours || ''}
                      onChange={(e) => setFormData({ ...formData, estimated_duration_hours: e.target.value ? parseFloat(e.target.value) : null })}
                      placeholder="Optional"
                      className="w-full bg-theme-input border border-theme-border rounded-lg px-3 py-2 text-theme-primary pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-secondary text-sm">hrs</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">Display Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Optional (defaults to service type)"
                  className="w-full bg-theme-input border border-theme-border rounded-lg px-3 py-2 text-theme-primary"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-theme-border">
              <button
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className="px-4 py-2 text-theme-secondary hover:bg-theme-hover rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition font-medium"
              >
                Add Interval
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceIntervalsConfig;
