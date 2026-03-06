import { Building2, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCustomerSites, deleteCustomerSite } from '../../../services/customerService';
import type { CustomerSite } from '../../../types';
import AddEditSiteModal from './AddEditSiteModal';

interface SitesSectionProps {
  customerId: string;
}

const SitesSection: React.FC<SitesSectionProps> = ({ customerId }) => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingSite, setEditingSite] = useState<CustomerSite | null>(null);

  const { data: sites = [], isLoading } = useQuery({
    queryKey: ['customer-sites', customerId],
    queryFn: () => getCustomerSites(customerId),
  });

  const handleDelete = async (siteId: string, siteName: string) => {
    if (!confirm(`Delete site "${siteName}"? This action cannot be undone.`)) return;
    
    try {
      await deleteCustomerSite(siteId);
      queryClient.invalidateQueries({ queryKey: ['customer-sites', customerId] });
    } catch (error) {
      alert('Failed to delete site: ' + (error as Error).message);
    }
  };

  const handleEdit = (site: CustomerSite) => {
    setEditingSite(site);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingSite(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSite(null);
  };

  if (isLoading) {
    return (
      <div className="bg-[var(--surface)] rounded-xl shadow-sm border border-slate-200 p-4">
        <p className="text-sm text-slate-500">Loading sites...</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-[var(--surface)] rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-600" />
            <h3 className="text-xs font-bold uppercase text-[var(--text-muted)]">Sites</h3>
            <span className="text-xs text-slate-500">({sites.length})</span>
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
          {sites.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <MapPin className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No sites added</p>
              <p className="text-xs mt-1">Add a site location to get started</p>
            </div>
          ) : (
            sites.map((site) => (
              <div
                key={site.site_id}
                className={`rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 hover:border-slate-300 transition-colors ${
                  !site.is_active ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`font-semibold text-sm truncate ${
                      site.is_active ? 'text-slate-800' : 'text-slate-500'
                    }`}>
                      {site.site_name}
                    </span>
                    {!site.is_active && (
                      <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full flex-shrink-0">
                        Inactive
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => handleEdit(site)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit site"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(site.site_id, site.site_name)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete site"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-1.5 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-slate-600 leading-relaxed">{site.address}</p>
                </div>

                {site.notes && (
                  <p className="text-xs text-slate-500 italic mt-2 pt-2 border-t border-slate-100">
                    {site.notes}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {showModal && (
        <AddEditSiteModal
          customerId={customerId}
          site={editingSite}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
};

export default SitesSection;
