import { ChevronLeft, ChevronRight, Plus, Search, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SkeletonGrid } from '../../components/Skeleton';
import { getCustomersPage } from '../../services/customerService';
import { createCustomer } from '../../services/customerService';
import { showToast } from '../../services/toastService';
import { Customer } from '../../types';
import { CreateCustomerModal, CustomerCard } from './components';

const PAGE_SIZE = 50;

const Customers: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

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

  // Debounce search query (250ms)
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['customers', 'page', debouncedSearchQuery, currentPage, PAGE_SIZE],
    queryFn: () => getCustomersPage({
      searchQuery: debouncedSearchQuery,
      page: currentPage,
      pageSize: PAGE_SIZE,
    }),
    staleTime: 60 * 1000,
    placeholderData: previousData => previousData,
  });

  const customers = data?.customers ?? [];
  const totalCount = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const handleCreateCustomer = async () => {
    if (!newCustomer.name.trim() || !newCustomer.address.trim()) {
      showToast.warning('Missing required fields', 'Please enter at least a name and address');
      return;
    }

    setCreating(true);
    try {
      const created = await createCustomer({
        name: newCustomer.name.trim(),
        address: newCustomer.address.trim(),
        phone: newCustomer.phone.trim(),
        email: newCustomer.email.trim(),
        notes: newCustomer.notes.trim()
      });

      await queryClient.invalidateQueries({ queryKey: ['customers', 'page'] });
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

  const closeModal = () => {
    setShowCreateModal(false);
    setNewCustomer({ name: '', address: '', phone: '', email: '', notes: '' });
  };

  const rangeStart = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, totalCount);

  return (
    <div className="space-y-6 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-lg md:text-xl lg:text-2xl font-bold text-theme">Customers</h1>
          <p className="text-theme-muted text-xs md:text-sm">View customer profiles and service history</p>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="card-theme px-3 md:px-4 py-2 rounded-lg theme-transition">
            <div className="flex items-center gap-2 text-theme-muted">
              <Users className="w-4 md:w-5 h-4 md:h-5" />
              <span className="font-bold text-theme">{totalCount}</span>
              <span className="text-xs md:text-sm hidden sm:inline">Total Customers</span>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-3 md:px-4 py-2 rounded-lg font-semibold shadow hover:bg-blue-700 flex items-center gap-2 text-sm md:text-base"
          >
            <Plus className="w-5 h-5" /> <span className="hidden sm:inline">New Customer</span><span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-muted" />
        <input
          type="text"
          placeholder="Search by name, phone, address, email, account no., agent..."
          className="w-full pl-10 pr-4 py-3 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-theme placeholder-slate-400 theme-transition"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {isFetching && !isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {!isLoading && totalCount > 0 && (
        <div className="flex items-center justify-between text-sm text-theme-muted">
          <p>{rangeStart}-{rangeEnd} of {totalCount} customers</p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2 text-xs text-theme-muted">
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={!canGoPrev}
                className="inline-flex items-center gap-1 rounded-lg border border-theme px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3 h-3" />
                Prev
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={!canGoNext}
                className="inline-flex items-center gap-1 rounded-lg border border-theme px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Customers Grid */}
      {isLoading ? (
        <SkeletonGrid count={6} columns={3} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map(customer => (
            <CustomerCard key={customer.customer_id} customer={customer} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && customers.length === 0 && (
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
        <CreateCustomerModal
          newCustomer={newCustomer}
          setNewCustomer={setNewCustomer}
          onClose={closeModal}
          onCreate={handleCreateCustomer}
          creating={creating}
        />
      )}
    </div>
  );
};

export default Customers;
