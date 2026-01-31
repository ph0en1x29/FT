import React from 'react';
import { CustomerKPIStripProps } from '../types';

const CustomerKPIStrip: React.FC<CustomerKPIStripProps> = ({
  totalJobs,
  activeRentalsCount,
  totalServiceRevenue,
  totalRentalRevenue,
  totalRevenue,
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
        <p className="text-xs text-slate-500 uppercase font-medium">Total Jobs</p>
        <p className="text-2xl font-bold text-blue-600">{totalJobs}</p>
      </div>
      <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
        <p className="text-xs text-slate-500 uppercase font-medium">Active Rentals</p>
        <p className="text-2xl font-bold text-purple-600">{activeRentalsCount}</p>
      </div>
      <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
        <p className="text-xs text-slate-500 uppercase font-medium">Service Revenue</p>
        <p className="text-2xl font-bold text-green-600">RM{totalServiceRevenue.toLocaleString()}</p>
      </div>
      <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
        <p className="text-xs text-slate-500 uppercase font-medium">Rental Revenue</p>
        <p className="text-2xl font-bold text-amber-600">RM{totalRentalRevenue.toLocaleString()}</p>
      </div>
      <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200 col-span-2 md:col-span-1">
        <p className="text-xs text-slate-500 uppercase font-medium">Total Revenue</p>
        <p className="text-2xl font-bold text-slate-800">RM{totalRevenue.toLocaleString()}</p>
      </div>
    </div>
  );
};

export default CustomerKPIStrip;
