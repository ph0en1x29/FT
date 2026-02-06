import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, CloudOff, RefreshCw } from 'lucide-react';

interface OfflineIndicatorProps {
  /** Show as banner at top of screen */
  variant?: 'banner' | 'badge' | 'toast';
  /** Position for badge variant */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

/**
 * Offline status indicator
 * Automatically detects network status and shows appropriate UI
 * 
 * Usage:
 *   <OfflineIndicator variant="banner" />
 */
export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  variant = 'banner',
  position = 'top-right',
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3000);
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  // Don't render if online and not showing reconnected message
  if (isOnline && !showReconnected) return null;

  if (variant === 'banner') {
    return (
      <div
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isOnline && showReconnected
            ? 'bg-green-500'
            : 'bg-[var(--error)]'
        }`}
      >
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-center gap-2 text-white text-sm">
          {isOnline && showReconnected ? (
            <>
              <Wifi className="w-4 h-4" />
              <span>Back online! Syncing changes...</span>
              <RefreshCw className="w-4 h-4 animate-spin" />
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4" />
              <span>You're offline. Changes will sync when connection is restored.</span>
            </>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'badge') {
    const positionClasses = {
      'top-right': 'top-4 right-4',
      'top-left': 'top-4 left-4',
      'bottom-right': 'bottom-4 right-4',
      'bottom-left': 'bottom-4 left-4',
    };

    return (
      <div
        className={`fixed ${positionClasses[position]} z-50 transition-all duration-300`}
      >
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-lg ${
            isOnline && showReconnected
              ? 'bg-green-500 text-white'
              : 'bg-[var(--error)] text-white'
          }`}
        >
          {isOnline && showReconnected ? (
            <>
              <Wifi className="w-4 h-4" />
              <span className="text-sm font-medium">Online</span>
            </>
          ) : (
            <>
              <CloudOff className="w-4 h-4" />
              <span className="text-sm font-medium">Offline</span>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
};

/**
 * Hook to get current online status
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export default OfflineIndicator;
