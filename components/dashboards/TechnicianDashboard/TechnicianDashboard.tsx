import React from 'react';
import { TechnicianDashboardProps } from './types';
import { useTechnicianDashboard } from './hooks';
import {
  DashboardHeader,
  SlotInAlertBanner,
  TodayScheduleSection,
  KPIStatsGrid,
  ActiveJobsList,
  QuickActionsGrid,
  LoadingState,
} from './components';
import DashboardNotificationCard from '../../DashboardNotificationCard';
import { NotificationPermissionPrompt } from '../../NotificationSettings';

/**
 * Technician Dashboard - Main view for field technicians
 *
 * Features:
 * - Today's schedule with job carousel
 * - Slot-In SLA alerts with urgent banner
 * - KPI stats (today's jobs, in-progress, completed, van stock)
 * - Active jobs list
 * - Push notification management
 * - Quick action shortcuts
 */
const TechnicianDashboard: React.FC<TechnicianDashboardProps> = ({ currentUser }) => {
  const { loading, vanStockLow, stats } = useTechnicianDashboard(currentUser);

  if (loading) {
    return <LoadingState />;
  }

  const { todayJobs, inProgressJobs, completedThisWeek, slotInPending, activeJobs } = stats;

  return (
    <div className="space-y-6 fade-in">
      {/* Push Notification Permission Prompt */}
      <NotificationPermissionPrompt />

      {/* Header with greeting and van stock button */}
      <DashboardHeader currentUser={currentUser} />

      {/* Urgent Slot-In Alert Banner */}
      <SlotInAlertBanner slotInPending={slotInPending} />

      {/* Today's Schedule Carousel - PRIMARY SECTION */}
      <TodayScheduleSection todayJobs={todayJobs} />

      {/* KPI Stats Grid */}
      <KPIStatsGrid
        todayJobs={todayJobs}
        inProgressJobs={inProgressJobs}
        completedThisWeek={completedThisWeek}
        vanStockLow={vanStockLow}
      />

      {/* Notifications */}
      <DashboardNotificationCard maxItems={5} />

      {/* All Active Jobs List */}
      <ActiveJobsList activeJobs={activeJobs} />

      {/* Quick Actions */}
      <QuickActionsGrid />
    </div>
  );
};

export default TechnicianDashboard;
