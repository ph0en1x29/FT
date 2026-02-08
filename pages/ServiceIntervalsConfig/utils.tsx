import { Battery,Flame,Fuel,Wrench } from 'lucide-react';
import React from 'react';

export const getTypeIcon = (type: string): React.ReactNode => {
  switch (type) {
    case 'Diesel':
      return <Fuel className="w-4 h-4 text-amber-400" />;
    case 'Electric':
      return <Battery className="w-4 h-4 text-green-400" />;
    case 'LPG':
      return <Flame className="w-4 h-4 text-orange-400" />;
    default:
      return <Wrench className="w-4 h-4 text-slate-400" />;
  }
};

export const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'Emergency':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'High':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'Medium':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'Low':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
};
