import { JobPriority, JobType, Customer, User, Forklift } from '../../types';

export interface CreateJobFormData {
  customer_id: string;
  title: string;
  description: string;
  priority: JobPriority;
  job_type: JobType;
  assigned_technician_id: string;
  forklift_id: string;
  hourmeter_reading: string;
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
