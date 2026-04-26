/**
 * AdminDashboardV7_1 - "Command Center" (Enhanced)
 *
 * See everything, act on everything without leaving the dashboard.
 */

import { CheckCircle, FileText } from 'lucide-react';
import React from 'react';
import type { Job, User } from '../../../../types';
import { AdminDashboardV7_1ApprovalSections } from './AdminDashboardV7_1ApprovalSections';
import { AdminDashboardV7_1Header } from './AdminDashboardV7_1Header';
import { AdminDashboardV7_1PipelineSection } from './AdminDashboardV7_1PipelineSection';
import { BulkActionBar } from './AdminDashboardV7_1Primitives';
import { AdminDashboardV7_1ScheduleSection } from './AdminDashboardV7_1ScheduleSection';
import { AdminDashboardV7_1StockActivitySections } from './AdminDashboardV7_1StockActivitySections';
import { AdminDashboardV7_1TeamFinancialSections } from './AdminDashboardV7_1TeamFinancialSections';
import { useAdminDashboardV7_1Data } from './useAdminDashboardV7_1Data';

interface AdminDashboardV7_1Props {
  currentUser: User;
  jobs: Job[];
  users: User[];
  onRefresh: () => void;
  navigate: (path: string) => void;
}

const AdminDashboardV7_1: React.FC<AdminDashboardV7_1Props> = (props) => {
  const data = useAdminDashboardV7_1Data(props);

  return (
    <div className="space-y-4">
      <AdminDashboardV7_1Header data={data} />
      <AdminDashboardV7_1ApprovalSections data={data} />
      <AdminDashboardV7_1PipelineSection data={data} />
      <AdminDashboardV7_1ScheduleSection data={data} />
      <AdminDashboardV7_1TeamFinancialSections data={data} />
      <AdminDashboardV7_1StockActivitySections data={data} />

      <BulkActionBar
        count={data.selectedApprovalIds.size}
        onClear={() => data.setSelectedApprovalIds(new Set())}
        actions={[
          {
            label: data.processing ? 'Processing...' : 'Confirm Parts',
            icon: <CheckCircle className="w-3.5 h-3.5" />,
            onClick: data.handleBulkConfirmParts,
            variant: 'primary',
          },
          {
            label: data.processing ? 'Processing...' : 'Finalize Invoices',
            icon: <FileText className="w-3.5 h-3.5" />,
            onClick: data.handleBulkFinalize,
            variant: 'default',
          },
        ]}
      />
    </div>
  );
};

export default AdminDashboardV7_1;
