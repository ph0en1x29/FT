import React, { useState } from 'react';
import type { Job } from '../../../types';
import type { User } from '../../../types/user.types';
import { BulkSignOffModal } from './BulkSignOffModal';

interface SiteSignOffBannerProps {
  jobs: Job[];
  currentUser: User;
  onComplete: () => void;
}

interface SiteGroup {
  customerId: string;
  customerName: string;
  siteId: string;
  siteAddress: string;
  jobs: Job[];
  unsignedCount: number;
}

/**
 * Groups technician's "In Progress" jobs by customer (one bucket per company).
 * Shows a banner per customer with ≥2 unsigned jobs so the tech can sign them
 * all with a single customer signature. Jobs missing an after-photo are still
 * surfaced — the modal flags them as "needs photo" rather than hiding them.
 */
export const SiteSignOffBanner: React.FC<SiteSignOffBannerProps> = ({
  jobs,
  currentUser,
  onComplete,
}) => {
  const [selectedGroup, setSelectedGroup] = useState<SiteGroup | null>(null);

  const customerGroups = React.useMemo(() => {
    const groups = new Map<string, SiteGroup & { siteIds: Set<string> }>();

    jobs.forEach((job) => {
      // Include both primary-assigned jobs AND helper assignments so
      // helpers (e.g. tech2) on-site can also surface the bulk-sign banner
      // for the company they're working at. The job_assignments-derived
      // helper rows are flagged with `_isHelperAssignment` by jobReadService.
      const isPrimary = job.assigned_technician_id === currentUser.user_id;
      const isHelper = (job as { _isHelperAssignment?: boolean })._isHelperAssignment === true;
      if (job.status !== 'In Progress' || (!isPrimary && !isHelper)) {
        return;
      }

      if (job.technician_signature && job.customer_signature) {
        return;
      }

      const customerId = job.customer_id;
      if (!customerId) return;

      if (!groups.has(customerId)) {
        groups.set(customerId, {
          customerId,
          customerName: job.customer?.name || 'Customer',
          siteId: job.site_id || 'no-site',
          siteAddress:
            (job as { customer_site?: { site_name?: string } }).customer_site?.site_name ||
            job.customer?.address ||
            'No address',
          jobs: [],
          unsignedCount: 0,
          siteIds: new Set<string>(),
        });
      }

      const group = groups.get(customerId)!;
      group.jobs.push(job);
      group.siteIds.add(job.site_id || 'no-site');

      if (!job.technician_signature) {
        group.unsignedCount++;
      }
    });

    return Array.from(groups.values())
      .filter((group) => group.unsignedCount >= 2)
      .map(({ siteIds, ...rest }) => ({
        ...rest,
        siteAddress:
          siteIds.size > 1
            ? `${rest.jobs.length} jobs across ${siteIds.size} sites`
            : rest.siteAddress,
      }));
  }, [jobs, currentUser.user_id]);

  if (customerGroups.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-3 mb-6">
        {customerGroups.map((group) => (
          <div
            key={group.customerId}
            className="card-premium p-4 flex items-center justify-between gap-4"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <span className="text-lg">📍</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[var(--text)] truncate">
                    {group.customerName}
                  </h3>
                  <p className="text-sm text-[var(--text-muted)] truncate">
                    {group.siteAddress}
                  </p>
                  <p className="text-sm text-[var(--accent)] mt-1">
                    {group.unsignedCount} job{group.unsignedCount !== 1 ? 's' : ''} ready to sign off
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setSelectedGroup(group)}
              className="btn-premium px-4 py-2 text-sm font-medium whitespace-nowrap"
            >
              Sign Off
            </button>
          </div>
        ))}
      </div>

      {selectedGroup && (
        <BulkSignOffModal
          siteGroup={selectedGroup}
          currentUser={currentUser}
          onComplete={() => {
            setSelectedGroup(null);
            onComplete();
          }}
          onClose={() => setSelectedGroup(null)}
        />
      )}
    </>
  );
};
