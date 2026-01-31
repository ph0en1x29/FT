/**
 * TelegramTeamStatus Component
 * 
 * Admin view showing which team members have Telegram connected.
 * Helps admins ensure everyone is set up for notifications.
 * 
 * @author Phoenix (Clawdbot)
 * @created 2026-01-31
 */

import React, { useState, useEffect } from 'react';
import { 
  Send, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Users,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { supabase } from '../services/supabaseService';
import { User, UserRole } from '../types';

interface TeamMemberStatus {
  id: string;
  full_name: string;
  email: string;
  role: string;
  telegram_connected: boolean;
  telegram_username: string | null;
  telegram_language: string | null;
  linked_at: string | null;
}

interface TelegramTeamStatusProps {
  currentUser: User;
}

const TelegramTeamStatus: React.FC<TelegramTeamStatusProps> = ({ currentUser }) => {
  const [teamStatus, setTeamStatus] = useState<TeamMemberStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [filterRole, setFilterRole] = useState<string>('all');

  // Check if user has admin access
  const isAdmin = [
    UserRole.ADMIN,
    UserRole.ADMIN_SERVICE,
    UserRole.ADMIN_STORE,
    UserRole.SUPERVISOR
  ].includes(currentUser.role);

  useEffect(() => {
    if (isAdmin) {
      fetchTeamStatus();
    }
  }, [isAdmin]);

  const fetchTeamStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all users with their telegram links
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          email,
          role
        `)
        .neq('role', 'Accountant') // Accountants typically don't need field notifications
        .order('role')
        .order('full_name');

      if (usersError) throw usersError;

      // Fetch telegram links
      const { data: links, error: linksError } = await supabase
        .from('user_telegram_links')
        .select('user_id, telegram_username, language, linked_at, is_active')
        .eq('is_active', true);

      if (linksError) throw linksError;

      // Merge data
      const linkMap = new Map(links?.map(l => [l.user_id, l]) || []);
      
      const merged: TeamMemberStatus[] = (users || []).map(user => ({
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        telegram_connected: linkMap.has(user.id),
        telegram_username: linkMap.get(user.id)?.telegram_username || null,
        telegram_language: linkMap.get(user.id)?.language || null,
        linked_at: linkMap.get(user.id)?.linked_at || null
      }));

      setTeamStatus(merged);
    } catch (err: unknown) {
      setError('Failed to load team status');
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return null; // Don't show to non-admins
  }

  // Calculate stats
  const filteredTeam = filterRole === 'all' 
    ? teamStatus 
    : teamStatus.filter(m => m.role.toLowerCase().includes(filterRole.toLowerCase()));
  
  const connectedCount = filteredTeam.filter(m => m.telegram_connected).length;
  const totalCount = filteredTeam.length;
  const percentage = totalCount > 0 ? Math.round((connectedCount / totalCount) * 100) : 0;

  // Get unique roles
  const roles = [...new Set(teamStatus.map(m => m.role))];

  if (loading) {
    return (
      <div className="p-4 bg-theme-surface rounded-xl border border-[var(--border)]">
        <div className="flex items-center gap-2 text-theme-muted">
          <RefreshCw size={16} className="animate-spin" />
          <span>Loading team Telegram status...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={fetchTeamStatus} className="ml-auto text-sm underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-theme-surface rounded-xl border border-[var(--border)] overflow-hidden">
      {/* Header */}
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-theme-surface-2 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#0088cc]/10 flex items-center justify-center">
            <Send size={20} className="text-[#0088cc]" />
          </div>
          <div>
            <h3 className="font-medium text-theme flex items-center gap-2">
              <Users size={16} />
              Team Telegram Status
            </h3>
            <p className="text-sm text-theme-muted">
              {connectedCount}/{totalCount} connected ({percentage}%)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress bar */}
          <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${
                percentage === 100 ? 'bg-green-500' : 
                percentage >= 75 ? 'bg-blue-500' : 
                percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-[var(--border)]">
          {/* Filter */}
          <div className="p-3 border-b border-[var(--border)] bg-theme-surface-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-theme-muted">Filter:</span>
              <button
                onClick={() => setFilterRole('all')}
                className={`px-2 py-1 text-xs rounded-full transition-colors ${
                  filterRole === 'all'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-theme-surface border border-[var(--border)] text-theme-muted hover:bg-theme-surface-2'
                }`}
              >
                All
              </button>
              {roles.map(role => (
                <button
                  key={role}
                  onClick={() => setFilterRole(role)}
                  className={`px-2 py-1 text-xs rounded-full transition-colors ${
                    filterRole === role
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-theme-surface border border-[var(--border)] text-theme-muted hover:bg-theme-surface-2'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          {/* Team list */}
          <div className="max-h-64 overflow-y-auto">
            {filteredTeam.length === 0 ? (
              <div className="p-4 text-center text-theme-muted">
                No team members found
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-theme-surface-2 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium text-theme-muted">Name</th>
                    <th className="text-left p-2 font-medium text-theme-muted">Role</th>
                    <th className="text-center p-2 font-medium text-theme-muted">Telegram</th>
                    <th className="text-left p-2 font-medium text-theme-muted">Language</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeam.map((member) => (
                    <tr key={member.id} className="border-t border-[var(--border)] hover:bg-theme-surface-2">
                      <td className="p-2">
                        <div className="font-medium text-theme">{member.full_name}</div>
                        <div className="text-xs text-theme-muted">{member.email}</div>
                      </td>
                      <td className="p-2 text-theme-muted">{member.role}</td>
                      <td className="p-2 text-center">
                        {member.telegram_connected ? (
                          <div className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircle size={16} />
                            {member.telegram_username && (
                              <span className="text-xs">@{member.telegram_username}</span>
                            )}
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 text-red-500">
                            <XCircle size={16} />
                            <span className="text-xs">Not linked</span>
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-theme-muted">
                        {member.telegram_language === 'ms' ? '🇲🇾' : 
                         member.telegram_language === 'en' ? '🇬🇧' : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-[var(--border)] bg-theme-surface-2 flex items-center justify-between">
            <span className="text-xs text-theme-muted">
              Team members need to click "Connect Telegram" in their profile
            </span>
            <button
              onClick={fetchTeamStatus}
              className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              <RefreshCw size={12} />
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TelegramTeamStatus;
