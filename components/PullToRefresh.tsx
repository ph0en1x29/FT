import { RefreshCw } from 'lucide-react';
import React,{ ReactNode,useCallback,useRef,useState } from 'react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  threshold?: number;
  className?: string;
  disabled?: boolean;
}

/**
 * Pull-to-refresh wrapper component for mobile-friendly refresh
 * 
 * Usage:
 *   <PullToRefresh onRefresh={loadData}>
 *     <YourContent />
 *   </PullToRefresh>
 */
export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  threshold = 80,
  className = '',
  disabled = false,
}) => {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || refreshing) return;
    
    // Only enable pull when at top of scroll
    const container = containerRef.current;
    if (container && container.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      setPulling(true);
    }
  }, [disabled, refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling || disabled || refreshing) return;
    
    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    
    if (diff > 0) {
      // Add resistance - pull distance is less than finger movement
      const resistance = 0.5;
      const distance = Math.min(diff * resistance, threshold * 1.5);
      setPullDistance(distance);
      
      // Prevent default scroll when pulling
      if (diff > 10) {
        e.preventDefault();
      }
    }
  }, [pulling, disabled, refreshing, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling || disabled) return;
    
    setPulling(false);
    
    if (pullDistance >= threshold) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    
    setPullDistance(0);
  }, [pulling, disabled, pullDistance, threshold, onRefresh]);

  const progress = Math.min(pullDistance / threshold, 1);
  const showIndicator = pullDistance > 10 || refreshing;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-auto ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center transition-all duration-200 z-10"
        style={{
          top: -40 + (showIndicator ? pullDistance : 0),
          opacity: showIndicator ? progress : 0,
          height: 40,
        }}
      >
        <div 
          className={`p-2 rounded-full bg-[var(--surface)] shadow-premium ${refreshing ? 'animate-spin' : ''}`}
          style={{
            transform: `rotate(${progress * 180}deg)`,
          }}
        >
          <RefreshCw className={`w-5 h-5 text-[var(--accent)] ${refreshing ? '' : ''}`} />
        </div>
      </div>
      
      {/* Content with pull offset */}
      <div
        className="transition-transform duration-200"
        style={{
          transform: `translateY(${showIndicator ? pullDistance : 0}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
