import { ArrowLeft,Save } from 'lucide-react';
import React from 'react';
import { Combobox,ComboboxOption } from '../../components/Combobox';
import { JobPriority,JobType,User } from '../../types';
import { ForkliftSelectionSection,NewCustomerModal } from './components';
import { INPUT_CLASS_NAME } from './constants';
import { useCreateJobForm } from './hooks';

interface CreateJobProps {
  currentUser: User;
}

/**
 * CreateJob page - Form for creating new job orders.
 * Supports prefilled data from scheduled services and inline customer creation.
 */
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

  // Build combobox options
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
    <div className="max-w-2xl mx-auto space-y-4 md:space-y-6 relative pb-24 md:pb-8 px-1 sm:px-0">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 md:mb-6">
        <button 
          onClick={() => navigate(-1)} 
          className="p-3 hover:bg-slate-100 rounded-full transition-colors min-w-[44px] h-12 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-slate-900">New Job Order</h1>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="bg-[var(--surface)] p-3 md:p-4 lg:p-6 rounded-xl shadow-sm space-y-4 md:space-y-6">
        
        {/* Customer Selection */}
        <Combobox 
          label="Customer"
          options={customerOptions}
          value={formData.customer_id}
          onChange={(val) => setFormData(prev => ({...prev, customer_id: val}))}
          placeholder="Search customer..."
          onAddNew={openNewCustomerModal}
          addNewLabel="Create New Customer"
        />

        {/* Forklift Selection Section */}
        <ForkliftSelectionSection
          formData={formData}
          setFormData={setFormData}
          forklifts={forklifts}
          selectedForklift={selectedForklift}
          inputClassName={INPUT_CLASS_NAME}
        />

        {/* Job Title */}
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

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
          <textarea 
            className={`${INPUT_CLASS_NAME} h-32 resize-none`}
            value={formData.description}
            onChange={e => setFormData(prev => ({...prev, description: e.target.value}))}
            placeholder="Describe the issue or service required..."
            required
          />
        </div>

        {/* Job Type & Priority */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Combobox
            label="Job Type"
            options={Object.values(JobType).map(t => ({ id: t, label: t }))}
            value={formData.job_type}
            onChange={(val) => setFormData(prev => ({...prev, job_type: val as JobType}))}
            placeholder="Select job type..."
          />
          <Combobox
            label="Priority"
            options={Object.values(JobPriority).map(p => ({ id: p, label: p }))}
            value={formData.priority}
            onChange={(val) => setFormData(prev => ({...prev, priority: val as JobPriority}))}
            placeholder="Select priority..."
          />

          {/* Technician Assignment (Admin/Supervisor only) */}
          {canCreateJobs && (
            <div>
              <Combobox
                label="Assign Technician (Optional)"
                options={techOptions}
                value={formData.assigned_technician_id}
                onChange={(val) => setFormData(prev => ({...prev, assigned_technician_id: val}))}
                placeholder="Select Technician..."
              />
            </div>
          )}
        </div>

        {/* Form Actions */}
        <div className="pt-4 md:pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3">
          <button 
            type="button" 
            onClick={() => navigate(-1)} 
            className="px-5 py-2.5 h-12 sm:h-auto text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="px-6 py-2.5 h-12 sm:h-auto bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 shadow-sm transition-colors focus:ring-4 focus:ring-blue-100"
          >
            <Save className="w-4 h-4" /> Create Job
          </button>
        </div>
      </form>

      {/* New Customer Modal */}
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
