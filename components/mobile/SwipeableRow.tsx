import { useCallback,useRef,useState,type ReactNode,type TouchEvent } from 'react';

export interface SwipeableRowProps {
  children: ReactNode;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  rightLabel?: string;
  leftLabel?: string;
  rightColor?: string;
  leftColor?: string;
  threshold?: number;
}

const SwipeableRow = ({
  children,
  onSwipeRight,
  onSwipeLeft,
  rightLabel = 'Approve',
  leftLabel = 'Reject',
  rightColor = 'bg-green-500',
  leftColor = 'bg-red-500',
  threshold = 80,
}: SwipeableRowProps) => {
  const [translateX, setTranslateX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const translateXRef = useRef(0);
  const directionRef = useRef<'x' | 'y' | null>(null);

  const setOffset = useCallback((offset: number) => {
    translateXRef.current = offset;
    setTranslateX(offset);
  }, []);

  const handleTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    directionRef.current = null;
    setIsSwiping(true);
  }, []);

  const handleTouchMove = useCallback((event: TouchEvent<HTMLDivElement>) => {
    if (!isSwiping) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - startXRef.current;
    const deltaY = touch.clientY - startYRef.current;

    if (!directionRef.current) {
      const movedEnough = Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8;
      if (movedEnough) {
        directionRef.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y';
      }
    }

    if (directionRef.current !== 'x') return;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      event.preventDefault();
    }

    let nextOffset = deltaX;

    if (nextOffset > 0 && !onSwipeRight) nextOffset = 0;
    if (nextOffset < 0 && !onSwipeLeft) nextOffset = 0;

    const maxSwipe = threshold * 1.5;
    nextOffset = Math.max(-maxSwipe, Math.min(maxSwipe, nextOffset));

    setOffset(nextOffset);
  }, [isSwiping, onSwipeLeft, onSwipeRight, setOffset, threshold]);

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping) return;

    const finalOffset = translateXRef.current;

    if (finalOffset >= threshold) {
      onSwipeRight?.();
    } else if (finalOffset <= -threshold) {
      onSwipeLeft?.();
    }

    directionRef.current = null;
    setIsSwiping(false);
    setOffset(0);
  }, [isSwiping, onSwipeLeft, onSwipeRight, setOffset, threshold]);

  const rightReveal = Math.max(translateX, 0);
  const leftReveal = Math.max(-translateX, 0);

  return (
    <div className="relative overflow-x-clip overflow-y-visible">
      {onSwipeRight ? (
        <div
          className={`absolute inset-y-0 left-0 flex items-center px-4 text-sm font-semibold text-white ${rightColor}`}
          style={{
            width: `${rightReveal}px`,
            opacity: rightReveal > 0 ? 1 : 0,
          }}
        >
          <span className="whitespace-nowrap">{rightLabel}</span>
        </div>
      ) : null}

      {onSwipeLeft ? (
        <div
          className={`absolute inset-y-0 right-0 flex items-center justify-end px-4 text-sm font-semibold text-white ${leftColor}`}
          style={{
            width: `${leftReveal}px`,
            opacity: leftReveal > 0 ? 1 : 0,
          }}
        >
          <span className="whitespace-nowrap">{leftLabel}</span>
        </div>
      ) : null}

      <div
        className={`relative z-10 ${isSwiping ? '' : 'transition-transform duration-200 ease-out'}`}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeableRow;
