import React from 'react';
import { CustomerKPIStripProps } from '../types';

const CustomerKPIStrip: React.FC<CustomerKPIStripProps> = ({
  totalJobs,
  activeRentalsCount,
  activeContractsCount,
  totalServiceRevenue,
  totalRentalRevenue,
  totalRevenue,
}) => {
  const totalAgreements = activeRentalsCount + activeContractsCount;

  // Build a subtitle showing the breakdown when both types exist
  const agreementSubtitle =
    activeRentalsCount > 0 && activeContractsCount > 0
      ? `${activeRentalsCount} rental${activeRentalsCount !== 1 ? 's' : ''} · ${activeContractsCount} contract${activeContractsCount !== 1 ? 's' : ''}`
      : activeContractsCount > 0
        ? `${activeContractsCount} service contract${activeContractsCount !== 1 ? 's' : ''}`
        : activeRentalsCount > 0
          ? `${activeRentalsCount} rental${activeRentalsCount !== 1 ? 's' : ''}`
          : null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <div className="bg-[var(--surface)] rounded-lg p-4 shadow-sm border border-slate-200">
        <p className="text-xs text-slate-500 uppercase font-medium">Total Jobs</p>
        <p className="text-2xl font-bold text-blue-600">{totalJobs}</p>
      </div>
      <div className="bg-[var(--surface)] rounded-lg p-4 shadow-sm border border-slate-200">
        <p className="text-xs text-slate-500 uppercase font-medium">Active Agreements</p>
        <p className="text-2xl font-bold text-purple-600">{totalAgreements}</p>
        {agreementSubtitle && (
          <p className="text-[10px] text-slate-400 mt-0.5">{agreementSubtitle}</p>
        )}
      </div>
      <div className="bg-[var(--surface)] rounded-lg p-4 shadow-sm border border-slate-200">
        <p className="text-xs text-slate-500 uppercase font-medium">Service Revenue</p>
        <p className="text-2xl font-bold text-green-600">RM{totalServiceRevenue.toLocaleString()}</p>
      </div>
      <div className="bg-[var(--surface)] rounded-lg p-4 shadow-sm border border-slate-200">
        <p className="text-xs text-slate-500 uppercase font-medium">Rental Revenue</p>
        <p className="text-2xl font-bold text-amber-600">RM{totalRentalRevenue.toLocaleString()}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">from forklift rentals</p>
      </div>
      <div className="bg-[var(--surface)] rounded-lg p-4 shadow-sm border border-slate-200 col-span-2 md:col-span-1">
        <p className="text-xs text-slate-500 uppercase font-medium">Total Revenue</p>
        <p className="text-2xl font-bold text-slate-800">RM{totalRevenue.toLocaleString()}</p>
      </div>
    </div>
  );
};

export default CustomerKPIStrip;
