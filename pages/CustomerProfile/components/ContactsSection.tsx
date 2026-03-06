import { Pencil, Plus, Star, Trash2, User } from 'lucide-react';
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCustomerContacts, deleteCustomerContact } from '../../../services/customerService';
import type { CustomerContact } from '../../../types';
import AddEditContactModal from './AddEditContactModal';

interface ContactsSectionProps {
  customerId: string;
}

const ContactsSection: React.FC<ContactsSectionProps> = ({ customerId }) => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(null);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['customer-contacts', customerId],
    queryFn: () => getCustomerContacts(customerId),
  });

  const handleDelete = async (contactId: string, name: string) => {
    if (!confirm(`Delete contact "${name}"? This action cannot be undone.`)) return;
    
    try {
      await deleteCustomerContact(contactId);
      queryClient.invalidateQueries({ queryKey: ['customer-contacts', customerId] });
    } catch (error) {
      alert('Failed to delete contact: ' + (error as Error).message);
    }
  };

  const handleEdit = (contact: CustomerContact) => {
    setEditingContact(contact);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingContact(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingContact(null);
  };

  if (isLoading) {
    return (
      <div className="bg-[var(--surface)] rounded-xl shadow-sm border border-slate-200 p-4">
        <p className="text-sm text-slate-500">Loading contacts...</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-[var(--surface)] rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-600" />
            <h3 className="text-xs font-bold uppercase text-[var(--text-muted)]">Contacts</h3>
            <span className="text-xs text-slate-500">({contacts.length})</span>
          </div>
          <button
            onClick={handleAdd}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
          {contacts.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No contacts added</p>
              <p className="text-xs mt-1">Add a contact person to get started</p>
            </div>
          ) : (
            contacts.map((contact) => (
              <div
                key={contact.contact_id}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="font-semibold text-slate-800 text-sm truncate">
                      {contact.name}
                    </span>
                    {contact.is_primary && (
                      <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => handleEdit(contact)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit contact"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(contact.contact_id, contact.name)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete contact"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {contact.role && (
                  <p className="text-xs text-[var(--text-muted)] mb-2">{contact.role}</p>
                )}

                <div className="space-y-1">
                  {contact.phone && (
                    <p className="text-xs text-slate-600">
                      <span className="font-medium">Phone:</span> {contact.phone}
                    </p>
                  )}
                  {contact.email && (
                    <p className="text-xs text-slate-600">
                      <span className="font-medium">Email:</span> {contact.email}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showModal && (
        <AddEditContactModal
          customerId={customerId}
          contact={editingContact}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
};

export default ContactsSection;
