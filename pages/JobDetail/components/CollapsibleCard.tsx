import { ChevronDown } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface CollapsibleCardProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  summary?: string;
  children: React.ReactNode;
}

export const CollapsibleCard: React.FC<CollapsibleCardProps> = ({
  title,
  icon,
  defaultOpen = true,
  summary,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | 'auto'>(defaultOpen ? 'auto' : 0);
  const [transitioning, setTransitioning] = useState(false);

  const toggle = () => {
    const el = contentRef.current;
    if (!el || transitioning) return;

    if (open) {
      // Snap to exact height, then animate to 0
      setHeight(el.scrollHeight);
      setTransitioning(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setHeight(0);
          setOpen(false);
        });
      });
    } else {
      // Animate from 0 to scrollHeight
      setHeight(el.scrollHeight);
      setTransitioning(true);
      setOpen(true);
    }
  };

  const handleTransitionEnd = () => {
    setTransitioning(false);
    if (open) setHeight('auto'); // Allow natural resize when content changes
  };

  return (
    <div>
      {/* Collapsible header */}
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-1 py-2 mb-1 text-left focus:outline-none group"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon && (
            <span className="shrink-0 text-[var(--text-muted)] group-hover:text-[var(--text)] transition-colors">
              {icon}
            </span>
          )}
          <span className="font-semibold text-sm text-[var(--text-secondary)] group-hover:text-[var(--text)] transition-colors">
            {title}
          </span>
          {!open && summary && (
            <span className="text-xs text-[var(--text-muted)] truncate ml-1">— {summary}</span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-[var(--text-muted)] transition-transform duration-300 ml-2 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Animated content */}
      <div
        ref={contentRef}
        style={{
          height: height === 'auto' ? 'auto' : `${height}px`,
          overflow: height === 'auto' ? 'visible' : 'hidden',
          transition: transitioning ? 'height 0.28s cubic-bezier(0.4,0,0.2,1)' : undefined,
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        {children}
      </div>
    </div>
  );
};
