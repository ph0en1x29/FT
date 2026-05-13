/* eslint-disable max-lines */
import {
  AlertOctagon,
  AlertTriangle,
  CalendarPlus,
  CheckCircle,
  ChevronRight,
  Clock,
  Info,
  Loader2,
  MapPin,
  Minus,
  Play,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDevModeContext } from '../../../contexts/DevModeContext';
import { getFleetServiceOverview, getForkliftDailyUsage } from '../../../services/serviceTrackingService';
import { supabase } from '../../../services/supabaseClient';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { DailyUsageResult, FleetServiceOverview, UserRole } from '../../../types';
import { ForkliftDue, TabProps } from '../types';

/**
 * Service Due tab column visibility flags. Columns hidden by default per
 * 2026-05-13 spec (less clutter, room for Site Location column). Power users
 * can flip these to re-enable individual columns until a UI toggle ships.
 */
const COLUMN_VISIBILITY = {
  type: false,
  lastServiced: false,
  progress: false,
};

const VALID_FILTERS = ['all', 'overdue', 'due_soon', 'job_created', 'stale'] as const;
type FilterType = typeof VALID_FILTERS[number];

const OWNERSHIP_FILTERS = ['all', 'fleet', 'amc', 'no_contract'] as const;
type OwnershipFilter = typeof OWNERSHIP_FILTERS[number];

const OWNERSHIP_LABELS: Record<OwnershipFilter, string> = {
  all: 'All ownership',
  fleet: 'Fleet (Acwer-owned)',
  amc: 'Customer · AMC',
  no_contract: 'Customer · No contract',
};

const ServiceDueTab: React.FC<TabProps> = ({ currentUser: _currentUser }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlFilter = searchParams.get('filter');
  const initialFilter: FilterType = urlFilter && VALID_FILTERS.includes(urlFilter as FilterType)
    ? (urlFilter as FilterType)
    : 'all';
  const [loading, setLoading] = useState(true);
  const [dueForklifts, setDueForklifts] = useState<ForkliftDue[]>([]);
  const [fleetOverview, setFleetOverview] = useState<FleetServiceOverview[]>([]);
  const [dailyUsage, setDailyUsage] = useState<Record<string, DailyUsageResult>>({});
  const [siteByForkliftId, setSiteByForkliftId] = useState<Record<string, { site: string | null; current_site_id: string | null }>>({});
  const [filter, setFilter] = useState<FilterType>(initialFilter);
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>('all');
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [timeWindow, setTimeWindow] = useState<number>(30);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'urgency' | 'name' | 'hours' | 'site'>('urgency');

  // Guards against stale loadSiteData responses overwriting newer ones if the
  // user changes timeWindow rapidly.
  const siteLoadIdRef = useRef(0);

  const { displayRole } = useDevModeContext();

  const isAdmin = [
    UserRole.ADMIN,
    UserRole.ADMIN_SERVICE,
    UserRole.ADMIN_STORE,
    UserRole.SUPERVISOR,
  ].includes(displayRole);

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeWindow]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [forklifts, overview] = await Promise.all([
        MockDb.getForkliftsDueForService(timeWindow),
        getFleetServiceOverview()
      ]);
      setDueForklifts(forklifts);
      setFleetOverview(overview);
      const ids = [...new Set([
        ...forklifts.map((f: ForkliftDue) => f.forklift_id),
        ...overview.map(o => o.forklift_id),
      ])];
      // Fire-and-forget — both helpers self-cancel via their request-id refs.
      loadDailyUsage(overview.map(f => f.forklift_id));
      loadSiteData(ids);
    } catch (_e) {
      showToast.error('Failed to load service due data');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Hydrate site_name + current_site_id for the displayed forklifts. The
   * prediction view and fleet overview view don't expose these fields, so we
   * fetch them directly from the forklifts table (2026-05-13).
   * Stale-response guarded via siteLoadIdRef so rapid timeWindow changes
   * don't overwrite a newer response with an older one.
   */
  const loadSiteData = async (forkliftIds: string[]) => {
    if (forkliftIds.length === 0) {
      setSiteByForkliftId({});
      return;
    }
    const myId = ++siteLoadIdRef.current;
    const { data, error } = await supabase
      .from('forklifts')
      .select('forklift_id, site, current_site_id')
      .in('forklift_id', forkliftIds);
    if (myId !== siteLoadIdRef.current) return; // stale — newer request in flight
    if (error || !data) return;
    const map: Record<string, { site: string | null; current_site_id: string | null }> = {};
    data.forEach((r: { forklift_id: string; site: string | null; current_site_id: string | null }) => {
      map[r.forklift_id] = { site: r.site, current_site_id: r.current_site_id };
    });
    setSiteByForkliftId(map);
  };
  
  const loadDailyUsage = async (forkliftIds: string[]) => {
    const usageMap: Record<string, DailyUsageResult> = {};
    for (let i = 0; i < forkliftIds.length; i += 5) {
      const batch = forkliftIds.slice(i, i + 5);
      const results = await Promise.all(
        batch.map(id => getForkliftDailyUsage(id, 365).catch(() => null))
      );
      batch.forEach((id, idx) => {
        if (results[idx]) usageMap[id] = results[idx]!;
      });
    }
    setDailyUsage(usageMap);
  };

  const runDailyCheck = async () => {
    setRunning(true);
    setLastResult(null);
    try {
      const result = await MockDb.runDailyServiceCheck();
      setLastResult(`Created ${result.jobs_created} jobs, ${result.notifications_created} notifications`);
      showToast.success(`Created ${result.jobs_created} jobs`);
      await loadData();
    } catch (e) {
      setLastResult(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
      showToast.error('Daily service check failed');
    } finally {
      setRunning(false);
    }
  };

  // O(1) lookup map for fleetOverview rows, keyed by forklift_id. Built once
  // per fleetOverview change to avoid O(n) .find() inside the sort comparator
  // (which would make sorting O(n² log n) for hundreds of rows).
  const overviewById = useMemo(() => {
    const m = new Map<string, FleetServiceOverview>();
    fleetOverview.forEach(o => m.set(o.forklift_id, o));
    return m;
  }, [fleetOverview]);

  // Sort helper — urgency score (lower = more urgent)
  const getUrgencyScore = (f: ForkliftDue): number => {
    if (f.is_overdue) return 0;
    if (f.has_open_job) return 2;
    const overview = overviewById.get(f.forklift_id);
    if (overview?.is_stale_data) return 3;
    const hoursRemaining = overview?.next_target_service_hour != null && f.hourmeter != null
      ? overview.next_target_service_hour - f.hourmeter
      : 9999;
    return hoursRemaining <= 100 ? 1 : 4;
  };

  // When stale filter is active, source from fleetOverview (stale units aren't in dueForklifts)
  const staleAsDueForklifts: ForkliftDue[] = filter === 'stale'
    ? fleetOverview
        .filter(o => o.is_stale_data)
        .map(o => ({
          forklift_id: o.forklift_id,
          serial_number: o.serial_number,
          make: o.make,
          model: o.model,
          type: o.type,
          hourmeter: o.current_hourmeter,
          current_hourmeter: o.current_hourmeter,
          next_service_due: null,
          next_service_hourmeter: o.next_target_service_hour ?? null,
          days_until_due: null,
          hours_until_due: o.next_target_service_hour != null
            ? o.next_target_service_hour - o.current_hourmeter
            : null,
          is_overdue: o.is_service_overdue,
          has_open_job: false,
          current_customer_id: o.current_customer_id,
        }))
    : [];

  const getSite = (forkliftId: string): string | null => siteByForkliftId[forkliftId]?.site ?? null;

  // Memoize the filter+sort pipeline so it doesn't re-run on every render.
  // Without this, hundreds of forklifts × full-chain recomputation per
  // unrelated render becomes noticeable.
  const filteredForklifts = useMemo(() => {
    const base = filter === 'stale'
      ? staleAsDueForklifts
      : dueForklifts.filter(f => {
          if (filter === 'overdue') return f.is_overdue;
          if (filter === 'due_soon') return !f.is_overdue && !f.has_open_job;
          if (filter === 'job_created') return f.has_open_job;
          return true;
        });
    return base
      .filter(f => {
        if (ownershipFilter === 'all') return true;
        if (ownershipFilter === 'fleet') return f.ownership === 'company' || f.service_responsibility === 'fleet';
        if (ownershipFilter === 'amc') return f.service_responsibility === 'amc';
        if (ownershipFilter === 'no_contract') return f.service_responsibility === 'chargeable_external';
        return true;
      })
      .filter(f => {
        if (siteFilter === 'all') return true;
        if (siteFilter === '__unassigned__') return !getSite(f.forklift_id);
        return getSite(f.forklift_id) === siteFilter;
      })
      .sort((a, b) => {
        if (sortBy === 'urgency') return getUrgencyScore(a) - getUrgencyScore(b);
        if (sortBy === 'name') return `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`);
        if (sortBy === 'hours') return (a.hourmeter || 0) - (b.hourmeter || 0);
        if (sortBy === 'site') {
          // Sort empty sites to the end via a high-codepoint sentinel.
          const SENTINEL = '￿';
          return (getSite(a.forklift_id) ?? SENTINEL).localeCompare(getSite(b.forklift_id) ?? SENTINEL);
        }
        return 0;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, dueForklifts, staleAsDueForklifts, ownershipFilter, siteFilter, sortBy, siteByForkliftId, overviewById]);

  // Unique site names from currently-loaded forklifts, for the filter dropdown.
  const siteOptions = useMemo(() => {
    const set = new Set<string>();
    Object.values(siteByForkliftId).forEach(v => {
      if (v.site && v.site.trim()) set.add(v.site);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [siteByForkliftId]);

  const stats = {
    overdue: dueForklifts.filter(f => f.is_overdue).length,
    dueSoon: dueForklifts.filter(f => !f.is_overdue && !f.has_open_job).length,
    jobCreated: dueForklifts.filter(f => f.has_open_job).length,
    stale: fleetOverview.filter(f => f.is_stale_data).length,
  };
  
  const getOverview = (forkliftId: string) => overviewById.get(forkliftId);
  
  const TrendIcon = ({ trend }: { trend?: string }) => {
    if (trend === 'increasing') return <TrendingUp className="w-3 h-3 text-red-500" />;
    if (trend === 'decreasing') return <TrendingDown className="w-3 h-3 text-green-500" />;
    return <Minus className="w-3 h-3 text-slate-400" />;
  };

  // Progress bar: how close to next service (0% = just serviced, 100% = at target)
  const getServiceProgress = (forklift: ForkliftDue, overview?: FleetServiceOverview) => {
    if (!overview?.next_target_service_hour || !overview?.last_serviced_hourmeter) return null;
    const total = overview.next_target_service_hour - overview.last_serviced_hourmeter;
    if (total <= 0) return null;
    const used = ((forklift.current_hourmeter ?? forklift.hourmeter) || 0) - overview.last_serviced_hourmeter;
    const pct = Math.min(Math.max((used / total) * 100, 0), 120); // allow >100% for overdue
    return pct;
  };

  // Row background color based on urgency
  const getRowBg = (forklift: ForkliftDue, overview?: FleetServiceOverview) => {
    if (forklift.is_overdue) return 'bg-red-50/60 hover:bg-red-50';
    if (forklift.has_open_job) return 'hover:bg-green-50/40';
    const progress = getServiceProgress(forklift, overview);
    if (progress !== null && progress >= 80) return 'bg-amber-50/40 hover:bg-amber-50';
    if (overview?.is_stale_data) return 'bg-purple-50/40 hover:bg-purple-50';
    return 'hover:bg-slate-50';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => setFilter(filter === 'overdue' ? 'all' : 'overdue')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            filter === 'overdue' ? 'border-red-500 bg-red-50' : 'border-transparent bg-[var(--surface)] hover:border-red-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
              <p className="text-sm text-slate-600">Overdue</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilter(filter === 'due_soon' ? 'all' : 'due_soon')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            filter === 'due_soon' ? 'border-amber-500 bg-amber-50' : 'border-transparent bg-[var(--surface)] hover:border-amber-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats.dueSoon}</p>
              <p className="text-sm text-slate-600">Due Soon</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilter(filter === 'job_created' ? 'all' : 'job_created')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            filter === 'job_created' ? 'border-green-500 bg-green-50' : 'border-transparent bg-[var(--surface)] hover:border-green-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.jobCreated}</p>
              <p className="text-sm text-slate-600">Jobs Created</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilter(filter === 'stale' ? 'all' : 'stale')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            filter === 'stale' ? 'border-purple-500 bg-purple-50' : 'border-transparent bg-[var(--surface)] hover:border-purple-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <AlertOctagon className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">{stats.stale}</p>
              <p className="text-sm text-slate-600">Stale Data</p>
            </div>
          </div>
        </button>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFilter('all')}
            className={`text-sm font-medium ${filter === 'all' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Show All ({dueForklifts.length})
          </button>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <span>Window:</span>
            {([7, 14, 30, 90] as const).map(d => (
              <button
                key={d}
                onClick={() => setTimeWindow(d)}
                className={`px-2 py-1 rounded ${timeWindow === d ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-slate-100'}`}
              >
                {d}d
              </button>
            ))}
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <span>Sort:</span>
            {(['urgency', 'name', 'hours', 'site'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-2 py-1 rounded ${sortBy === s ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-slate-100'}`}
              >
                {s === 'urgency' ? '⚡ Urgency' : s === 'name' ? 'A-Z' : s === 'hours' ? '🕐 Hours' : '📍 Site'}
              </button>
            ))}
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <span>Ownership:</span>
            {OWNERSHIP_FILTERS.map(o => (
              <button
                key={o}
                onClick={() => setOwnershipFilter(o)}
                className={`px-2 py-1 rounded ${ownershipFilter === o ? 'bg-indigo-100 text-indigo-700 font-medium' : 'hover:bg-slate-100'}`}
                title={OWNERSHIP_LABELS[o]}
              >
                {o === 'all' ? 'All' : o === 'fleet' ? '🚚 Fleet' : o === 'amc' ? '🛡️ AMC' : '💵 No contract'}
              </button>
            ))}
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="w-3 h-3" />
            <span>Site:</span>
            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="px-2 py-1 rounded border border-slate-200 bg-white text-xs text-slate-700 focus:border-blue-400 focus:outline-none max-w-[180px]"
            >
              <option value="all">All Sites</option>
              <option value="__unassigned__">— Unassigned —</option>
              {siteOptions.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-3">
            {lastResult && (
              <span className={`text-sm ${lastResult.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
                {lastResult}
              </span>
            )}
            <button
              onClick={runDailyCheck}
              disabled={running}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Run Service Check
            </button>
          </div>
        )}
      </div>

      {/* Forklifts List */}
      {filteredForklifts.length === 0 ? (
        <div className="card-theme rounded-xl p-12 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 opacity-40 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-theme mb-2">All caught up!</h3>
          <p className="text-sm text-theme-muted">No forklifts due for service in this category</p>
        </div>
      ) : (
        <div className="card-theme rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-theme-surface-2 border-b border-theme">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Forklift</th>
                  {COLUMN_VISIBILITY.type && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Type</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Site Location</th>
                  {COLUMN_VISIBILITY.lastServiced && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Last Serviced</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Next Target</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Current</th>
                  {COLUMN_VISIBILITY.progress && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Progress</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Daily Usage</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Est. Service Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-theme-muted uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {filteredForklifts.map(forklift => {
                  const overview = getOverview(forklift.forklift_id);
                  const usage = dailyUsage[forklift.forklift_id];
                  const progress = getServiceProgress(forklift, overview);
                  const hoursRemaining = overview?.next_target_service_hour != null && (forklift.current_hourmeter ?? forklift.hourmeter) != null
                    ? overview.next_target_service_hour - (forklift.current_hourmeter ?? forklift.hourmeter)
                    : null;

                  return (
                    <tr
                      key={forklift.forklift_id}
                      className={`clickable-row transition-colors ${getRowBg(forklift, overview)}`}
                      onClick={() => navigate(`/forklifts/${forklift.forklift_id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900">{forklift.make} {forklift.model}</p>
                          <p className="text-xs text-slate-500 font-mono">{forklift.serial_number}</p>
                        </div>
                      </td>
                      {COLUMN_VISIBILITY.type && (
                        <td className="px-4 py-3">
                          <span className="text-sm">{forklift.type}</span>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        {getSite(forklift.forklift_id) ? (
                          <div className="flex items-center gap-1 text-sm text-slate-700">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[160px]" title={getSite(forklift.forklift_id) ?? ''}>{getSite(forklift.forklift_id)}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      {COLUMN_VISIBILITY.lastServiced && (
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            {overview?.last_serviced_hourmeter != null && overview.last_serviced_hourmeter > 0 ? (
                              <p>{overview.last_serviced_hourmeter.toLocaleString()} hrs</p>
                            ) : (
                              <div className="flex items-center gap-1 text-slate-400" title="No service record. Update via Edit Forklift or Forklift Profile.">
                                <span>No record</span>
                                <Info className="w-3 h-3" />
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          {overview?.next_target_service_hour != null ? (
                            <p className="font-medium">{overview.next_target_service_hour.toLocaleString()} hrs</p>
                          ) : (
                            <p className="text-slate-400">—</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <p className="font-medium">{(forklift.current_hourmeter ?? forklift.hourmeter)?.toLocaleString() ?? '—'} hrs</p>
                          {overview?.hours_overdue != null && overview.hours_overdue > 0 && (
                            <p className="text-xs text-red-600 font-medium">+{overview.hours_overdue} overdue</p>
                          )}
                          {overview?.days_since_update != null && overview.days_since_update > 0 && (
                            <p className={`text-xs ${overview.days_since_update > 30 ? 'text-orange-500' : 'text-slate-400'}`}>
                              Updated {overview.days_since_update}d ago
                            </p>
                          )}
                        </div>
                      </td>
                      {/* Progress bar */}
                      {COLUMN_VISIBILITY.progress && (
                        <td className="px-4 py-3">
                          {progress !== null ? (
                            <div className="w-24">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className={`font-medium ${progress >= 100 ? 'text-red-600' : progress >= 80 ? 'text-amber-600' : 'text-slate-600'}`}>
                                  {Math.round(Math.min(progress, 100))}%
                                </span>
                                {hoursRemaining !== null && (
                                  <span className={`${hoursRemaining <= 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                    {hoursRemaining <= 0 ? `${Math.abs(hoursRemaining)}↑` : `${hoursRemaining}h`}
                                  </span>
                                )}
                              </div>
                              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    progress >= 100 ? 'bg-red-500' : progress >= 80 ? 'bg-amber-500' : progress >= 50 ? 'bg-blue-500' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${Math.min(progress, 100)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="text-sm flex items-center gap-1">
                          {usage?.avg_daily_hours != null ? (
                            <>
                              <span className="font-medium">{usage.avg_daily_hours} hrs/day</span>
                              <TrendIcon trend={usage.usage_trend} />
                            </>
                          ) : (
                            <div className="flex items-center gap-1 text-slate-400" title="Needs ≥2 hourmeter readings from job records to calculate">
                              <span>Pending</span>
                              <Info className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          {(() => {
                            if (hoursRemaining != null && usage?.avg_daily_hours != null && usage.avg_daily_hours > 0) {
                              const daysUntilService = hoursRemaining / usage.avg_daily_hours;
                              
                              if (daysUntilService < 0) {
                                return (
                                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                    Overdue
                                  </span>
                                );
                              }
                              
                              if (daysUntilService > 730) {
                                return <span className="text-slate-500">2+ years</span>;
                              }
                              
                              const estDate = new Date(Date.now() + daysUntilService * 24 * 60 * 60 * 1000);
                              const daysRounded = Math.ceil(daysUntilService);
                              return (
                                <div>
                                  <p className={`font-medium ${daysRounded <= 7 ? 'text-amber-700' : 'text-slate-900'}`}>
                                    {estDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </p>
                                  <p className={`text-xs ${daysRounded <= 7 ? 'text-amber-600' : 'text-slate-400'}`}>
                                    ~{daysRounded} days
                                  </p>
                                </div>
                              );
                            }
                            // No usage data — show hint
                            if (hoursRemaining != null && hoursRemaining <= 0) {
                              return (
                                <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                  Overdue
                                </span>
                              );
                            }
                            return (
                              <div className="flex items-center gap-1 text-slate-400" title="Need daily usage data to estimate">
                                <span className="text-xs">Need usage data</span>
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {forklift.has_open_job ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 w-fit">✓ Job Created</span>
                          ) : forklift.is_overdue ? (
                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 w-fit animate-pulse">⚠ Overdue</span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 w-fit">Due Soon</span>
                          )}
                          {overview?.is_stale_data && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 w-fit">
                              📡 Stale ({overview.days_since_update}d)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {forklift.has_open_job ? (
                            <span
                              className="text-xs font-medium text-emerald-600 px-2 py-1 rounded inline-flex items-center gap-1 opacity-70 cursor-not-allowed"
                              title="A job already exists for this forklift"
                            >
                              <CheckCircle className="w-3 h-3" /> Scheduled
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                const params = new URLSearchParams();
                                if (forklift.current_customer_id) params.set('customer_id', forklift.current_customer_id);
                                params.set('forklift_id', forklift.forklift_id);
                                navigate(`/jobs/new?${params.toString()}`);
                              }}
                              className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 inline-flex items-center gap-1"
                              title="Create a service job for this forklift"
                            >
                              <CalendarPlus className="w-3 h-3" /> Schedule Service
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/forklifts/${forklift.forklift_id}`)}
                            className="text-xs font-medium text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100 inline-flex items-center gap-1"
                          >
                            View <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceDueTab;
