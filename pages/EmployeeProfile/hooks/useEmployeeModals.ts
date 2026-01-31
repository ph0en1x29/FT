import { useState } from 'react';

interface UseEmployeeModalsReturn {
  showAddLicense: boolean;
  showAddPermit: boolean;
  showAddLeave: boolean;
  showLeaveCalendar: boolean;
  setShowAddLicense: (show: boolean) => void;
  setShowAddPermit: (show: boolean) => void;
  setShowAddLeave: (show: boolean) => void;
  setShowLeaveCalendar: (show: boolean) => void;
  closeAllModals: () => void;
}

/**
 * Hook for managing modal visibility states in employee profile
 */
export function useEmployeeModals(): UseEmployeeModalsReturn {
  const [showAddLicense, setShowAddLicense] = useState(false);
  const [showAddPermit, setShowAddPermit] = useState(false);
  const [showAddLeave, setShowAddLeave] = useState(false);
  const [showLeaveCalendar, setShowLeaveCalendar] = useState(false);

  const closeAllModals = () => {
    setShowAddLicense(false);
    setShowAddPermit(false);
    setShowAddLeave(false);
    setShowLeaveCalendar(false);
  };

  return {
    showAddLicense,
    showAddPermit,
    showAddLeave,
    showLeaveCalendar,
    setShowAddLicense,
    setShowAddPermit,
    setShowAddLeave,
    setShowLeaveCalendar,
    closeAllModals,
  };
}
