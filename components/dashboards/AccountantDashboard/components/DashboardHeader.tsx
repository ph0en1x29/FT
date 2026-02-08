/**
 * Dashboard header with greeting and view invoices button
 */
import { Receipt } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../../../../types';

interface DashboardHeaderProps {
  currentUser: User;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const today = new Date();

  const getGreeting = () => {
    const hour = today.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">
          {getGreeting()}, {currentUser.name.split(' ')[0]}
        </h1>
        <p className="text-sm mt-1 text-[var(--text-muted)]">
          {today.toLocaleDateString('en-MY', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </p>
      </div>
      <button
        onClick={() => navigate('/invoices')}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105"
        style={{ background: 'var(--accent)', color: 'white' }}
      >
        <Receipt className="w-4 h-4" /> View Invoices
      </button>
    </div>
  );
};
