import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types';
import { useRealtimeNotifications } from '../utils/useRealtimeNotifications';
import {
  initializePushNotifications,
  enablePushNotifications,
  getPushPermissionState,
  isPushSupported,
  type PushPermissionState
} from '../services/pushNotificationService';

type RealtimeState = ReturnType<typeof useRealtimeNotifications>;

type NotificationContextValue = RealtimeState & {
  jobUpdateTick: number;
  requestUpdateTick: number;
  // Push notification state
  pushSupported: boolean;
  pushPermission: PushPermissionState;
  requestPushPermission: () => Promise<boolean>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

interface NotificationProviderProps {
  currentUser: User;
  children: ReactNode;
}

export const NotificationProvider = ({ currentUser, children }: NotificationProviderProps) => {
  const [jobUpdateTick, setJobUpdateTick] = useState(0);
  const [requestUpdateTick, setRequestUpdateTick] = useState(0);
  
  // Push notification state
  const [pushSupported] = useState(isPushSupported());
  const [pushPermission, setPushPermission] = useState<PushPermissionState>(getPushPermissionState());

  const handleJobUpdate = useCallback(() => {
    setJobUpdateTick((prev) => prev + 1);
  }, []);

  const handleRequestUpdate = useCallback(() => {
    setRequestUpdateTick((prev) => prev + 1);
  }, []);

  // Initialize push notifications on mount
  useEffect(() => {
    const initPush = async () => {
      const result = await initializePushNotifications();
      setPushPermission(result.permission);
      
      if (result.supported && result.permission === 'granted') {
      }
    };
    
    initPush();
  }, []);

  // Function to request push permission (call when user explicitly enables)
  const requestPushPermission = useCallback(async (): Promise<boolean> => {
    const result = await enablePushNotifications();
    setPushPermission(result.permission);
    return result.success;
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
    pushSupported,
    pushPermission,
    requestPushPermission,
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
