import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Customer } from '../types';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { showToast } from '../services/toastService';
import { MapPin, Phone, Mail, Users, Search, Eye, Plus, X } from 'lucide-react';
import { SkeletonGrid, Skeleton } from '../components/Skeleton';

const Customers: React.FC = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create customer modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    notes: ''
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await MockDb.getCustomers();
      setCustomers(data);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateCustomer = async () => {
    if (!newCustomer.name.trim() || !newCustomer.address.trim()) {
      showToast.warning('Missing required fields', 'Please enter at least a name and address');
      return;
    }

    setCreating(true);
    try {
      const created = await MockDb.createCustomer({
        name: newCustomer.name.trim(),
        address: newCustomer.address.trim(),
        phone: newCustomer.phone.trim(),
        email: newCustomer.email.trim(),
        notes: newCustomer.notes.trim()
      });
      
      setCustomers([...customers, created]);
      setShowCreateModal(false);
      setNewCustomer({ name: '', address: '', phone: '', email: '', notes: '' });
      showToast.success('Customer created successfully');
      
      // Navigate to the new customer profile
      navigate(`/customers/${created.customer_id}`);
    } catch (e) {
      showToast.error('Failed to create customer', (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const inputClassName = "w-full px-3 py-2.5 bg-[#f5f5f5] text-[#111827] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/25 placeholder-slate-400 transition-all duration-200";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-theme">Customers</h1>
          <p className="text-theme-muted text-sm">View customer profiles and service history</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="card-theme px-4 py-2 rounded-lg theme-transition">
            <div className="flex items-center gap-2 text-theme-muted">
              <Users className="w-5 h-5" />
              <span className="font-bold text-theme">{customers.length}</span>
              <span className="text-sm">Total Customers</span>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold shadow hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> New Customer
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-muted" />
        <input
          type="text"
          placeholder="Search by name, address, or email..."
          className="w-full pl-10 pr-4 py-3 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-theme placeholder-slate-400 theme-transition"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Customers Grid */}
      {loading ? (
        <SkeletonGrid count={6} columns={3} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map(customer => (
            <div
              key={customer.customer_id}
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
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredCustomers.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-16 h-16 mx-auto text-theme-muted opacity-30 mb-4" />
          <p className="text-theme-muted mb-2">
            {searchQuery ? 'No customers match your search' : 'No customers yet'}
          </p>
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="text-blue-600 hover:underline text-sm"
            >
              Clear search
            </button>
          ) : (
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-blue-600 hover:underline text-sm"
            >
              Create your first customer
            </button>
          )}
        </div>
      )}

      {/* Create Customer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-lg text-slate-900">New Customer</h4>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewCustomer({ name: '', address: '', phone: '', email: '', notes: '' });
                }}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Name *</label>
                <input
                  type="text"
                  className={inputClassName}
                  placeholder="Customer name"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  autoComplete="off"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Address *</label>
                <input
                  type="text"
                  className={inputClassName}
                  placeholder="Full address"
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  autoComplete="off"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Phone</label>
                <input
                  type="tel"
                  className={inputClassName}
                  placeholder="Phone number"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  autoComplete="off"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Email</label>
                <input
                  type="email"
                  className={inputClassName}
                  placeholder="Email address"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  autoComplete="off"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Notes</label>
                <textarea
                  className={`${inputClassName} resize-none`}
                  placeholder="Any additional notes..."
                  rows={3}
                  value={newCustomer.notes}
                  onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewCustomer({ name: '', address: '', phone: '', email: '', notes: '' });
                }}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateCustomer}
                disabled={creating}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;