import { Job,User } from '../../types';

/**
 * Extended Job type with helper assignment flag (added at runtime by jobService)
 */
export interface JobWithHelperFlag extends Job {
  _isHelperAssignment?: boolean;
  is_escalated?: boolean;
  escalation_acknowledged_at?: string | null;
}

/**
 * Props for the JobBoard component
 */
export interface JobBoardProps {
  currentUser: User;
  hideHeader?: boolean;
}

/**
 * Date range filter options
 */
export type DateFilter = 'today' | 'unfinished' | 'week' | 'month' | 'all' | 'custom';

/**
 * Special filter options (from URL params like ?filter=overdue)
 */
export type SpecialFilter = 'overdue' | 'unassigned' | 'escalated' | 'awaiting-ack' | null;

/**
 * Response time remaining state
 */
export interface ResponseTimeState {
  text: string;
  isExpired: boolean;
  urgency: 'ok' | 'warning' | 'critical';
}

/**
 * Job status counts for quick stats
 */
export interface StatusCounts {
  total: number;
  new: number;
  assigned: number;
  inProgress: number;
  awaiting: number;
  completed: number;
  awaitingAck: number;
  disputed: number;
  incompleteContinuing: number;
  incompleteReassigned: number;
  slotInPendingAck: number;
}
