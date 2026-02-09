import { Activity, AlertTriangle, Calendar, CheckCircle, Clock, Gauge, Target, TrendingUp } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { getServicePrediction, requiresHourmeterTracking } from '../../../services/hourmeterService';
import { Forklift, ServicePrediction } from '../../../types';

const CALENDAR_INTERVAL_DAYS = 90; // Electric: every 90 days

interface ServiceTrackingCardProps {
  forklift: Forklift;
}

export const ServiceTrackingCard: React.FC<ServiceTrackingCardProps> = ({ forklift }) => {
  const [prediction, setPrediction] = useState<ServicePrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const isHourmeterBased = requiresHourmeterTracking(forklift.type);

  useEffect(() => {
    if (isHourmeterBased) {
      getServicePrediction(forklift.forklift_id).then(({ data }) => {
        setPrediction(data);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [forklift.forklift_id, forklift.type, isHourmeterBased]);

  if (loading) return <div className="animate-pulse h-32 bg-slate-100 rounded-xl" />;

  // Calendar-based logic for electric forklifts
  const calendarData = !isHourmeterBased ? (() => {
    const lastService = forklift.last_service_date ? new Date(forklift.last_service_date) : null;
    const nextServiceDate = lastService 
      ? new Date(lastService.getTime() + CALENDAR_INTERVAL_DAYS * 24 * 60 * 60 * 1000)
      : null;
    const today = new Date();
    const daysRemaining = nextServiceDate 
      ? Math.ceil((nextServiceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    return { lastService, nextServiceDate, daysRemaining };
  })() : null;

  // Determine status
  let isOverdue: boolean;
  let isDueSoon: boolean;
  let daysRemaining: number | null;

  if (isHourmeterBased) {
    const hoursRemaining = prediction?.hours_until_service ? Number(prediction.hours_until_service) : null;
    isOverdue = hoursRemaining !== null && hoursRemaining <= 0;
    isDueSoon = prediction?.days_remaining !== undefined && prediction.days_remaining <= 7 && !isOverdue;
    daysRemaining = prediction?.days_remaining ?? null;
  } else {
    daysRemaining = calendarData?.daysRemaining ?? null;
    isOverdue = daysRemaining !== null && daysRemaining <= 0;
    isDueSoon = daysRemaining !== null && daysRemaining <= 7 && !isOverdue;
  }

  const borderColor = isOverdue ? 'border-red-300 bg-red-50' : isDueSoon ? 'border-orange-300 bg-orange-50' : 'border-green-300 bg-green-50';
  const statusIcon = isOverdue ? <AlertTriangle className="w-5 h-5 text-red-600" /> : isDueSoon ? <Clock className="w-5 h-5 text-orange-600" /> : <CheckCircle className="w-5 h-5 text-green-600" />;
  const statusText = isOverdue ? 'OVERDUE' : isDueSoon ? 'Due Soon' : 'OK';
  const statusColor = isOverdue ? 'text-red-700 bg-red-100' : isDueSoon ? 'text-orange-700 bg-orange-100' : 'text-green-700 bg-green-100';

  const hoursRemaining = prediction?.hours_until_service ? Number(prediction.hours_until_service) : null;

  return (
    <div className={`rounded-xl shadow-sm border-2 ${borderColor} overflow-hidden`}>
      <div className="px-5 py-3 border-b border-inherit flex justify-between items-center">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" /> Service Tracking
          <span className="text-xs font-normal text-slate-500">
            ({isHourmeterBased ? 'Hourmeter-based' : 'Calendar-based'})
          </span>
        </h3>
        <div className="flex items-center gap-2">
          {statusIcon}
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusColor}`}>
            {statusText}
          </span>
        </div>
      </div>

      <div className="p-5">
        {isHourmeterBased ? (
          /* ===== HOURMETER-BASED (Diesel/LPG/Petrol) ===== */
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <div className="flex items-center gap-1 mb-1">
                  <Gauge className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-xs font-medium text-slate-500">Current</span>
                </div>
                <p className="text-xl font-bold text-slate-800">{forklift.hourmeter.toLocaleString()}</p>
                <p className="text-xs text-slate-400">hours</p>
              </div>

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

            <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>Service Interval: {forklift.service_interval_hours || 500} hours</span>
              {hoursRemaining !== null && !isOverdue && (
                <span>{prediction?.days_remaining} days remaining</span>
              )}
            </div>
          </>
        ) : (
          /* ===== CALENDAR-BASED (Electric) ===== */
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <div className="flex items-center gap-1 mb-1">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-xs font-medium text-slate-500">Last Service</span>
                </div>
                <p className="text-xl font-bold text-slate-800">
                  {calendarData?.lastService
                    ? calendarData.lastService.toLocaleDateString()
                    : '—'}
                </p>
                <p className="text-xs text-slate-400">
                  {calendarData?.lastService
                    ? `${Math.floor((Date.now() - calendarData.lastService.getTime()) / (1000 * 60 * 60 * 24))} days ago`
                    : 'No record'}
                </p>
              </div>

              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <div className="flex items-center gap-1 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-xs font-medium text-slate-500">Next Service</span>
                </div>
                <p className="text-xl font-bold text-slate-800">
                  {calendarData?.nextServiceDate
                    ? calendarData.nextServiceDate.toLocaleDateString()
                    : '—'}
                </p>
                <p className="text-xs text-slate-400">
                  {calendarData?.daysRemaining !== null && calendarData?.daysRemaining !== undefined
                    ? isOverdue
                      ? `${Math.abs(calendarData.daysRemaining)} days overdue`
                      : `${calendarData.daysRemaining} days remaining`
                    : 'Not scheduled'}
                </p>
              </div>

              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <div className="flex items-center gap-1 mb-1">
                  <Gauge className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-xs font-medium text-slate-500">Hourmeter</span>
                </div>
                <p className="text-xl font-bold text-slate-800">
                  {forklift.hourmeter ? forklift.hourmeter.toLocaleString() : '—'}
                </p>
                <p className="text-xs text-slate-400">hours (reference only)</p>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>Service Interval: Every {CALENDAR_INTERVAL_DAYS} days (3 months)</span>
              {daysRemaining !== null && !isOverdue && (
                <span>{daysRemaining} days remaining</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
