import React from 'react';
import { StatusCounts } from '../types';

interface UtilizationRingProps {
  statusCounts: StatusCounts;
}

/**
 * UtilizationRing - SVG donut chart showing fleet utilization at a glance
 * Segments: Rented (green), In Service (blue), Service Due (amber), Available (slate), Out of Service (red)
 */
export const UtilizationRing: React.FC<UtilizationRingProps> = ({ statusCounts }) => {
  const total = statusCounts.total || 1;
  const utilizationRate = Math.round(((statusCounts.rented_out) / total) * 100);

  const segments = [
    { key: 'rented_out', count: statusCounts.rented_out, color: '#16a34a', label: 'Rented Out' },
    { key: 'in_service', count: statusCounts.in_service, color: '#2563eb', label: 'In Service' },
    { key: 'service_due', count: statusCounts.service_due, color: '#d97706', label: 'Service Due' },
    { key: 'available', count: statusCounts.available, color: '#94a3b8', label: 'Available' },
    { key: 'awaiting_parts', count: statusCounts.awaiting_parts, color: '#7c3aed', label: 'Awaiting Parts' },
    { key: 'reserved', count: statusCounts.reserved, color: '#0891b2', label: 'Reserved' },
    { key: 'out_of_service', count: statusCounts.out_of_service, color: '#dc2626', label: 'Out of Service' },
  ].filter(s => s.count > 0);

  // SVG donut params
  const size = 160;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;

  return (
    <div className="flex items-center gap-8">
      {/* Ring */}
      <div className="relative flex-shrink-0">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />
          {/* Segments */}
          {segments.map((segment) => {
            const segmentLength = (segment.count / total) * circumference;
            const offset = currentOffset;
            currentOffset += segmentLength;

            return (
              <circle
                key={segment.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                className="transition-all duration-700 ease-out"
              />
            );
          })}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-theme">{utilizationRate}%</span>
          <span className="text-xs text-theme-muted">Utilized</span>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        {segments.map((segment) => (
          <div key={segment.key} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: segment.color }}
            />
            <span className="text-sm text-theme-muted whitespace-nowrap">
              {segment.label}
            </span>
            <span className="text-sm font-semibold text-theme">{segment.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
