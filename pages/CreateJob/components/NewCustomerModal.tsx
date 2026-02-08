import { X } from 'lucide-react';
import React,{ useEffect,useState } from 'react';
import { NewCustomerFormData,NewCustomerModalProps } from '../types';

/**
 * Modal for creating a new customer during job creation.
 * Pre-populates name from search query when user clicks "Create New Customer".
 */
const NewCustomerModal: React.FC<NewCustomerModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialName = '',
  inputClassName
}) => {
  const [newCustomer, setNewCustomer] = useState<NewCustomerFormData>({
    name: '',
    phone: '',
    email: '',
    address: ''
  });

  // Update name when initialName changes (from search query)
  useEffect(() => {
    if (initialName) {
      setNewCustomer(prev => ({ ...prev, name: initialName }));
    }
  }, [initialName]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setNewCustomer({ name: '', phone: '', email: '', address: '' });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name) return;
    await onSubmit(newCustomer);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800">Add New Customer</h3>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label>
            <input 
              type="text" 
              className={inputClassName}
              value={newCustomer.name}
              onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
            <input 
              type="tel" 
              className={inputClassName}
              value={newCustomer.phone}
              onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
            <input 
              type="email" 
              className={inputClassName}
              value={newCustomer.email}
              onChange={e => setNewCustomer({...newCustomer, email: e.target.value})}
              placeholder="client@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Address</label>
            <input 
              type="text" 
              className={inputClassName}
              value={newCustomer.address}
              onChange={e => setNewCustomer({...newCustomer, address: e.target.value})}
              placeholder="123 Main St, City"
            />
          </div>

          {/* Actions */}
          <div className="pt-4 flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm"
            >
              Save Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewCustomerModal;
