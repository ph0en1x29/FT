/**
 * Quick action buttons for accountant dashboard
 */
import { AlertCircle,DollarSign,FileText,Receipt } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

export const AccountantQuickActions: React.FC = () => {
  const navigate = useNavigate();

  const actions = [
    {
      label: 'Invoices',
      subtitle: 'Manage billing',
      icon: Receipt,
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-100',
      onClick: () => navigate('/invoices'),
    },
    {
      label: 'All Jobs',
      subtitle: 'View job list',
      icon: FileText,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-100',
      onClick: () => navigate('/jobs'),
    },
    {
      label: 'Customers',
      subtitle: 'View accounts',
      icon: DollarSign,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-100',
      onClick: () => navigate('/customers'),
    },
    {
      label: 'Assets',
      subtitle: 'View fleet',
      icon: AlertCircle,
      iconColor: 'text-orange-600',
      bgColor: 'bg-orange-100',
      onClick: () => navigate('/forklifts'),
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={action.onClick}
          className="card-premium p-4 flex items-center gap-3 hover:shadow-lg transition-all text-left"
        >
          <div
            className={`w-10 h-10 rounded-xl ${action.bgColor} flex items-center justify-center`}
          >
            <action.icon className={`w-5 h-5 ${action.iconColor}`} />
          </div>
          <div>
            <p className="font-medium text-[var(--text)]">{action.label}</p>
            <p className="text-xs text-[var(--text-muted)]">{action.subtitle}</p>
          </div>
        </button>
      ))}
    </div>
  );
};
