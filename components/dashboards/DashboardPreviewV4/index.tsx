/**
 * DashboardPreviewV4 - Modular Role-Based Dashboard
 * 
 * Structure:
 * - DashboardPreviewV4.tsx: Main component with role routing
 * - components/AdminDashboard.tsx: Admin/Supervisor view
 * - components/TechnicianDashboard.tsx: Technician view
 * - components/AccountantDashboard.tsx: Accountant view
 * - components/SupervisorDashboard.tsx: Re-exports AdminDashboard
 * - components/DashboardWidgets.tsx: Shared UI components
 */

export { default } from './DashboardPreviewV4';
export type { DashboardPreviewV4Props } from './DashboardPreviewV4';

// Re-export widgets for external use if needed
export * from './components/DashboardWidgets';
