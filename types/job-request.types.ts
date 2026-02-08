// =============================================
// JOB REQUEST TYPES
// =============================================

import type { Part } from './inventory.types';
import type { User } from './user.types';

// Job Request Types (for In-Job Request System)
export type JobRequestType = 'assistance' | 'spare_part' | 'skillful_technician';
export type JobRequestStatus = 'pending' | 'approved' | 'rejected';

export interface JobRequest {
  request_id: string;
  job_id: string;
  request_type: JobRequestType;
  requested_by: string;
  requested_by_user?: User; // Populated on fetch
  description: string;
  photo_url?: string;
  status: JobRequestStatus;
  admin_response_notes?: string;
  admin_response_part_id?: string;
  admin_response_part?: Part; // Populated on fetch
  admin_response_quantity?: number;
  responded_by?: string;
  responded_by_user?: User; // Populated on fetch
  responded_at?: string;
  created_at: string;
  updated_at: string;
}
