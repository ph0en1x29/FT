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
 * Groups technician's "In Progress" jobs by customer+site
 * Shows a banner for each site with ≥2 unsigned jobs
 */
export const SiteSignOffBanner: React.FC<SiteSignOffBannerProps> = ({
  jobs,
  currentUser,
  onComplete,
}) => {
  const [selectedGroup, setSelectedGroup] = useState<SiteGroup | null>(null);

  // Group jobs by customer_id + site_id
  const siteGroups = React.useMemo(() => {
    const groups = new Map<string, SiteGroup>();

    jobs.forEach((job) => {
      // Only process "In Progress" jobs assigned to current technician
      if (
        job.status !== 'In Progress' ||
        job.assigned_technician_id !== currentUser.user_id
      ) {
        return;
      }

      // Skip if both signatures present
      if (job.technician_signature && job.customer_signature) {
        return;
      }

      const customerId = job.customer_id;
      const siteId = job.site_id || 'no-site';
      const key = `${customerId}:${siteId}`;

      if (!groups.has(key)) {
        groups.set(key, {
          customerId,
          customerName: 'Site',
          siteId,
          siteAddress: (job as any).customer_site?.site_name || job.customer?.address || 'No address',
          jobs: [],
          unsignedCount: 0,
        });
      }

      const group = groups.get(key)!;
      group.jobs.push(job);
      
      // Count as ready to sign: missing tech signature AND has after photo
      const hasAfterPhoto = job.media?.some((m) => m.category === 'after') ?? false;
      if (!job.technician_signature && hasAfterPhoto) {
        group.unsignedCount++;
      }
    });

    // Filter to only groups with ≥2 unsigned jobs
    return Array.from(groups.values()).filter((group) => group.unsignedCount >= 2);
  }, [jobs, currentUser.user_id]);

  if (siteGroups.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-3 mb-6">
        {siteGroups.map((group) => (
          <div
            key={`${group.customerId}:${group.siteId}`}
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
