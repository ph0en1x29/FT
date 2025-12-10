export enum UserRole {
  ADMIN = 'admin',
  TECHNICIAN = 'technician',
  ACCOUNTANT = 'accountant',
}

export enum JobStatus {
  NEW = 'New',
  ASSIGNED = 'Assigned',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
  INVOICED = 'Invoiced',
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
  password_hash?: string; // Simulated hash
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
  signed_at: string; // ISO Timestamp
  signature_url: string; // Data URL
}

export interface Job {
  job_id: string;
  customer_id: string;
  customer: Customer; // Hydrated for ease
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
  
  // Updated Signatures
  technician_signature?: SignatureEntry;
  customer_signature?: SignatureEntry;

  parts_used: JobPartUsed[];
  media: JobMedia[];
}