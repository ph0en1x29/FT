/**
 * ContractsSection — service contracts list on CustomerProfilePage (Phase 2).
 *
 * Shows all contracts for the current customer (active and inactive), each
 * with a chip indicating whether it's currently active in time, and a small
 * action set (edit / deactivate). Admin-only — gates on currentUser.role.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, FileText, Pencil, Plus, ShieldOff } from 'lucide-react';
import React, { useState } from 'react';

import {
  deactivateContract,
  getContractsForCustomer,
} from '../../../services/serviceContractService';
import { showToast } from '../../../services/toastService';
import type { ServiceContract, User } from '../../../types';
import AddEditContractModal from './AddEditContractModal';

interface Props {
  customerId: string;
  currentUser: User;
}

const formatDate = (s?: string | null) => (s ? s.slice(0, 10) : '—');

const isCurrentlyActive = (c: ServiceContract): boolean => {
  if (!c.is_active) return false;
  const today = new Date();
  return new Date(c.start_date) <= today && new Date(c.end_date) >= today;
};

const ContractsSection: React.FC<Props> = ({ customerId, currentUser }) => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ServiceContract | null>(null);

  const role = currentUser.role.toString().toLowerCase();
  const canManage = role === 'admin' || role === 'admin_service' || role === 'supervisor';

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['service-contracts', customerId],
    queryFn: () => getContractsForCustomer(customerId),
    enabled: !!customerId,
  });

  const handleAdd = () => {
    setEditing(null);
    setShowModal(true);
  };

  const handleEdit = (c: ServiceContract) => {
    setEditing(c);
    setShowModal(true);
  };

  const handleDeactivate = async (c: ServiceContract) => {
    if (!confirm(`Deactivate contract ${c.contract_number ?? c.contract_id}? Existing jobs keep their classification; new jobs will not classify under this contract.`)) {
      return;
    }
    try {
      await deactivateContract(c.contract_id, currentUser.user_id, currentUser.name);
      showToast.success('Contract deactivated');
      queryClient.invalidateQueries({ queryKey: ['service-contracts', customerId] });
    } catch (err) {
      showToast.error('Failed to deactivate contract', (err as Error).message);
    }
  };

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['service-contracts', customerId] });
  };

  return (
    <>
      <div className="bg-[var(--surface)] rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold inline-flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Service contracts
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 font-normal">
              {contracts.length}
            </span>
          </h3>
          {canManage && (
            <button
              onClick={handleAdd}
              className="text-sm px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add contract
            </button>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-[var(--text-muted)]">Loading…</p>
        ) : contracts.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            No service contracts on file. Customer-owned forklifts will classify as Path B (Chargeable) until a contract is added.
          </p>
        ) : (
          <ul className="space-y-2">
            {contracts.map(c => {
              const live = isCurrentlyActive(c);
              const coverage = (!c.covered_forklift_ids || c.covered_forklift_ids.length === 0)
                ? 'All customer\'s forklifts'
                : `${c.covered_forklift_ids.length} forklift${c.covered_forklift_ids.length === 1 ? '' : 's'}`;
              return (
                <li
                  key={c.contract_id}
                  className={`border rounded-lg p-3 ${live ? 'border-emerald-200 bg-emerald-50/30 dark:bg-emerald-900/10' : 'border-[var(--border)] bg-[var(--bg-subtle)]'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[var(--text)] text-sm">
                          {c.contract_number ?? `(no contract number)`}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] uppercase font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          {c.contract_type}
                        </span>
                        {live ? (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            Active
                          </span>
                        ) : !c.is_active ? (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                            Deactivated
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                            Out of date range
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {formatDate(c.start_date)} → {formatDate(c.end_date)}
                        </span>
                        <span>·</span>
                        <span>{coverage}</span>
                        {!c.includes_parts && (
                          <>
                            <span>·</span>
                            <span>parts excluded</span>
                          </>
                        )}
                        {!c.includes_labor && (
                          <>
                            <span>·</span>
                            <span>labor excluded</span>
                          </>
                        )}
                      </div>
                      {c.notes && (
                        <p className="text-xs text-[var(--text-muted)] mt-1.5">{c.notes}</p>
                      )}
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleEdit(c)}
                          className="p-1.5 rounded hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text)]"
                          title="Edit contract"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {c.is_active && (
                          <button
                            onClick={() => handleDeactivate(c)}
                            className="p-1.5 rounded hover:bg-red-50 text-[var(--text-muted)] hover:text-red-600"
                            title="Deactivate contract"
                          >
                            <ShieldOff className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AddEditContractModal
        isOpen={showModal}
        customerId={customerId}
        contract={editing}
        currentUser={currentUser}
        onClose={() => {
          setShowModal(false);
          setEditing(null);
        }}
        onSaved={handleSaved}
      />
    </>
  );
};

export default ContractsSection;
