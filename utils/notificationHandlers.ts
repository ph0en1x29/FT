// WebkitAudioContext for Safari support
interface WebkitWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

// Inline notification type to avoid import issues
export interface AppNotification {
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
export const initAudio = async () => {
  if (audioContext) return;

  try {
    audioContext = new (window.AudioContext || (window as WebkitWindow).webkitAudioContext!)();
    const response = await fetch(NOTIFICATION_SOUND_URL);
    const arrayBuffer = await response.arrayBuffer();
    notificationBuffer = await audioContext.decodeAudioData(arrayBuffer);
  } catch (_e) {
    /* Silently ignore */
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
  } catch (_e) {
    /* Silently ignore */
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
  const _vibrate = options?.priority === 'urgent' ? [200, 100, 200, 100, 200] : [200, 100, 200];

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
    } catch (_e) {
      /* Silently ignore */
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
  } catch (_e) {
    /* Silently ignore */
  }
};

// Vibrate device if supported (mobile)
export const vibrateDevice = (pattern: number | number[] = [200, 100, 200]) => {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (_e) {
      // Vibration not supported or blocked
    }
  }
};
