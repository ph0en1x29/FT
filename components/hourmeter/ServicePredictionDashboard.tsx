/**
 * Service Prediction Dashboard Widget
 * Shows upcoming service predictions grouped by urgency
 */

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Calendar, RefreshCw, Wrench } from 'lucide-react';
import { getServicePredictionDashboard } from '../../services/hourmeterService';
import { ServicePredictionCard } from './ServicePredictionCard';
import type { ServicePredictionDashboard as DashboardData } from '../../types';

interface ServicePredictionDashboardProps {
  onForkliftClick?: (forkliftId: string) => void;
  refreshTrigger?: number;
}

export function ServicePredictionDashboard({ 
  onForkliftClick,
  refreshTrigger 
}: ServicePredictionDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    const { data: dashboardData, error: fetchError } = await getServicePredictionDashboard();
    
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setData(dashboardData);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 text-gray-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center py-8">
          <p className="text-red-600 text-sm">{error}</p>
          <button 
            onClick={fetchData}
            className="mt-2 text-blue-600 text-sm hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { overdue, due_this_week, upcoming_two_weeks, total_engine_forklifts } = data;
  const hasAnyPredictions = overdue.length > 0 || due_this_week.length > 0 || upcoming_two_weeks.length > 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Wrench className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Service Predictions</h2>
              <p className="text-sm text-gray-500">
                Based on hourmeter usage patterns
              </p>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 divide-x divide-gray-200 border-b border-gray-200">
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-bold text-2xl">{overdue.length}</span>
          </div>
          <p className="text-xs text-gray-500">Overdue</p>
        </div>
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-orange-600 mb-1">
            <Clock className="h-4 w-4" />
            <span className="font-bold text-2xl">{due_this_week.length}</span>
          </div>
          <p className="text-xs text-gray-500">Due This Week</p>
        </div>
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-1 text-yellow-600 mb-1">
            <Calendar className="h-4 w-4" />
            <span className="font-bold text-2xl">{upcoming_two_weeks.length}</span>
          </div>
          <p className="text-xs text-gray-500">Next 2 Weeks</p>
        </div>
      </div>

      {/* Forklift Lists */}
      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
        {!hasAnyPredictions ? (
          <div className="text-center py-8 text-gray-500">
            <Wrench className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No upcoming services predicted</p>
            <p className="text-xs mt-1">
              {total_engine_forklifts} engine-based forklifts being tracked
            </p>
          </div>
        ) : (
          <>
            {/* Overdue */}
            {overdue.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Overdue
                </h3>
                <div className="space-y-2">
                  {overdue.map(forklift => (
                    <ServicePredictionCard
                      key={forklift.forklift_id}
                      forklift={forklift}
                      onClick={() => onForkliftClick?.(forklift.forklift_id)}
                      compact
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Due This Week */}
            {due_this_week.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Due This Week
                </h3>
                <div className="space-y-2">
                  {due_this_week.map(forklift => (
                    <ServicePredictionCard
                      key={forklift.forklift_id}
                      forklift={forklift}
                      onClick={() => onForkliftClick?.(forklift.forklift_id)}
                      compact
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming */}
            {upcoming_two_weeks.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-yellow-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Next 2 Weeks
                </h3>
                <div className="space-y-2">
                  {upcoming_two_weeks.map(forklift => (
                    <ServicePredictionCard
                      key={forklift.forklift_id}
                      forklift={forklift}
                      onClick={() => onForkliftClick?.(forklift.forklift_id)}
                      compact
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          Tracking {total_engine_forklifts} engine-based forklifts (Diesel, LPG, Petrol)
        </p>
      </div>
    </div>
  );
}

export default ServicePredictionDashboard;
