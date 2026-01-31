import React from 'react';
import { Skeleton, SkeletonTableRow } from '../../components/Skeleton';

interface ServiceRecordsLoadingProps {
  hideHeader?: boolean;
}

/**
 * Loading skeleton state for service records page
 */
const ServiceRecordsLoading: React.FC<ServiceRecordsLoadingProps> = ({ hideHeader = false }) => {
  const tableHeaders = ['Report No.', 'Date', 'Customer', 'Equipment', 'Job Title', 'Technician', 'Status', 'Actions'];

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Skeleton width={180} height={28} className="mb-2" />
            <Skeleton width={120} height={16} />
          </div>
        </div>
      )}
      <div className="card-theme rounded-xl p-4 theme-transition">
        <Skeleton width="100%" height={44} className="mb-4" />
        <div className="flex gap-3">
          <Skeleton width={150} height={36} />
          <Skeleton width={150} height={36} />
        </div>
      </div>
      <div className="card-theme rounded-xl overflow-hidden theme-transition">
        <table className="w-full">
          <thead className="bg-theme-surface-2">
            <tr>
              {tableHeaders.map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs text-theme-muted uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonTableRow key={i} columns={8} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ServiceRecordsLoading;
