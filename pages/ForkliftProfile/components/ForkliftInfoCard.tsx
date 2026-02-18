import { Calendar,Gauge,MapPin,Package,Truck } from 'lucide-react';
import React from 'react';
import { Forklift } from '../../../types';
import { getStatusBadge } from '../utils';

interface ForkliftInfoCardProps {
  forklift: Forklift;
  hasActiveRental: boolean;
  stats: {
    totalServices: number;
    completedServices: number;
    totalPartsUsed: number;
    totalRentalRevenue: number;
  };
}

export const ForkliftInfoCard: React.FC<ForkliftInfoCardProps> = ({
  forklift,
  hasActiveRental,
  stats,
}) => {
  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm p-6 border border-blue-100">
      <div className="flex justify-between items-start">
        {/* Left Side - Info */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Truck className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{forklift.make} {forklift.model}</h2>
              <p className="text-sm text-slate-500">S/N: {forklift.serial_number}</p>
            </div>
          </div>
          
          {/* Tags / Badges */}
          <div className="flex flex-wrap gap-2 items-center">
            {hasActiveRental ? (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
                🔴 Rented Out
              </span>
            ) : (
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(forklift.status)}`}>
                {forklift.status}
              </span>
            )}
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-700">
              {forklift.type}
            </span>
            {forklift.forklift_no && (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                {forklift.forklift_no}
              </span>
            )}
          </div>

          {/* Key Fields */}
          <div className="space-y-2 text-slate-700">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-blue-600" />
              <span>{forklift.hourmeter.toLocaleString()} hours</span>
            </div>
            {forklift.year && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>Year: {forklift.year}</span>
              </div>
            )}
            {forklift.capacity_kg && (
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                <span>Capacity: {forklift.capacity_kg.toLocaleString()} kg</span>
              </div>
            )}
            {forklift.location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>{forklift.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - KPI Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[var(--surface)] rounded-lg p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-blue-600">{stats.totalServices}</p>
            <p className="text-xs text-slate-500">Total Services</p>
          </div>
          <div className="bg-[var(--surface)] rounded-lg p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-green-600">{stats.completedServices}</p>
            <p className="text-xs text-slate-500">Completed</p>
          </div>
          <div className="bg-[var(--surface)] rounded-lg p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-purple-600">{stats.totalPartsUsed}</p>
            <p className="text-xs text-slate-500">Parts Used</p>
          </div>
          <div className="bg-[var(--surface)] rounded-lg p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-amber-600">RM{stats.totalRentalRevenue.toLocaleString()}</p>
            <p className="text-xs text-slate-500">Rental Revenue</p>
          </div>
        </div>
      </div>
    </div>
  );
};
