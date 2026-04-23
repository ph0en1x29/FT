import React from 'react';
import { usePendingReturnsToastNotifier } from '../../hooks/usePendingReturns';

/**
 * Headless component — mounts the pending-returns toast notifier hook for
 * admins / supervisors. Renders nothing. Must be a descendant of <Router>
 * because the hook uses useLocation / useNavigate.
 */
export const PendingReturnsNotifier: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  usePendingReturnsToastNotifier(enabled);
  return null;
};
