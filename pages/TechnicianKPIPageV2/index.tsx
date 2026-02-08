import { Filter,RefreshCw,Users } from 'lucide-react';
import React,{ useState } from 'react';
import {
BenchmarksLegend,
FilterPanel,
TeamSummaryCards,
TechnicianCard,
} from './components';
import { useKPIData } from './hooks/useKPIData';
import { DateRange,TechnicianKPIPageProps } from './types';

const TechnicianKPIPage: React.FC<TechnicianKPIPageProps> = ({ currentUser, hideHeader = false }) => {
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [expandedTech, setExpandedTech] = useState<string | null>(null);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const { loading, technicianKPIs, teamTotals, loadData } = useKPIData(
    currentUser,
    dateRange,
    customStartDate,
    customEndDate
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading KPI data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-theme">Technician KPI Dashboard</h1>
            <p className="text-theme-muted text-sm">Performance metrics and industry benchmarks</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-3 py-2 border border-theme rounded-lg text-sm flex items-center gap-2 hover:bg-theme-surface-2 text-theme-muted theme-transition"
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <button
              onClick={loadData}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-2 hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <FilterPanel
          dateRange={dateRange}
          setDateRange={setDateRange}
          customStartDate={customStartDate}
          setCustomStartDate={setCustomStartDate}
          customEndDate={customEndDate}
          setCustomEndDate={setCustomEndDate}
        />
      )}

      {/* Team Summary Cards */}
      <TeamSummaryCards teamTotals={teamTotals} />

      {/* Industry Benchmarks Legend */}
      <BenchmarksLegend />

      {/* Technician Cards */}
      <div className="space-y-4">
        {technicianKPIs.map((kpi, index) => (
          <TechnicianCard
            key={kpi.technician_id}
            kpi={kpi}
            index={index}
            isExpanded={expandedTech === kpi.technician_id}
            onToggle={() => setExpandedTech(expandedTech === kpi.technician_id ? null : kpi.technician_id)}
          />
        ))}
      </div>

      {technicianKPIs.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center border border-slate-200">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No technician data available for the selected period</p>
        </div>
      )}
    </div>
  );
};

export default TechnicianKPIPage;
