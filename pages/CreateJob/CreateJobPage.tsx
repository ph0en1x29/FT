import { ArrowLeft,Building2,CalendarClock,ClipboardList,MapPin,Phone,Save,Truck,User,UserCheck,Wrench } from 'lucide-react';
import React,{ useMemo } from 'react';
import { Combobox,ComboboxOption } from '../../components/Combobox';
import { DatePicker } from '../../components/DatePicker';
import { ForkliftStatus,JobPriority,JobType,User as UserType } from '../../types';
import { DuplicateJobWarningModal,ExternalForkliftSection,ForkliftSelectionSection,NewCustomerModal } from './components';
import { INPUT_CLASS_NAME } from './constants';
import { useCreateJobForm } from './hooks';

interface CreateJobProps {
  currentUser: UserType;
}

const CreateJobPage: React.FC<CreateJobProps> = ({ currentUser }) => {
  const {
    formData,
    setFormData,
    selectedForklift,
    customerSearchResults,
    isSearchingCustomers,
    searchCustomers,
    selectedCustomer,
    forklifts,
    technicians,
    contacts,
    sites,
    canCreateJobs,
    showNewCustomerModal,
    setShowNewCustomerModal,
    newCustomerNameQuery,
    duplicateJobWarning,
    handleConfirmDuplicateJob,
    handleDismissDuplicateWarning,
    handleSubmit,
    handleCreateCustomer,
    handleCreateExternalForklift,
    openNewCustomerModal,
    navigate,
  } = useCreateJobForm(currentUser);

  const customerOptions: ComboboxOption[] = useMemo(() => {
    const searchOpts = customerSearchResults.map(c => ({
      id: c.customer_id,
      label: c.name,
    }));
    // If we have a selected customer not in search results, prepend it
    if (selectedCustomer && !searchOpts.find(o => o.id === selectedCustomer.customer_id)) {
      searchOpts.unshift({ id: selectedCustomer.customer_id, label: selectedCustomer.name });
    }
    return searchOpts;
  }, [customerSearchResults, selectedCustomer]);

  const techOptions: ComboboxOption[] = technicians.map(t => ({
    id: t.user_id,
    label: t.name,
    subLabel: t.email
  }));

  const contactOptions: ComboboxOption[] = contacts.map(c => ({
    id: c.contact_id,
    label: c.name,
    subLabel: [c.role, c.phone].filter(Boolean).join(' · ')
  }));

  const siteOptions: ComboboxOption[] = sites.filter(s => s.is_active).map(s => ({
    id: s.site_id,
    label: s.site_name,
    subLabel: s.address
  }));

  const selectedContact = useMemo(() =>
    contacts.find(c => c.contact_id === formData.contact_id),
    [contacts, formData.contact_id]
  );

  const selectedSite = useMemo(() =>
    sites.find(s => s.site_id === formData.site_id),
    [sites, formData.site_id]
  );

  const customerForklifts = useMemo(() => 
    forklifts.filter(f => f.current_customer_id === formData.customer_id && f.status === ForkliftStatus.RENTED_OUT),
    [forklifts, formData.customer_id]
  );

  return (
    <div className="min-w-0 max-w-7xl mx-auto overflow-x-hidden pb-24 md:pb-8 px-2 sm:px-4">
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

      <div className="min-w-0 flex flex-col xl:flex-row gap-5">
        {/* Main Form */}
        <form onSubmit={handleSubmit} className="min-w-0 flex-1 max-w-full bg-[var(--surface)] rounded-xl shadow-sm overflow-hidden">
          {/* Section 1: Customer & Equipment */}
          <div className="border-b border-slate-100">
            <div className="px-4 md:px-6 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
              <Truck className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-800">Customer & Equipment</span>
            </div>
            <div className="min-w-0 p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              <Combobox 
                label="Customer"
                options={customerOptions}
                value={formData.customer_id}
                onChange={(val) => setFormData(prev => ({...prev, customer_id: val, forklift_id: '', contact_id: '', site_id: ''}))}
                placeholder="Search customer..."
                onAddNew={openNewCustomerModal}
                addNewLabel="Create New Customer"
                onSearch={searchCustomers}
                isSearching={isSearchingCustomers}
              />

              <ForkliftSelectionSection
                formData={formData}
                setFormData={setFormData}
                forklifts={formData.customer_id ? forklifts.filter(f => f.current_customer_id === formData.customer_id) : forklifts}
                selectedForklift={selectedForklift}
                inputClassName={INPUT_CLASS_NAME}
              />

              <ExternalForkliftSection
                customerId={formData.customer_id}
                customerForklifts={customerForklifts}
                onCreateExternal={handleCreateExternalForklift}
                inputClassName={INPUT_CLASS_NAME}
              />

              {formData.customer_id && contactOptions.length > 0 && (
                <Combobox
                  label="Person In Charge (PIC)"
                  options={contactOptions}
                  value={formData.contact_id}
                  onChange={(val) => setFormData(prev => ({...prev, contact_id: val}))}
                  placeholder="Select contact..."
                />
              )}
              {formData.customer_id && siteOptions.length > 0 && (
                <Combobox
                  label="Site Location"
                  options={siteOptions}
                  value={formData.site_id}
                  onChange={(val) => setFormData(prev => ({...prev, site_id: val}))}
                  placeholder="Select site..."
                />
              )}
            </div>
          </div>

          {/* Section 2: Job Details */}
          <div className="border-b border-slate-100">
            <div className="px-4 md:px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-800">Job Details</span>
            </div>
            <div className="p-4 md:p-6 space-y-4 md:space-y-5">
              {/* Job Title — full width */}
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

              {/* Type + Priority + Technician — 3 columns on desktop */}
              <div className={`min-w-0 grid grid-cols-1 sm:grid-cols-2 ${canCreateJobs ? 'lg:grid-cols-3' : ''} gap-4`}>
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

              {/* Description — full width */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
                <textarea
                  className={`${INPUT_CLASS_NAME} h-28 resize-none`}
                  value={formData.description}
                  onChange={e => setFormData(prev => ({...prev, description: e.target.value}))}
                  placeholder="Describe the issue or service required..."
                  required
                />
              </div>

              {/* Schedule Date — optional, admin-only scheduling */}
              {canCreateJobs && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                    <CalendarClock className="w-4 h-4 text-slate-500" />
                    Schedule Date (Optional)
                  </label>
                  <DatePicker
                    value={formData.scheduled_date}
                    onChange={(iso) => setFormData(prev => ({ ...prev, scheduled_date: iso }))}
                    placeholder="Unscheduled — no reminder"
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    The assigned technician will be notified at <span className="font-semibold text-slate-700">7:30 AM Malaysia Time</span> on the selected date. Leave empty to skip scheduling.
                  </p>
                </div>
              )}
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

        {/* Context Sidebar — visible on xl */}
        <div className="hidden xl:block w-80 max-w-full shrink-0 space-y-4">
          {selectedCustomer ? (
            <>
              {/* Customer Card */}
              <div className="bg-[var(--surface)] rounded-xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-gradient-to-r from-sky-100 to-blue-50 border-b border-sky-200 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-sky-600" />
                  <span className="text-sm font-semibold text-sky-800">Customer</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{selectedCustomer.name}</p>
                      {selectedCustomer.contact_person && (
                        <p className="text-xs text-slate-500">Attn: {selectedCustomer.contact_person}</p>
                      )}
                    </div>
                  </div>
                  {selectedCustomer.address && (
                    <div className="flex items-start gap-2 text-sm text-slate-600">
                      <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
                      <span>{selectedCustomer.address}</span>
                    </div>
                  )}
                  {selectedCustomer.phone && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Phone className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      <span>{selectedCustomer.phone}</span>
                    </div>
                  )}
                  {selectedCustomer.account_number && (
                    <div className="text-xs text-slate-400 pt-1 border-t border-slate-100">
                      A/C: {selectedCustomer.account_number}
                    </div>
                  )}
                </div>
              </div>

              {/* PIC & Site */}
              {(selectedContact || selectedSite) && (
                <div className="bg-[var(--surface)] rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-gradient-to-r from-sky-100 to-blue-50 border-b border-sky-200 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-sky-600" />
                    <span className="text-sm font-semibold text-sky-800">Job Location</span>
                  </div>
                  <div className="p-4 space-y-3">
                    {selectedContact && (
                      <div>
                        <p className="text-xs font-bold uppercase text-slate-400 mb-1">PIC</p>
                        <p className="text-sm font-semibold text-slate-900">{selectedContact.name}</p>
                        {selectedContact.role && <p className="text-xs text-slate-500">{selectedContact.role}</p>}
                        {selectedContact.phone && (
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                            <Phone className="w-3 h-3" />
                            <span>{selectedContact.phone}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {selectedContact && selectedSite && <div className="border-t border-slate-100" />}
                    {selectedSite && (
                      <div>
                        <p className="text-xs font-bold uppercase text-slate-400 mb-1">Site</p>
                        <p className="text-sm font-semibold text-slate-900">{selectedSite.site_name}</p>
                        <div className="flex items-start gap-1.5 mt-1 text-xs text-slate-500">
                          <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                          <span>{selectedSite.address}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Active Rentals */}
              {customerForklifts.length > 0 && (
                <div className="bg-[var(--surface)] rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-gradient-to-r from-sky-100 to-blue-50 border-b border-sky-200 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-sky-600" />
                    <span className="text-sm font-semibold text-sky-800">Active Rentals ({customerForklifts.length})</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {customerForklifts.map(f => (
                      <div key={f.forklift_id} className={`px-4 py-3 text-sm ${f.forklift_id === formData.forklift_id ? 'bg-blue-50 border-l-2 border-blue-500' : ''}`}>
                        <p className="font-mono font-medium text-slate-800">{f.serial_number}</p>
                        <p className="text-xs text-slate-500">{f.make} {f.model} · {f.hourmeter.toLocaleString()} hrs</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Empty state */
            <div className="bg-[var(--surface)] rounded-xl shadow-sm p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <Building2 className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-500">Select a customer</p>
              <p className="text-xs text-slate-400 mt-1">Customer details and active rentals will appear here</p>
            </div>
          )}
        </div>
      </div>

      <NewCustomerModal
        isOpen={showNewCustomerModal}
        onClose={() => setShowNewCustomerModal(false)}
        onSubmit={handleCreateCustomer}
        initialName={newCustomerNameQuery}
        inputClassName={INPUT_CLASS_NAME}
      />

      {duplicateJobWarning && (
        <DuplicateJobWarningModal
          warning={duplicateJobWarning}
          onConfirm={handleConfirmDuplicateJob}
          onDismiss={handleDismissDuplicateWarning}
        />
      )}
    </div>
  );
};

export default CreateJobPage;
