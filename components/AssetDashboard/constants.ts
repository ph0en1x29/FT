import {
AlertTriangle,
Building2,
CalendarClock,
CheckCircle,
Package,
Wrench,
XCircle
} from 'lucide-react';
import { OperationalStatus,StatusConfig } from './types';

export const STATUS_CONFIG: Record<OperationalStatus, StatusConfig> = {
  out_of_service: {
    label: 'Out of Service',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: XCircle,
    description: 'Decommissioned or major repair'
  },
  rented_out: {
    label: 'Rented Out',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: Building2,
    description: 'Currently with customers'
  },
  in_service: {
    label: 'In Service',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: Wrench,
    description: 'Under maintenance/repair'
  },
  service_due: {
    label: 'Service Due',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: AlertTriangle,
    description: 'Due within 7 days or 50 hours'
  },
  awaiting_parts: {
    label: 'Awaiting Parts',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    icon: Package,
    description: 'Waiting for parts to complete repair'
  },
  reserved: {
    label: 'Reserved',
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    icon: CalendarClock,
    description: 'Reserved for upcoming rental/job'
  },
  available: {
    label: 'Available',
    color: 'text-slate-700',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    icon: CheckCircle,
    description: 'Ready for rental'
  }
};

/** Primary statuses shown in the main card row */
export const PRIMARY_STATUSES: OperationalStatus[] = [
  'rented_out', 'in_service', 'service_due', 'available', 'out_of_service'
];

/** Secondary statuses (only shown when count > 0) */
export const SECONDARY_STATUSES: OperationalStatus[] = ['awaiting_parts', 'reserved'];
