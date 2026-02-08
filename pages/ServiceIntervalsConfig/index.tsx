import React,{ useEffect,useState } from 'react';
import { SupabaseDb } from '../../services/supabaseService';
import { showToast } from '../../services/toastService';
import {
AcwerReferenceCard,
AddIntervalModal,
FilterTabs,
IntervalsTable,
ServiceIntervalsHeader,
} from './components';
import { INITIAL_FORM_DATA } from './constants';
import { ServiceInterval,ServiceIntervalFormData,ServiceIntervalsConfigProps } from './types';

const ServiceIntervalsConfig: React.FC<ServiceIntervalsConfigProps> = ({ _currentUser }) => {
  const [intervals, setIntervals] = useState<ServiceInterval[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [formData, setFormData] = useState<ServiceIntervalFormData>(INITIAL_FORM_DATA);

  useEffect(() => {
    loadIntervals();
  }, []);

  const loadIntervals = async () => {
    setLoading(true);
    try {
      const data = await SupabaseDb.getServiceIntervals();
      setIntervals(data);
    } catch (_e) {
      showToast.error('Failed to load service intervals');
    } finally {
      setLoading(false);
    }
  };

  const filteredIntervals = selectedType === 'all'
    ? intervals
    : intervals.filter(i => i.forklift_type === selectedType);

  const resetForm = () => setFormData(INITIAL_FORM_DATA);

  const handleAdd = async () => {
    if (!formData.service_type.trim()) {
      showToast.error('Service type is required');
      return;
    }
    if (formData.hourmeter_interval <= 0) {
      showToast.error('Hourmeter interval must be greater than 0');
      return;
    }

    try {
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
    } catch (_error) {
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

    try {
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
    } catch (_error) {
      showToast.error('Failed to update service interval');
    }
  };

  const handleDelete = async (intervalId: string, serviceName: string) => {
    if (!confirm(`Delete service interval "${serviceName}"?`)) return;

    try {
      const success = await SupabaseDb.deleteServiceInterval(intervalId);
      if (success) {
        showToast.success('Service interval deactivated');
        loadIntervals();
      } else {
        showToast.error('Failed to delete service interval');
      }
    } catch (_error) {
      showToast.error('Failed to delete service interval');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    resetForm();
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    resetForm();
  };

  return (
    <div className="max-w-6xl mx-auto">
      <ServiceIntervalsHeader onAddClick={() => setShowAddModal(true)} />
      <AcwerReferenceCard />
      <FilterTabs selectedType={selectedType} onSelectType={setSelectedType} />
      <IntervalsTable
        intervals={filteredIntervals}
        loading={loading}
        editingId={editingId}
        formData={formData}
        onFormChange={setFormData}
        onEdit={handleEdit}
        onSaveEdit={handleSaveEdit}
        onCancelEdit={handleCancelEdit}
        onDelete={handleDelete}
        onAddClick={() => setShowAddModal(true)}
      />
      <AddIntervalModal
        isOpen={showAddModal}
        formData={formData}
        onFormChange={setFormData}
        onClose={handleCloseModal}
        onAdd={handleAdd}
      />
    </div>
  );
};

export default ServiceIntervalsConfig;
