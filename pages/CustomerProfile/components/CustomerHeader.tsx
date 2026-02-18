import { ArrowLeft,Briefcase,Edit2,Mail,MapPin,Phone,Trash2,Truck } from 'lucide-react';
import React from 'react';
import { CustomerHeaderProps } from '../types';

const CustomerHeader: React.FC<CustomerHeaderProps> = ({
  customer,
  isAdmin,
  isSupervisor,
  onNavigateBack,
  onRentForklift,
  onCreateJob,
  onEditCustomer,
  onDeleteCustomer,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-3 md:p-5 border border-slate-200">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Customer Info */}
        <div className="flex items-start gap-4">
          <button onClick={onNavigateBack} className="p-2 hover:bg-slate-100 rounded-full mt-1">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-slate-900">{customer.name}</h1>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded font-mono">
                {customer.customer_id.slice(0, 8)}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-slate-600">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {customer.address}
              </span>
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <a href={`tel:${customer.phone}`} className="hover:underline">{customer.phone}</a>
              </span>
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <a href={`mailto:${customer.email}`} className="hover:underline">{customer.email}</a>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onRentForklift}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium shadow-sm"
          >
            <Truck className="w-4 h-4" />
            Rent Forklift
          </button>
          {(isAdmin || isSupervisor) && (
            <button
              onClick={onCreateJob}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm"
            >
              <Briefcase className="w-4 h-4" />
              Create Job
            </button>
          )}
          <button
            onClick={onEditCustomer}
            className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 text-sm font-medium"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
          {isAdmin && (
            <button 
              onClick={onDeleteCustomer}
              className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerHeader;
