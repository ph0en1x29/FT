import { CheckCircle, XCircle, Clock, X } from 'lucide-react';
import { AutoCountExportStatus } from '../../types';
import { StatusConfig } from './types';

export const STATUS_CONFIG: Record<AutoCountExportStatus, StatusConfig> = {
  pending: {
    label: 'Pending',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    icon: Clock,
  },
  exported: {
    label: 'Exported',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    icon: CheckCircle,
  },
  failed: {
    label: 'Failed',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    icon: XCircle,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-slate-500',
    bgColor: 'bg-slate-50',
    icon: X,
  },
};
