import type { RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../services/supabaseService';
import { showToast } from '../services/toastService';
import type { Job, JobRequest, User } from '../types';
import {
  type AppNotification,
  initAudio,
  playNotificationSound,
  requestNotificationPermission,
  showBrowserNotification,
  vibrateDevice,
} from './notificationHandlers';
import { removeChannel, setupRealtimeChannel } from './realtimeChannels';

interface UseRealtimeNotificationsOptions {
  onNewNotification?: (notification: AppNotification) => void;
  onJobUpdate?: (job: Job) => void;
  onRequestUpdate?: (request: JobRequest) => void;
  playSound?: boolean;
  showBrowserNotifications?: boolean;
}

export const useRealtimeNotifications = (
  currentUser: User | null,
  options: UseRealtimeNotificationsOptions = {}
) => {
  const {
    onNewNotification,
    onJobUpdate,
    onRequestUpdate,
    playSound = true,
    showBrowserNotifications = true,
  } = options;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const mountedRef = useRef(true);

  // Use refs for callbacks to avoid re-subscription on callback changes
  const onNewNotificationRef = useRef(onNewNotification);
  const onJobUpdateRef = useRef(onJobUpdate);
  const onRequestUpdateRef = useRef(onRequestUpdate);

  // Update refs when callbacks change
  useEffect(() => {
    onNewNotificationRef.current = onNewNotification;
    onJobUpdateRef.current = onJobUpdate;
    onRequestUpdateRef.current = onRequestUpdate;
  }, [onNewNotification, onJobUpdate, onRequestUpdate]);

  // Initialize audio on first user interaction
  useEffect(() => {
    const handleInteraction = () => {
      initAudio();
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);
    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  // Request notification permission
  useEffect(() => {
    if (showBrowserNotifications) {
      requestNotificationPermission();
    }
  }, [showBrowserNotifications]);

  // Handle new notification - extracted to avoid duplication
  const handleNewNotification = useCallback((newNotification: AppNotification) => {
    if (!mountedRef.current) return;

    // Update state
    setNotifications(prev => {
      // Prevent duplicates
      if (prev.some(n => n.notification_id === newNotification.notification_id)) {
        return prev;
      }
      return [newNotification, ...prev].slice(0, 50);
    });
    setUnreadCount(prev => prev + 1);

    // Play sound
    if (playSound) {
      playNotificationSound();
    }

    // Vibrate on mobile
    vibrateDevice();

    // Show browser notification with priority and URL
    if (showBrowserNotifications) {
      let notificationUrl = '/';
      if (newNotification.reference_type === 'job' && newNotification.reference_id) {
        notificationUrl = `/jobs/${newNotification.reference_id}`;
      }

      showBrowserNotification(newNotification.title, newNotification.message, {
        priority: newNotification.priority as 'low' | 'normal' | 'high' | 'urgent',
        url: notificationUrl,
        tag: `fieldpro-${newNotification.notification_id}`
      });
    }

    // Show toast with appropriate type
    if (newNotification.priority === 'urgent') {
      showToast.error(newNotification.title, newNotification.message);
    } else if (newNotification.priority === 'high') {
      showToast.warning(newNotification.title, newNotification.message);
    } else {
      showToast.info(newNotification.title, newNotification.message);
    }

    // Callback via ref
    onNewNotificationRef.current?.(newNotification);
  }, [playSound, showBrowserNotifications]);

  // Setup realtime subscriptions
  useEffect(() => {
    if (!currentUser?.user_id) return;

    mountedRef.current = true;

    // Clean up any existing channel first
    if (channelRef.current) {
      removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = setupRealtimeChannel(currentUser, {
      onNotification: handleNewNotification,
      onJobUpdate: (job: Job) => onJobUpdateRef.current?.(job),
      onRequestUpdate: (request: JobRequest) => onRequestUpdateRef.current?.(request),
      onStatusChange: (connected: boolean) => {
        if (mountedRef.current) {
          setIsConnected(connected);
        }
      },
    });

    channelRef.current = channel;

    // Cleanup
    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [currentUser?.user_id, currentUser?.role, handleNewNotification]);

  // Load initial notifications
  useEffect(() => {
    if (!currentUser?.user_id) return;

    const loadNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', currentUser.user_id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error && data && mountedRef.current) {
          setNotifications(data as AppNotification[]);
          setUnreadCount(data.filter((n: AppNotification) => !n.is_read).length);
        }
      } catch (_e) {
        /* Silently ignore */
      }
    };

    loadNotifications();
  }, [currentUser?.user_id]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('notification_id', notificationId);

    if (!error) {
      setNotifications(prev =>
        prev.map(n => n.notification_id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!currentUser?.user_id) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', currentUser.user_id)
      .eq('is_read', false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  }, [currentUser?.user_id]);

  // Refresh notifications
  const refresh = useCallback(async () => {
    if (!currentUser?.user_id) return;

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', currentUser.user_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data && mountedRef.current) {
      setNotifications(data as AppNotification[]);
      setUnreadCount(data.filter((n: AppNotification) => !n.is_read).length);
    }
  }, [currentUser?.user_id]);

  return {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    refresh,
  };
};

export type { AppNotification };
export default useRealtimeNotifications;
