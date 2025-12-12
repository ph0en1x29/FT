export enum UserRole {
  ADMIN = 'admin',
  TECHNICIAN = 'technician',
  ACCOUNTANT = 'accountant',
}

export enum JobStatus {
  NEW = 'New',
  ASSIGNED = 'Assigned',
  IN_PROGRESS = 'In Progress',
  AWAITING_FINALIZATION = 'Awaiting Finalization',
  COMPLETED = 'Completed',
}

export enum JobPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  EMERGENCY = 'Emergency',
}

export interface User {
  user_id: string;
  name: string;
  role: UserRole;
  email: string;
  password_hash?: string;
  is_active: boolean;
  avatar?: string;
  created_at?: string;
}

export interface Customer {
  customer_id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes?: string;
}

export interface Part {
  part_id: string;
  part_name: string;
  part_code: string;
  category: string;
  cost_price: number;
  sell_price: number;
  warranty_months: number;
  stock_quantity: number;
}

export interface JobPartUsed {
  job_part_id: string;
  job_id: string;
  part_id: string;
  part_name: string;
  quantity: number;
  sell_price_at_time: number;
}

export interface JobMedia {
  media_id: string;
  job_id: string;
  type: 'photo' | 'video';
  url: string;
  description?: string;
  created_at: string;
}

export interface SignatureEntry {
  signed_by_name: string;
  signed_at: string;
  signature_url: string;
}

export interface ExtraCharge {
  charge_id: string;
  job_id: string;
  name: string;
  description: string;
  amount: number;
  created_at: string;
}

export interface Job {
  job_id: string;
  customer_id: string;
  customer: Customer;
  title: string;
  description: string;
  priority: JobPriority;
  status: JobStatus;
  assigned_technician_id: string;
  assigned_technician_name?: string;
  created_at: string;
  scheduled_date?: string;
  arrival_time?: string;
  completion_time?: string;
  notes: string[];
  
  // Signatures
  technician_signature?: SignatureEntry;
  customer_signature?: SignatureEntry;

  parts_used: JobPartUsed[];
  media: JobMedia[];
  
  // Pricing
  labor_cost?: number;
  extra_charges?: ExtraCharge[];
  
  // NEW: Invoice tracking
  invoiced_by_id?: string;
  invoiced_by_name?: string;
  invoiced_at?: string;
  invoice_sent_at?: string;
  invoice_sent_via?: string[]; // ['email', 'whatsapp']
}