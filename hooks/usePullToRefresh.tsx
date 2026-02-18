import { ArrowDown,Loader2 } from 'lucide-react';
import { useCallback,useRef,useState,type TouchEvent } from 'react';
import React from "react";

type PullToRefreshHandlers = {
  onTouchStart: (event: TouchEvent<HTMLElement>) => void;
  onTouchMove: (event: TouchEvent<HTMLElement>) => void;
  onTouchEnd: () => void;
};

interface UsePullToRefreshResult {
  pullToRefreshProps: PullToRefreshHandlers;
  isRefreshing: boolean;
  PullIndicator: () => React.ReactElement | null;
}

const THRESHOLD_PX = 60;
const MAX_PULL_PX = 120;

const usePullToRefresh = (onRefresh: () => Promise<void>): UsePullToRefreshResult => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const startYRef = useRef(0);
  const canPullRef = useRef(false);
  const pullDistanceRef = useRef(0);

  const setDistance = useCallback((distance: number) => {
    pullDistanceRef.current = distance;
    setPullDistance(distance);
  }, []);

  const resetPullState = useCallback(() => {
    canPullRef.current = false;
    setIsPulling(false);
    setDistance(0);
  }, [setDistance]);

  const handleTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
    if (isRefreshing) return;

    const container = event.currentTarget;
    const isAtTop = container.scrollTop <= 0 && window.scrollY <= 0;
    if (!isAtTop) {
      canPullRef.current = false;
      return;
    }

    startYRef.current = event.touches[0].clientY;
    canPullRef.current = true;
    setIsPulling(true);
    setDistance(0);
  }, [isRefreshing, setDistance]);

  const handleTouchMove = useCallback((event: TouchEvent<HTMLElement>) => {
    if (!canPullRef.current || isRefreshing) return;

    const currentY = event.touches[0].clientY;
    const deltaY = currentY - startYRef.current;

    if (deltaY <= 0) {
      setDistance(0);
      return;
    }

    const resistedDistance = Math.min(deltaY * 0.6, MAX_PULL_PX);
    setDistance(resistedDistance);
    event.preventDefault();
  }, [isRefreshing, setDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!canPullRef.current || isRefreshing) {
      resetPullState();
      return;
    }

    const shouldRefresh = pullDistanceRef.current >= THRESHOLD_PX;
    if (!shouldRefresh) {
      resetPullState();
      return;
    }

    setIsRefreshing(true);
    setIsPulling(false);
    setDistance(THRESHOLD_PX);

    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
      resetPullState();
    }
  }, [isRefreshing, onRefresh, resetPullState, setDistance]);

  const progress = Math.min(pullDistance / THRESHOLD_PX, 1);
  const showIndicator = isPulling || isRefreshing;

  const PullIndicator = () => {
    if (!showIndicator) return null;

    return (
      <div className="sticky top-0 z-10 flex justify-center py-3 pointer-events-none">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-theme bg-theme-card text-theme shadow-sm">
          {isRefreshing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ArrowDown
              className="h-5 w-5 transition-transform duration-100"
              style={{ transform: `rotate(${progress * 180}deg)` }}
            />
          )}
        </div>
      </div>
    );
  };

  return {
    pullToRefreshProps: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    isRefreshing,
    PullIndicator,
  };
};

export default usePullToRefresh;
