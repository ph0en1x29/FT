import { ArrowUpRight, Eye, Mail, MapPin, Phone, User } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Customer } from '../../../types';

interface CustomerCardProps {
  customer: Customer;
}

const CustomerCard: React.FC<CustomerCardProps> = ({ customer }) => {
  const navigate = useNavigate();
  const hasFullContact = !!customer.phone && !!customer.email;

  return (
    <div
      className="card-theme rounded-2xl p-5 hover:shadow-theme hover:border-blue-300 transition cursor-pointer group theme-transition"
      onClick={() => navigate(`/customers/${customer.customer_id}`)}
    >
      {/* Customer Name */}
      <div className="flex justify-between items-start gap-3 mb-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${hasFullContact ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {hasFullContact ? 'Contact Ready' : 'Needs Details'}
            </span>
            {customer.account_number && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-medium text-slate-600">
                A/C {customer.account_number}
              </span>
            )}
          </div>
          <h3 className="font-bold text-lg text-theme group-hover:text-blue-600 transition">
            {customer.name}
          </h3>
          <p className="text-xs text-theme-muted mt-0.5">
            ID: {customer.customer_id.slice(0, 8)}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/customers/${customer.customer_id}`);
          }}
          className="p-2 hover:bg-blue-50 rounded-lg transition"
        >
          <Eye className="w-4 h-4 text-blue-600" />
        </button>
      </div>

      {customer.contact_person && (
        <div className="mb-4 rounded-xl bg-blue-50/70 px-3 py-2 text-sm text-blue-700">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span className="font-medium truncate">{customer.contact_person}</span>
          </div>
        </div>
      )}

      {/* Contact Info */}
      <div className="space-y-2 text-sm min-h-[94px]">
        <div className="flex items-start gap-2 text-theme-muted">
          <MapPin className="w-4 h-4 opacity-60 mt-0.5 flex-shrink-0" />
          <span className="line-clamp-2">{customer.address}</span>
        </div>
        
        {customer.phone && (
          <div className="flex items-center gap-2 text-theme-muted">
            <Phone className="w-4 h-4 opacity-60 flex-shrink-0" />
            <a
              href={`tel:${customer.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:text-blue-600 hover:underline"
            >
              {customer.phone}
            </a>
          </div>
        )}
        
        {customer.email && (
          <div className="flex items-center gap-2 text-theme-muted">
            <Mail className="w-4 h-4 opacity-60 flex-shrink-0" />
            <a
              href={`mailto:${customer.email}`}
              onClick={(e) => e.stopPropagation()}
              className="hover:text-blue-600 hover:underline truncate"
            >
              {customer.email}
            </a>
          </div>
        )}
      </div>

      {/* Notes Preview */}
      {customer.notes && (
        <div className="mt-4 rounded-xl border border-theme bg-theme-surface-2 px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-theme-muted mb-1">
            Notes
          </p>
          <p className="text-xs text-theme-muted italic line-clamp-2">
            {customer.notes}
          </p>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-theme pt-4">
        <p className="text-xs text-theme-muted">
          Open profile for jobs, rentals, contacts, and billing context
        </p>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-600">
          Open
          <ArrowUpRight className="w-4 h-4" />
        </span>
      </div>
    </div>
  );
};

export default CustomerCard;
