import { ArrowLeft,ClipboardList,Save,Truck,Wrench } from 'lucide-react';
import React from 'react';
import { Combobox,ComboboxOption } from '../../components/Combobox';
import { JobPriority,JobType,User } from '../../types';
import { ForkliftSelectionSection,NewCustomerModal } from './components';
import { INPUT_CLASS_NAME } from './constants';
import { useCreateJobForm } from './hooks';

interface CreateJobProps {
  currentUser: User;
}

const CreateJobPage: React.FC<CreateJobProps> = ({ currentUser }) => {
  const {
    formData,
    setFormData,
    selectedForklift,
    customers,
    forklifts,
    technicians,
    canCreateJobs,
    showNewCustomerModal,
    setShowNewCustomerModal,
    newCustomerNameQuery,
    handleSubmit,
    handleCreateCustomer,
    openNewCustomerModal,
    navigate,
  } = useCreateJobForm(currentUser);

  const customerOptions: ComboboxOption[] = customers.map(c => ({
    id: c.customer_id,
    label: c.name,
    subLabel: c.address
  }));

  const techOptions: ComboboxOption[] = technicians.map(t => ({
    id: t.user_id,
    label: t.name,
    subLabel: t.email
  }));

  return (
    <div className="max-w-5xl mx-auto pb-24 md:pb-8 px-2 sm:px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Wrench className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg md:text-xl font-bold text-slate-900">New Job Order</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-[var(--surface)] rounded-xl shadow-sm overflow-hidden">
        {/* Section 1: Customer & Equipment */}
        <div className="border-b border-slate-100">
          <div className="px-4 md:px-6 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
            <Truck className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">Customer & Equipment</span>
          </div>
          <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <Combobox 
              label="Customer"
              options={customerOptions}
              value={formData.customer_id}
              onChange={(val) => setFormData(prev => ({...prev, customer_id: val, forklift_id: ''}))}
              placeholder="Search customer..."
              onAddNew={openNewCustomerModal}
              addNewLabel="Create New Customer"
            />

            <ForkliftSelectionSection
              formData={formData}
              setFormData={setFormData}
              forklifts={formData.customer_id ? forklifts.filter(f => f.current_customer_id === formData.customer_id) : forklifts}
              selectedForklift={selectedForklift}
              inputClassName={INPUT_CLASS_NAME}
            />
          </div>
        </div>

        {/* Section 2: Job Details */}
        <div className="border-b border-slate-100">
          <div className="px-4 md:px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-800">Job Details</span>
          </div>
          <div className="p-4 md:p-6 space-y-4 md:space-y-5">
            {/* Title + Type/Priority */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Job Title</label>
                <input 
                  type="text"
                  className={INPUT_CLASS_NAME}
                  value={formData.title}
                  onChange={e => setFormData(prev => ({...prev, title: e.target.value}))}
                  placeholder="e.g., PM Service, Hydraulic Repair"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Combobox
                  label="Job Type"
                  options={Object.values(JobType).map(t => ({ id: t, label: t }))}
                  value={formData.job_type}
                  onChange={(val) => setFormData(prev => ({...prev, job_type: val as JobType}))}
                  placeholder="Select..."
                />
                <Combobox
                  label="Priority"
                  options={Object.values(JobPriority).map(p => ({ id: p, label: p }))}
                  value={formData.priority}
                  onChange={(val) => setFormData(prev => ({...prev, priority: val as JobPriority}))}
                  placeholder="Select..."
                />
              </div>
            </div>

            {/* Description + Technician */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
                <textarea 
                  className={`${INPUT_CLASS_NAME} h-24 resize-none`}
                  value={formData.description}
                  onChange={e => setFormData(prev => ({...prev, description: e.target.value}))}
                  placeholder="Describe the issue or service required..."
                  required
                />
              </div>
              {canCreateJobs && (
                <Combobox
                  label="Assign Technician (Optional)"
                  options={techOptions}
                  value={formData.assigned_technician_id}
                  onChange={(val) => setFormData(prev => ({...prev, assigned_technician_id: val}))}
                  placeholder="Search technician..."
                />
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 md:p-6 flex flex-col sm:flex-row justify-end gap-3 bg-slate-50/50">
          <button 
            type="button" 
            onClick={() => navigate(-1)} 
            className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 shadow-sm transition-colors"
          >
            <Save className="w-4 h-4" /> Create Job
          </button>
        </div>
      </form>

      <NewCustomerModal
        isOpen={showNewCustomerModal}
        onClose={() => setShowNewCustomerModal(false)}
        onSubmit={handleCreateCustomer}
        initialName={newCustomerNameQuery}
        inputClassName={INPUT_CLASS_NAME}
      />
    </div>
  );
};

export default CreateJobPage;
