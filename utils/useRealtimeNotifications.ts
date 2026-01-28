import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '../services/supabaseService';
import type { User } from '../types';
import { showToast } from '../services/toastService';

// Inline notification type to avoid import issues
interface AppNotification {
  notification_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  reference_type?: string;
  reference_id?: string;
  is_read: boolean;
  priority: string;
  created_at: string;
  read_at?: string;
}

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

// Show browser notification (with service worker fallback)
export const showBrowserNotification = async (
  title: string, 
  body: string, 
  options?: { 
    onClick?: () => void;
    url?: string;
    tag?: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
  }
) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  
  const notificationTag = options?.tag || `fieldpro-${Date.now()}`;
  const requireInteraction = options?.priority === 'urgent' || options?.priority === 'high';
  const vibrate = options?.priority === 'urgent' ? [200, 100, 200, 100, 200] : [200, 100, 200];
  
  // Try service worker notification first (works better on mobile and when page is in background)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: notificationTag,
        requireInteraction,
        data: { url: options?.url || '/' }
      } as NotificationOptions & { vibrate?: number[] });
      return;
    } catch (e) {
      console.warn('[Notifications] Service worker notification failed, falling back:', e);
    }
  }
  
  // Fallback to regular Notification API
  try {
    const notification = new Notification(title, {
      body,
      icon: '/favicon.svg',
      tag: notificationTag,
      requireInteraction,
    });
    
    if (options?.onClick) {
      notification.onclick = () => {
        window.focus();
        options.onClick?.();
        notification.close();
      };
    } else if (options?.url) {
      notification.onclick = () => {
        window.focus();
        window.location.href = options.url!;
        notification.close();
      };
    }
    
    // Auto close after 5 seconds (unless requires interaction)
    if (!requireInteraction) {
      setTimeout(() => notification.close(), 5000);
    }
  } catch (e) {
    console.warn('[Notifications] Browser notification failed:', e);
  }
};

// Vibrate device if supported (mobile)
export const vibrateDevice = (pattern: number | number[] = [200, 100, 200]) => {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // Vibration not supported or blocked
    }
  }
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
      // Determine URL based on notification type
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
    const toastType = newNotification.priority === 'urgent' ? 'error' : 
                      newNotification.priority === 'high' ? 'warning' : 'info';
    (showToast as any)[toastType](newNotification.title, newNotification.message);
    
    // Callback via ref
    onNewNotificationRef.current?.(newNotification);
  }, [playSound, showBrowserNotifications]);
  
  // Setup realtime subscriptions - STABLE channel name (no Date.now())
  useEffect(() => {
    if (!currentUser?.user_id) return;
    
    mountedRef.current = true;
    
    // Clean up any existing channel first
    if (channelRef.current) {
      console.log('[Realtime] Cleaning up existing channel');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    // STABLE channel name - based only on user_id
    const channelName = `fieldpro-notifications-${currentUser.user_id}`;
    
    console.log('[Realtime] Creating channel:', channelName);
    const channel = supabase.channel(channelName);
    
    // Subscribe to notifications for this user
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUser.user_id}`,
      },
      (payload) => {
        console.log('[Realtime] New notification received:', payload.new);
        handleNewNotification(payload.new as AppNotification);
      }
    );
    
    // Subscribe to job updates for technicians (when their assigned jobs change)
    if (currentUser.role === 'technician') {
      // Job status/assignment changes
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `assigned_technician_id=eq.${currentUser.user_id}`,
        },
        (payload) => {
          console.log('[Realtime] Job update for technician:', payload.new);
          onJobUpdateRef.current?.(payload.new);
        }
      );
      
      // Job request status changes (for requests the technician made)
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'job_requests',
          filter: `requested_by=eq.${currentUser.user_id}`,
        },
        (payload) => {
          console.log('[Realtime] Request update for technician:', payload.new);
          onRequestUpdateRef.current?.(payload.new);
        }
      );
      
      // NEW: Listen for new job assignments (INSERT on jobs where assigned to this tech)
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'jobs',
          filter: `assigned_technician_id=eq.${currentUser.user_id}`,
        },
        (payload) => {
          console.log('[Realtime] New job assigned to technician:', payload.new);
          onJobUpdateRef.current?.(payload.new);
        }
      );
    }
    
    // Subscribe to job_requests for admins/supervisors (new requests from technicians)
    if (currentUser.role === 'admin' || currentUser.role === 'supervisor') {
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_requests',
        },
        (payload) => {
          console.log('[Realtime] New job request:', payload.new);
          onRequestUpdateRef.current?.(payload.new);
        }
      );
      
      // Also listen for request status changes (in case another admin handles it)
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'job_requests',
        },
        (payload) => {
          console.log('[Realtime] Job request updated:', payload.new);
          onRequestUpdateRef.current?.(payload.new);
        }
      );
    }
    
    // Subscribe and track connection status
    channel.subscribe((status, error) => {
      if (!mountedRef.current) return;
      
      console.log('[Realtime] Subscription status:', status, error || '');
      
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        console.log('[Realtime] ✅ Notifications connected for user:', currentUser.user_id);
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        setIsConnected(false);
        console.warn('[Realtime] ⚠️ Connection closed/error:', status);
      } else if (status === 'TIMED_OUT') {
        setIsConnected(false);
        console.warn('[Realtime] ⚠️ Connection timed out, will retry...');
      }
    });
    
    channelRef.current = channel;
    
    // Cleanup
    return () => {
      mountedRef.current = false;
      if (channelRef.current) {
        console.log('[Realtime] Removing channel on cleanup');
        supabase.removeChannel(channelRef.current);
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
