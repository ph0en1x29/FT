/**
 * AccountantDashboard - Main dashboard for accountant users
 * 
 * Provides overview of:
 * - Jobs awaiting finalization (primary focus)
 * - Revenue metrics and trends
 * - Invoice status distribution
 * - Quick actions for common tasks
 */
import React from 'react';
import DashboardNotificationCard from '../../DashboardNotificationCard';
import { AccountantDashboardProps } from './types';
import { useAccountantDashboardData } from './hooks';
import {
  DashboardHeader,
  FinalizationAlertBanner,
  FinalizationQueue,
  AccountantKPIStats,
  RevenueChart,
  InvoiceStatusChart,
  AccountantQuickActions,
} from './components';

const AccountantDashboard: React.FC<AccountantDashboardProps> = ({ currentUser }) => {
  const {
    loading,
    awaitingFinalization,
    awaitingAck,
    completedThisMonth,
    monthlyRevenue,
    totalRevenue,
    urgentJobsCount,
    totalQueueValue,
    revenueData,
    invoiceStatusData,
    calculateJobRevenue,
    calculateDaysWaiting,
    getUrgencyLevel,
    getUrgencyStyle,
  } = useAccountantDashboardData(currentUser);

  if (loading) {
    return (
      <div className="space-y-6 fade-in">
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-[var(--text-muted)]">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <DashboardHeader currentUser={currentUser} />

      {/* Alert Banner */}
      <FinalizationAlertBanner
        jobCount={awaitingFinalization.length}
        urgentCount={urgentJobsCount}
        totalValue={totalQueueValue}
      />

      {/* Finalization Queue - PRIMARY SECTION */}
      <FinalizationQueue
        jobs={awaitingFinalization}
        urgentCount={urgentJobsCount}
        totalValue={totalQueueValue}
        calculateJobRevenue={calculateJobRevenue}
        calculateDaysWaiting={calculateDaysWaiting}
        getUrgencyLevel={getUrgencyLevel}
        getUrgencyStyle={getUrgencyStyle}
      />

      {/* KPI Stats */}
      <AccountantKPIStats
        monthlyRevenue={monthlyRevenue}
        awaitingFinalizationCount={awaitingFinalization.length}
        awaitingAckCount={awaitingAck.length}
        completedThisMonthCount={completedThisMonth.length}
      />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart data={revenueData} totalRevenue={totalRevenue} />
        <InvoiceStatusChart data={invoiceStatusData} />
      </div>

      {/* Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardNotificationCard maxItems={5} />
      </div>

      {/* Quick Actions */}
      <AccountantQuickActions />
    </div>
  );
};

export default AccountantDashboard;
