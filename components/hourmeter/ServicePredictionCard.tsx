/**
 * Service Prediction Card Component
 * Displays service prediction information for a forklift
 */

import React from 'react';
import { Calendar, Clock, TrendingUp, AlertTriangle, CheckCircle, Gauge } from 'lucide-react';
import type { ForkliftWithPrediction, ServiceUrgency } from '../../types';
import { formatDaysRemaining, getUrgencyColor } from '../../services/hourmeterService';

interface ServicePredictionCardProps {
  forklift: ForkliftWithPrediction;
  onClick?: () => void;
  compact?: boolean;
}

const urgencyConfig: Record<ServiceUrgency, { 
  icon: typeof AlertTriangle; 
  label: string; 
  bgClass: string;
  borderClass: string;
}> = {
  overdue: { 
    icon: AlertTriangle, 
    label: 'Overdue', 
    bgClass: 'bg-red-50',
    borderClass: 'border-red-200'
  },
  due_soon: { 
    icon: Clock, 
    label: 'Due Soon', 
    bgClass: 'bg-orange-50',
    borderClass: 'border-orange-200'
  },
  upcoming: { 
    icon: Calendar, 
    label: 'Upcoming', 
    bgClass: 'bg-yellow-50',
    borderClass: 'border-yellow-200'
  },
  ok: { 
    icon: CheckCircle, 
    label: 'On Track', 
    bgClass: 'bg-green-50',
    borderClass: 'border-green-200'
  },
};

export function ServicePredictionCard({ 
  forklift, 
  onClick,
  compact = false 
}: ServicePredictionCardProps) {
  const urgency = (forklift.service_urgency || 'ok') as ServiceUrgency;
  const config = urgencyConfig[urgency];
  const UrgencyIcon = config.icon;

  if (compact) {
    return (
      <div 
        onClick={onClick}
        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${config.bgClass} ${config.borderClass}`}
      >
        <div className="flex items-center gap-3">
          <UrgencyIcon className={`h-5 w-5 ${getUrgencyColor(urgency).split(' ')[0]}`} />
          <div>
            <p className="font-medium text-gray-900 text-sm">
              {forklift.serial_number}
            </p>
            <p className="text-xs text-gray-500">
              {forklift.make} {forklift.model}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className={`font-semibold text-sm ${getUrgencyColor(urgency).split(' ')[0]}`}>
            {formatDaysRemaining(forklift.days_remaining || 0)}
          </p>
          {forklift.predicted_date && (
            <p className="text-xs text-gray-500">
              {new Date(forklift.predicted_date).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={onClick}
      className={`rounded-lg border p-4 cursor-pointer hover:shadow-lg transition-all ${config.bgClass} ${config.borderClass}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{forklift.serial_number}</h3>
          <p className="text-sm text-gray-500">
            {forklift.make} {forklift.model}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getUrgencyColor(urgency)}`}>
          <UrgencyIcon className="h-3 w-3" />
          {config.label}
        </span>
      </div>

      {/* Prediction Info */}
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <p className="text-xs text-gray-500 mb-1">Predicted Service</p>
          <p className="font-medium text-gray-900">
            {forklift.predicted_date 
              ? new Date(forklift.predicted_date).toLocaleDateString()
              : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Days Remaining</p>
          <p className={`font-bold ${getUrgencyColor(urgency).split(' ')[0]}`}>
            {formatDaysRemaining(forklift.days_remaining || 0)}
          </p>
        </div>
      </div>

      {/* Hourmeter Info */}
      <div className="bg-white/50 rounded-md p-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 flex items-center gap-1">
            <Gauge className="h-4 w-4" />
            Current
          </span>
          <span className="font-medium">
            {forklift.current_hourmeter?.toLocaleString() || 0} hrs
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Next Service At</span>
          <span className="font-medium">
            {forklift.next_service_hourmeter?.toLocaleString() || 'N/A'} hrs
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Hours Until Service</span>
          <span className={`font-medium ${
            (forklift.hours_until_service || 0) <= 0 ? 'text-red-600' : ''
          }`}>
            {forklift.hours_until_service?.toFixed(0) || 0} hrs
          </span>
        </div>
      </div>

      {/* Usage Pattern */}
      {forklift.avg_daily_hours && (
        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Avg Usage: {forklift.avg_daily_hours} hrs/day
          </span>
          <span className={`px-2 py-0.5 rounded ${
            forklift.confidence === 'high' ? 'bg-green-100 text-green-700' :
            forklift.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {forklift.confidence || 'low'} confidence
          </span>
        </div>
      )}
    </div>
  );
}

export default ServicePredictionCard;
