import React from 'react';
import { Forklift,JobPriority,JobType,User } from '../../types';

export interface CreateJobFormData {
  customer_id: string;
  title: string;
  description: string;
  priority: JobPriority;
  job_type: JobType;
  assigned_technician_id: string;
  forklift_id: string;
  hourmeter_reading: string;
  contact_id: string;
  site_id: string;
  billing_type: 'rental-inclusive' | 'chargeable';
  /**
   * ACWER service flow Phase 1 — auto-classified path (Path A/B/C).
   * Read-only from the form's perspective: derived in `useCreateJobForm` from
   * the selected forklift's ownership + the customer's active service contracts.
   * 'unset' until enough data is selected to classify.
   */
  billing_path: 'amc' | 'chargeable' | 'fleet' | 'unset';
  billing_path_reason: string;
  /**
   * ISO-8601 string representing 07:30 Malaysia Time on the scheduled calendar day.
   * Empty string = no schedule (job sits in the "unscheduled" backlog).
   * When set, a reminder notification is sent to the assigned technician at the
   * stored time via the send_scheduled_job_reminders() cron function.
   */
  scheduled_date: string;
}

export interface DuplicateJobWarning {
  job_id: string;
  title: string;
  status: string;
  customer_name: string | null;
  site_name: string | null;
}

export interface NewCustomerFormData {
  name: string;
  phone: string;
  email: string;
  address: string;
}

export interface CreateJobPageProps {
  currentUser: User;
}

export interface NewCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (customer: NewCustomerFormData) => Promise<void>;
  initialName?: string;
  inputClassName: string;
}

export interface ForkliftSelectionSectionProps {
  formData: CreateJobFormData;
  setFormData: React.Dispatch<React.SetStateAction<CreateJobFormData>>;
  forklifts: Forklift[];
  selectedForklift: Forklift | null;
  inputClassName: string;
}
