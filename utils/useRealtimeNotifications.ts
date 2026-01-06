import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '../services/supabaseService';
import type { Notification as AppNotification, User } from '../types_with_invoice_tracking';
import { showToast } from '../services/toastService';

// Notification sound - a short pleasant chime
const NOTIFICATION_SOUND_URL = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQESdaTF3rJ3IwVOqtXkv4M3En6/3OO0eTkWa6/d5beBKwlgud7ot38tDFu33+i3fy0PWsDj6bV9LA5fvOPqtX0tD1697Oq1fSwSYb/l67N6Kw5iwejqs3orEGTC6uuzeSoPY8ft67N4KRBlyO7rsngpEGjL8+uydSgRac316rJ1KBBr0PjssnQnEG3T/O2ycycPb9b/7rJzJg9y2gHvsnImD3XdA++ycSYPeOAF77FxJg964gfvsXAmD3zlCe+wcCYPf+kL8K9vJg+A7A3wr28mD4LuD/CubiYPhe4R8K5uJRCH7xPxrm0lD4jxFfGtbCUQivIX8a1sJQ+L9Bnxq2slD43zG/GrbCUQjvUd8qprJBCQ9h/yqWokEJH4IfKpaiQQk/kj86hpJBCV+yXzqGkkEJb8J/SnaRMXmP0p9KZoFBiZ/yv1pWcTGJsALfWkZxQZnAIv9qRmFBqdBC/2o2YTGp4FMfajZRMaoAYy96JlExuhCDP3oWQTG6IJNP+hYxIcoQo1/6FjExyiDDb/oGISHaMNOP+fYRIdow45/59hER6kDzr/nmESHqQQO/+dYBIepRA8/51fER+mET3/nF8RH6YRP/+bXxEgpxI//5pfEiGnEz7/ml4SIagUPv+ZXhIhqBQ//5hdESKoFT//mF0RIqkVPv+XXRIjqRY+/5ZcEiOpFz//llsSJKoXPv+VWxIkqhg//5RbEiWqGD7/lFoSJasYPv+UWhImqxk+/5NZEiarGj7/k1kSJqwaP/+SWRInrBo+/5JYEierGz7/klgSKKwbP/+RWBIorBs+/5FYEimtHD7/kVcTKq0cP/+RVxIqrRw+/5BXEiqtHD7/kFYTK64dPv+QVhMrrh4//49WEyyuHj7/j1YTK64ePv+PVRMsrh4+/49VEyyvHj//jlUTLK8ePv+OVBMtrx4+/45UEy2vHj7/jVQULrAePv+NUxQusB4+/41TFC6wHj7/jFMUL7AeP/+MUxQvsR4+/4xSFC+xHj7/jFIUMLEePv+LUhUwsR4+/4tRFTGxHj7/i1EVMbIeP/+KURUxsh4+/4pQFTKyHj7/ilAVM7IeP/+JUBUzsh4+/4lPFTSzHj//iU8WNLMePv+JTxY0sx4+/4hPFjW0Hj7/iE4WNbQePv+IThY2tB4//4dOFza0Hj7/h04XNrUePv+HThc3tR4+/4ZNFze1Hj7/hk0XOLYeP/+FTRY4th4+/4VNFji2Hj7/hEwXObYePv+ETBY5tx4+/4RMFzq3Hj//g0sYOrcePv+DSxg6uB4+/4NLGDq4Hj7/gksYO7gePv+CSRg7uB4+';

let audioContext: AudioContext | null = null;
let notificationBuffer: AudioBuffer | null = null;

// Initialize audio context and load sound
const initAudio = async () => {
  if (audioContext) return;
  
  try {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const response = await fetch(NOTIFICATION_SOUND_URL);
    const arrayBuffer = await response.arrayBuffer();
    notificationBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } catch (e) {
    console.warn('Audio initialization failed:', e);
  }
};

// Play notification sound
export const playNotificationSound = () => {
  if (!audioContext || !notificationBuffer) {
    initAudio();
    return;
  }
  
  try {
    const source = audioContext.createBufferSource();
    source.buffer = notificationBuffer;
    source.connect(audioContext.destination);
    source.start(0);
  } catch (e) {
    console.warn('Failed to play notification sound:', e);
  }
};

// Request browser notification permission
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) return false;
  
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  
  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

// Show browser notification
export const showBrowserNotification = (title: string, body: string, onClick?: () => void) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  
  const notification = new Notification(title, {
    body,
    icon: '/favicon.ico',
    tag: 'fieldpro-notification',
  });
  
  if (onClick) {
    notification.onclick = () => {
      window.focus();
      onClick();
      notification.close();
    };
  }
  
  // Auto close after 5 seconds
  setTimeout(() => notification.close(), 5000);
};

interface UseRealtimeNotificationsOptions {
  onNewNotification?: (notification: AppNotification) => void;
  onJobUpdate?: (job: any) => void;
  onRequestUpdate?: (request: any) => void;
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
  const channelRef = useRef<any>(null);
  
  // Initialize audio on first user interaction
  useEffect(() => {
    const handleInteraction = () => {
      initAudio();
      document.removeEventListener('click', handleInteraction);
    };
    document.addEventListener('click', handleInteraction);
    return () => document.removeEventListener('click', handleInteraction);
  }, []);
  
  // Request notification permission
  useEffect(() => {
    if (showBrowserNotifications) {
      requestNotificationPermission();
    }
  }, [showBrowserNotifications]);
  
  // Handle new notification
  const handleNewNotification = useCallback((payload: any) => {
    const newNotification = payload.new as AppNotification;
    
    // Update state
    setNotifications(prev => [newNotification, ...prev].slice(0, 50));
    setUnreadCount(prev => prev + 1);
    
    // Play sound
    if (playSound) {
      playNotificationSound();
    }
    
    // Show browser notification
    if (showBrowserNotifications) {
      showBrowserNotification(newNotification.title, newNotification.message);
    }
    
    // Show toast
    const toastType = newNotification.priority === 'urgent' ? 'error' : 
                      newNotification.priority === 'high' ? 'warning' : 'info';
    showToast[toastType](newNotification.title, newNotification.message);
    
    // Callback
    onNewNotification?.(newNotification);
  }, [playSound, showBrowserNotifications, onNewNotification]);
  
  // Handle job updates (for real-time UI refresh; user-facing alerts come from `notifications` table)
  const handleJobUpdate = useCallback((payload: any) => {
    const job = payload.new;
    onJobUpdate?.(job);
  }, [onJobUpdate]);
  
  // Handle request updates (for real-time UI refresh; user-facing alerts come from `notifications` table)
  const handleRequestUpdate = useCallback((payload: any) => {
    const request = payload.new;
    onRequestUpdate?.(request);
  }, [onRequestUpdate]);
  
  // Setup realtime subscriptions
  useEffect(() => {
    if (!currentUser?.user_id) return;
    
    // Create channel
    const channel = supabase.channel(`user-${currentUser.user_id}-notifications`);
    
    // Subscribe to notifications for this user
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUser.user_id}`,
      },
      handleNewNotification
    );
    
    // Subscribe to job updates for technicians
    if (currentUser.role === 'technician') {
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `assigned_technician_id=eq.${currentUser.user_id}`,
        },
        handleJobUpdate
      );
      
      // Also subscribe to job_requests for request status changes
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'job_requests',
          filter: `requested_by=eq.${currentUser.user_id}`,
        },
        handleRequestUpdate
      );
    }
    
    // Subscribe to job_requests for admins (new requests) - for UI refresh only
    if (currentUser.role === 'admin' || currentUser.role === 'supervisor') {
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_requests',
        },
        (payload) => {
          const request = payload.new as any;
          onRequestUpdate?.(request);
        }
      );
    }
    
    // Subscribe and track connection status
    channel.subscribe((status) => {
      setIsConnected(status === 'SUBSCRIBED');
      if (status === 'SUBSCRIBED') {
        console.log('Realtime notifications connected');
      }
    });
    
    channelRef.current = channel;
    
    // Cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [currentUser?.user_id, currentUser?.role, handleNewNotification, handleJobUpdate, handleRequestUpdate, playSound]);
  
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
        
        if (!error && data) {
          setNotifications(data as AppNotification[]);
          setUnreadCount(data.filter((n: any) => !n.is_read).length);
        }
      } catch (e) {
        console.warn('Failed to load notifications:', e);
      }
    };
    
    loadNotifications();
  }, [currentUser?.user_id]);
  
  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('notification_id', notificationId);
    
    setNotifications(prev =>
      prev.map(n => n.notification_id === notificationId ? { ...n, is_read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);
  
  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!currentUser?.user_id) return;
    
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', currentUser.user_id)
      .eq('is_read', false);
    
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
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
    
    if (data) {
      setNotifications(data as AppNotification[]);
      setUnreadCount(data.filter((n: any) => !n.is_read).length);
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

export default useRealtimeNotifications;
