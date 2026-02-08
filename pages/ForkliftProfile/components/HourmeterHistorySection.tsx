import { AlertCircle,ChevronRight,FileText,Gauge,User as UserIcon } from 'lucide-react';
import React,{ useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface HourmeterEntry {
  entry_id?: string;
  reading: number;
  previous_reading: number | null;
  hours_since_last: number;
  recorded_by_name: string;
  source: string;
  recorded_at: string;
  was_amended?: boolean;
  job?: {
    job_id: string;
    title: string;
  };
}

interface HourmeterHistorySectionProps {
  history: HourmeterEntry[];
}

export const HourmeterHistorySection: React.FC<HourmeterHistorySectionProps> = ({ history }) => {
  const navigate = useNavigate();
  const [showHistory, setShowHistory] = useState(false);

  const getSourceBadge = (source: string) => {
    const styles: Record<string, string> = {
      'manual': 'bg-purple-100 text-purple-700',
      'amendment': 'bg-amber-100 text-amber-700',
      'job_start': 'bg-blue-100 text-blue-700',
    };
    const labels: Record<string, string> = {
      'manual': 'Direct Edit',
      'amendment': 'Amendment',
      'job_start': 'Job',
    };
    return {
      className: styles[source] || 'bg-slate-100 text-slate-700',
      label: labels[source] || source,
    };
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="w-full px-5 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center hover:bg-slate-100 transition"
      >
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Gauge className="w-5 h-5 text-purple-600" /> Hourmeter History ({history.length})
        </h3>
        <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${showHistory ? 'rotate-90' : ''}`} />
      </button>

      {showHistory && (
        <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
          {history.length > 0 ? (
            history.map((entry, index) => {
              const badge = getSourceBadge(entry.source);
              return (
                <div
                  key={entry.entry_id || index}
                  className="p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-bold text-slate-800">
                          {entry.reading?.toLocaleString()} hrs
                        </span>
                        {entry.previous_reading !== null && (
                          <span className={`text-sm font-medium ${
                            entry.hours_since_last >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            ({entry.hours_since_last >= 0 ? '+' : ''}{entry.hours_since_last} hrs)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <UserIcon className="w-3 h-3" />
                        {entry.recorded_by_name}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                      <div className="text-xs text-slate-400 mt-1">
                        {new Date(entry.recorded_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  {entry.job && (
                    <div
                      onClick={() => navigate(`/jobs/${entry.job!.job_id}`)}
                      className="mt-2 pt-2 border-t border-slate-100 text-xs text-blue-600 hover:text-blue-800 cursor-pointer flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3" />
                      {entry.job.title}
                    </div>
                  )}
                  {entry.was_amended && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <span className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        This was an amended reading
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 text-slate-400">
              <Gauge className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No hourmeter history recorded</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
