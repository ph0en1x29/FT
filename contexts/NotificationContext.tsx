import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types';
import { useRealtimeNotifications } from '../utils/useRealtimeNotifications';

type RealtimeState = ReturnType<typeof useRealtimeNotifications>;

type NotificationContextValue = RealtimeState & {
  jobUpdateTick: number;
  requestUpdateTick: number;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

interface NotificationProviderProps {
  currentUser: User;
  children: ReactNode;
}

export const NotificationProvider = ({ currentUser, children }: NotificationProviderProps) => {
  const [jobUpdateTick, setJobUpdateTick] = useState(0);
  const [requestUpdateTick, setRequestUpdateTick] = useState(0);

  const handleJobUpdate = useCallback(() => {
    setJobUpdateTick((prev) => prev + 1);
  }, []);

  const handleRequestUpdate = useCallback(() => {
    setRequestUpdateTick((prev) => prev + 1);
  }, []);

  const realtime = useRealtimeNotifications(currentUser, {
    playSound: true,
    showBrowserNotifications: true,
    onJobUpdate: handleJobUpdate,
    onRequestUpdate: handleRequestUpdate,
  });

  const value: NotificationContextValue = {
    ...realtime,
    jobUpdateTick,
    requestUpdateTick,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};
