import { Activity, AlertTriangle, CheckCircle, Clock, Gauge, Target, TrendingUp } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { getServicePrediction, requiresHourmeterTracking } from '../../../services/hourmeterService';
import { Forklift, ServicePrediction } from '../../../types';

interface ServiceTrackingCardProps {
  forklift: Forklift;
}

export const ServiceTrackingCard: React.FC<ServiceTrackingCardProps> = ({ forklift }) => {
  const [prediction, setPrediction] = useState<ServicePrediction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requiresHourmeterTracking(forklift.type)) {
      setLoading(false);
      return;
    }
    
    getServicePrediction(forklift.forklift_id).then(({ data }) => {
      setPrediction(data);
      setLoading(false);
    });
  }, [forklift.forklift_id, forklift.type]);

  if (!requiresHourmeterTracking(forklift.type)) return null;
  if (loading) return <div className="animate-pulse h-32 bg-slate-100 rounded-xl" />;

  const hoursRemaining = prediction?.hours_until_service ? Number(prediction.hours_until_service) : null;
  const isOverdue = hoursRemaining !== null && hoursRemaining <= 0;
  const isDueSoon = prediction?.days_remaining !== undefined && prediction.days_remaining <= 7 && !isOverdue;

  const borderColor = isOverdue ? 'border-red-300 bg-red-50' : isDueSoon ? 'border-orange-300 bg-orange-50' : 'border-green-300 bg-green-50';
  const statusIcon = isOverdue ? <AlertTriangle className="w-5 h-5 text-red-600" /> : isDueSoon ? <Clock className="w-5 h-5 text-orange-600" /> : <CheckCircle className="w-5 h-5 text-green-600" />;
  const statusText = isOverdue ? 'OVERDUE' : isDueSoon ? 'Due Soon' : 'OK';
  const statusColor = isOverdue ? 'text-red-700 bg-red-100' : isDueSoon ? 'text-orange-700 bg-orange-100' : 'text-green-700 bg-green-100';

  return (
    <div className={`rounded-xl shadow-sm border-2 ${borderColor} overflow-hidden`}>
      <div className="px-5 py-3 border-b border-inherit flex justify-between items-center">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" /> Service Tracking
        </h3>
        <div className="flex items-center gap-2">
          {statusIcon}
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColor}`}>
            {statusText}
          </span>
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Current Hourmeter */}
          <div className="bg-white rounded-lg p-3 border border-slate-200">
            <div className="flex items-center gap-1 mb-1">
              <Gauge className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-xs font-medium text-slate-500">Current</span>
            </div>
            <p className="text-xl font-bold text-slate-800">{forklift.hourmeter.toLocaleString()}</p>
            <p className="text-xs text-slate-400">hours</p>
          </div>

          {/* Last Service */}
          <div className="bg-white rounded-lg p-3 border border-slate-200">
            <div className="flex items-center gap-1 mb-1">
              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              <span className="text-xs font-medium text-slate-500">Last Service</span>
            </div>
            <p className="text-xl font-bold text-slate-800">
              {forklift.last_service_hourmeter ? forklift.last_service_hourmeter.toLocaleString() : '—'}
            </p>
            <p className="text-xs text-slate-400">
              {forklift.last_service_date
                ? new Date(forklift.last_service_date).toLocaleDateString()
                : 'No record'}
            </p>
          </div>

          {/* Next Target */}
          <div className="bg-white rounded-lg p-3 border border-slate-200">
            <div className="flex items-center gap-1 mb-1">
              <Target className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-xs font-medium text-slate-500">Next Service</span>
            </div>
            <p className="text-xl font-bold text-slate-800">
              {prediction?.next_service_hourmeter
                ? Number(prediction.next_service_hourmeter).toLocaleString()
                : forklift.next_target_service_hour
                  ? forklift.next_target_service_hour.toLocaleString()
                  : '—'}
            </p>
            <p className="text-xs text-slate-400">
              {hoursRemaining !== null
                ? isOverdue
                  ? `${Math.abs(hoursRemaining)} hrs overdue`
                  : `${hoursRemaining} hrs remaining`
                : 'hours'}
            </p>
          </div>

          {/* Predicted Date */}
          <div className="bg-white rounded-lg p-3 border border-slate-200">
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-xs font-medium text-slate-500">Predicted Date</span>
            </div>
            <p className="text-xl font-bold text-slate-800">
              {prediction?.predicted_date && !isOverdue
                ? new Date(prediction.predicted_date).toLocaleDateString()
                : isOverdue
                  ? 'Now'
                  : '—'}
            </p>
            <p className="text-xs text-slate-400">
              {prediction?.avg_daily_hours
                ? `~${prediction.avg_daily_hours} hrs/day`
                : ''}
              {prediction?.confidence
                ? ` • ${prediction.confidence} confidence`
                : ''}
            </p>
          </div>
        </div>

        {/* Service Interval Info */}
        <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Service Interval: {forklift.service_interval_hours || 500} hours</span>
          {hoursRemaining !== null && !isOverdue && (
            <span>{prediction?.days_remaining} days remaining</span>
          )}
        </div>
      </div>
    </div>
  );
};
