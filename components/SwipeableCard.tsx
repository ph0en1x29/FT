import React, { useState, useRef, useCallback, ReactNode } from 'react';

interface SwipeAction {
  icon: ReactNode;
  label: string;
  color: string;
  bgColor: string;
  onClick: () => void;
}

interface SwipeableCardProps {
  children: ReactNode;
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
  threshold?: number;
  className?: string;
  disabled?: boolean;
}

/**
 * Swipeable card wrapper with left/right actions
 * 
 * Usage:
 *   <SwipeableCard
 *     leftAction={{ icon: <Check />, label: 'Complete', color: 'text-white', bgColor: 'bg-green-500', onClick: handleComplete }}
 *     rightAction={{ icon: <X />, label: 'Cancel', color: 'text-white', bgColor: 'bg-red-500', onClick: handleCancel }}
 *   >
 *     <JobCard job={job} />
 *   </SwipeableCard>
 */
export const SwipeableCard: React.FC<SwipeableCardProps> = ({
  children,
  leftAction,
  rightAction,
  threshold = 100,
  className = '',
  disabled = false,
}) => {
  const [offset, setOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;
    startX.current = e.touches[0].clientX;
    setSwiping(true);
  }, [disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping || disabled) return;
    
    currentX.current = e.touches[0].clientX;
    let diff = currentX.current - startX.current;
    
    // Limit swipe based on available actions
    if (!leftAction && diff > 0) diff = 0;
    if (!rightAction && diff < 0) diff = 0;
    
    // Add resistance at edges
    const maxSwipe = threshold * 1.2;
    if (Math.abs(diff) > maxSwipe) {
      diff = diff > 0 ? maxSwipe : -maxSwipe;
    }
    
    setOffset(diff);
  }, [swiping, disabled, leftAction, rightAction, threshold]);

  const handleTouchEnd = useCallback(() => {
    if (!swiping || disabled) return;
    setSwiping(false);
    
    if (Math.abs(offset) >= threshold) {
      // Trigger action
      if (offset > 0 && leftAction) {
        leftAction.onClick();
      } else if (offset < 0 && rightAction) {
        rightAction.onClick();
      }
    }
    
    // Snap back
    setOffset(0);
  }, [swiping, disabled, offset, threshold, leftAction, rightAction]);

  const progress = Math.min(Math.abs(offset) / threshold, 1);
  const isTriggered = Math.abs(offset) >= threshold;

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`} ref={containerRef}>
      {/* Left action background */}
      {leftAction && (
        <div 
          className={`absolute inset-y-0 left-0 flex items-center px-4 ${leftAction.bgColor} transition-opacity`}
          style={{ 
            width: Math.max(offset, 0),
            opacity: offset > 0 ? progress : 0,
          }}
        >
          <div className={`flex items-center gap-2 ${leftAction.color} ${isTriggered && offset > 0 ? 'scale-110' : ''} transition-transform`}>
            {leftAction.icon}
            {offset > 60 && <span className="text-sm font-medium">{leftAction.label}</span>}
          </div>
        </div>
      )}
      
      {/* Right action background */}
      {rightAction && (
        <div 
          className={`absolute inset-y-0 right-0 flex items-center justify-end px-4 ${rightAction.bgColor} transition-opacity`}
          style={{ 
            width: Math.max(-offset, 0),
            opacity: offset < 0 ? progress : 0,
          }}
        >
          <div className={`flex items-center gap-2 ${rightAction.color} ${isTriggered && offset < 0 ? 'scale-110' : ''} transition-transform`}>
            {offset < -60 && <span className="text-sm font-medium">{rightAction.label}</span>}
            {rightAction.icon}
          </div>
        </div>
      )}
      
      {/* Main content */}
      <div
        className="relative bg-[var(--surface)] transition-transform"
        style={{
          transform: `translateX(${offset}px)`,
          transitionDuration: swiping ? '0ms' : '200ms',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeableCard;
