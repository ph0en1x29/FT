import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Customer } from '../../../types';
import { MapPin, Phone, Mail, Eye } from 'lucide-react';

interface CustomerCardProps {
  customer: Customer;
}

const CustomerCard: React.FC<CustomerCardProps> = ({ customer }) => {
  const navigate = useNavigate();

  return (
    <div
      className="card-theme rounded-xl p-5 hover:shadow-theme hover:border-blue-300 transition cursor-pointer group theme-transition"
      onClick={() => navigate(`/customers/${customer.customer_id}`)}
    >
      {/* Customer Name */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
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

      {/* Contact Info */}
      <div className="space-y-2 text-sm">
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
        <div className="mt-4 pt-4 border-t border-theme">
          <p className="text-xs text-theme-muted italic line-clamp-2">
            {customer.notes}
          </p>
        </div>
      )}
    </div>
  );
};

export default CustomerCard;
