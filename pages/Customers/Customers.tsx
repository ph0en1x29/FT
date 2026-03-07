import { Plus,Search,Users } from 'lucide-react';
import React,{ useEffect,useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SkeletonGrid } from '../../components/Skeleton';
import { SupabaseDb as MockDb } from '../../services/supabaseService';
import { showToast } from '../../services/toastService';
import { Customer } from '../../types';
import { CreateCustomerModal,CustomerCard } from './components';

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
    } catch (_error) {
      /* Silently ignore */
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

  const closeModal = () => {
    setShowCreateModal(false);
    setNewCustomer({ name: '', address: '', phone: '', email: '', notes: '' });
  };

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
              <span className="font-bold text-theme">{customers.length}</span>
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
            <CustomerCard key={customer.customer_id} customer={customer} />
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
