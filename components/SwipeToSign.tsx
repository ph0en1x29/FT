import React, { useRef, useState, useEffect } from 'react';
import { Check } from 'lucide-react';

interface SwipeToSignProps {
  onSign: () => void;
  disabled?: boolean;
  signed?: boolean;
  label?: string;
}

export const SwipeToSign: React.FC<SwipeToSignProps> = ({
  onSign,
  disabled = false,
  signed = false,
  label = 'Swipe to Sign →',
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(0);
  const [completed, setCompleted] = useState(signed);

  const COMPLETION_THRESHOLD = 0.85;
  const THUMB_SIZE = 48; // 48px minimum for touch targets

  useEffect(() => {
    if (signed) {
      setCompleted(true);
      setPosition(1);
    }
  }, [signed]);

  const getProgress = (clientX: number): number => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const maxTravel = rect.width - THUMB_SIZE;
    const traveled = Math.max(0, Math.min(clientX - rect.left - THUMB_SIZE / 2, maxTravel));
    return traveled / maxTravel;
  };

  const handleStart = (clientX: number) => {
    if (disabled || completed) return;
    setIsDragging(true);
    const progress = getProgress(clientX);
    setPosition(progress);
  };

  const handleMove = (clientX: number) => {
    if (!isDragging || disabled || completed) return;
    const progress = getProgress(clientX);
    setPosition(progress);
  };

  const handleEnd = () => {
    if (!isDragging || disabled || completed) return;
    setIsDragging(false);

    if (position >= COMPLETION_THRESHOLD) {
      setCompleted(true);
      setPosition(1);
      onSign();
    } else {
      setPosition(0);
    }
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX);
    };

    const handleMouseUp = () => {
      handleEnd();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, position]);

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      handleStart(e.touches[0].clientX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = () => {
    handleEnd();
  };

  return (
    <div className="w-full">
      <div
        ref={trackRef}
        className={`relative h-14 rounded-full overflow-hidden touch-none select-none ${
          completed
            ? 'bg-[var(--success)]'
            : 'bg-[var(--bg-subtle)]'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        style={{
          transition: isDragging ? 'none' : 'background-color 0.3s ease',
        }}
      >
        {/* Label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span
            className={`text-sm font-medium transition-all duration-200 ${
              completed
                ? 'text-white'
                : position > 0.3
                ? 'opacity-0'
                : 'text-[var(--text-muted)]'
            }`}
          >
            {completed ? (
              <span className="flex items-center gap-2">
                <Check className="w-4 h-4" />
                Signed ✓
              </span>
            ) : (
              label
            )}
          </span>
        </div>

        {/* Thumb */}
        <div
          ref={thumbRef}
          className={`absolute top-1 left-1 rounded-full flex items-center justify-center ${
            completed ? 'bg-white' : 'bg-[var(--accent)]'
          } shadow-lg`}
          style={{
            width: `${THUMB_SIZE}px`,
            height: `${THUMB_SIZE}px`,
            transform: `translateX(${
              position * (trackRef.current ? trackRef.current.offsetWidth - THUMB_SIZE - 8 : 0)
            }px)`,
            transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {completed ? (
            <Check className="w-5 h-5 text-[var(--success)]" />
          ) : (
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
};
