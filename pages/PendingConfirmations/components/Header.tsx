import React from 'react';
import { RefreshCw } from 'lucide-react';
import { HeaderProps } from '../types';

export function Header({ loading, onRefresh }: HeaderProps) {
  return (
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-2xl font-bold text-theme">Pending Confirmations</h1>
        <p className="text-theme-muted text-sm mt-1">
          Dual admin confirmation workflow for completed jobs
        </p>
      </div>
      <button
        onClick={onRefresh}
        className="btn-premium btn-premium-secondary"
        disabled={loading}
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        Refresh
      </button>
    </div>
  );
}
