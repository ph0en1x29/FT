import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  CalendarCheck,
  CalendarDays,
  CalendarX,
  Check,
  CheckCheck,
  CheckCircle,
  ChevronRight,
  Clock,
  Cog,
  Package,
  Truck,
  UserCheck,
  UserPlus,
  Wrench,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';
import { supabase } from '../services/supabaseService';
import type { User } from '../types';
import { NotificationType, ROLE_PERMISSIONS } from '../types';
import type { AppNotification } from '../utils/useRealtimeNotifications';

interface NotificationsPageProps {
  currentUser: User;
}

type TabFilter = 'unread' | 'all';

// `useRealtimeNotifications` already loads + caches the user's top 50
// notifications globally (in NotificationContext). The page reads that
// cache directly and only goes to the database when the user explicitly
// loads pages beyond the cached window. This avoids the second SELECT-on-mount
// + the O(n²) merge that used to run on every realtime update.
const REALTIME_CACHE_SIZE = 50;
const OLDER_PAGE_SIZE = 30;

const NotificationsPage: React.FC<NotificationsPageProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const { notifications: realtimeNotifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const [tab, setTab] = useState<TabFilter>('all');
  const [olderPages, setOlderPages] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0); // 0 means "no older pages fetched yet"

  // Combined view: realtime cache (always fresh, top ~50) + older pages
  // (deduped against realtime ids in case the windows overlap).
  const allNotifications = useMemo(() => {
    if (olderPages.length === 0) return realtimeNotifications;
    const seen = new Set(realtimeNotifications.map(n => n.notification_id));
    return [...realtimeNotifications, ...olderPages.filter(n => !seen.has(n.notification_id))];
  }, [realtimeNotifications, olderPages]);

  // Pagination only triggers a fetch for items beyond the realtime-cached set.
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const from = REALTIME_CACHE_SIZE + page * OLDER_PAGE_SIZE;
      const to = from + OLDER_PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentUser.user_id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (!error && data) {
        const typed = data as AppNotification[];
        if (typed.length === 0) {
          setHasMore(false);
        } else {
          setOlderPages(prev => [...prev, ...typed]);
          setPage(p => p + 1);
          if (typed.length < OLDER_PAGE_SIZE) setHasMore(false);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser.user_id, page, loading, hasMore]);

  // Reset older pages when the user changes (defensive — currentUser is
  // typically stable for the session).
  useEffect(() => {
    setOlderPages([]);
    setPage(0);
    setHasMore(true);
  }, [currentUser.user_id]);

  const filtered = tab === 'unread'
    ? allNotifications.filter(n => !n.is_read)
    : allNotifications;

  const handleClick = (notification: AppNotification) => {
    if (!notification.is_read) {
      markAsRead(notification.notification_id);
    }
    if (notification.reference_type === 'job' && notification.reference_id) {
      navigate(`/jobs/${notification.reference_id}`);
    } else if (notification.reference_type === 'forklift' && notification.reference_id) {
      navigate(`/forklifts/${notification.reference_id}`);
    } else if (notification.reference_type === 'leave') {
      const canApproveLeave = ROLE_PERMISSIONS[currentUser.role]?.canApproveLeave;
      if (notification.type === NotificationType.LEAVE_REQUEST && canApproveLeave) {
        navigate('/people?tab=leave&filter=pending');
      } else {
        navigate('/my-leave');
      }
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'job_assigned':
        return <Wrench className="w-4 h-4 text-blue-500" />;
      case 'job_pending':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'service_due':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'rental_ending':
        return <Truck className="w-4 h-4 text-purple-500" />;
      case 'low_stock':
        return <Package className="w-4 h-4 text-red-500" />;
      case 'leave_request':
        return <CalendarDays className="w-4 h-4 text-amber-500" />;
      case 'leave_approved':
        return <CalendarCheck className="w-4 h-4 text-green-500" />;
      case 'leave_rejected':
        return <CalendarX className="w-4 h-4 text-red-500" />;
      case 'helper_request':
        return <UserPlus className="w-4 h-4 text-blue-500" />;
      case 'spare_part_request':
        return <Cog className="w-4 h-4 text-orange-500" />;
      case 'skillful_tech_request':
        return <UserPlus className="w-4 h-4 text-purple-500" />;
      case 'request_approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'request_rejected':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'job_reassigned':
        return <UserCheck className="w-4 h-4 text-indigo-500" />;
      case 'job_completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'escalation':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Bell className="w-4 h-4 text-[var(--text-muted)]" />;
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getPriorityBorder = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-l-red-500';
      case 'high': return 'border-l-orange-500';
      default: return 'border-l-transparent';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-[var(--bg-subtle)] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-theme">Notifications</h1>
            <p className="text-sm text-theme-muted mt-0.5">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllAsRead()}
            className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--accent)] hover:bg-[var(--bg-subtle)] rounded-lg transition-colors"
          >
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTab('unread')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            tab === 'unread'
              ? 'bg-[var(--accent)] text-white'
              : 'bg-[var(--bg-subtle)] text-theme-muted hover:bg-[var(--surface-2)]'
          }`}
        >
          Unread ({unreadCount})
        </button>
        <button
          onClick={() => setTab('all')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            tab === 'all'
              ? 'bg-[var(--accent)] text-white'
              : 'bg-[var(--bg-subtle)] text-theme-muted hover:bg-[var(--surface-2)]'
          }`}
        >
          All
        </button>
      </div>

      {/* List */}
      <div className="card-premium overflow-hidden">
        {filtered.length > 0 ? (
          <div className="divide-y divide-[var(--border)]">
            {filtered.map((notification) => (
              <div
                key={notification.notification_id}
                onClick={() => handleClick(notification)}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--bg-subtle)] transition-colors border-l-4 ${getPriorityBorder(notification.priority)} ${
                  !notification.is_read ? 'bg-[var(--accent-subtle)]' : ''
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!notification.is_read ? 'font-semibold text-[var(--text)]' : 'text-[var(--text-secondary)]'}`}>
                    {notification.title}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="text-xs text-[var(--text-subtle)] mt-1">
                    {formatTime(notification.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!notification.is_read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notification.notification_id);
                      }}
                      className="p-1.5 hover:bg-[var(--surface-2)] rounded-lg transition-colors"
                      title="Mark as read"
                    >
                      <Check className="w-4 h-4 text-[var(--text-muted)]" />
                    </button>
                  )}
                  {notification.reference_type && (
                    <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-[var(--text-muted)]">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">
              {tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
            <p className="text-xs mt-1">
              {tab === 'unread' ? 'You\'re all caught up!' : 'Notifications will appear here when there\'s activity.'}
            </p>
          </div>
        )}

        {/* Load More */}
        {hasMore && tab === 'all' && (
          <div className="px-4 py-3 border-t border-[var(--border)] text-center">
            <button
              onClick={loadMore}
              disabled={loading}
              className="text-sm text-[var(--accent)] hover:underline disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </div>

      {/* Footer note */}
      <p className="text-xs text-theme-muted text-center">
        Read notifications are automatically cleared after 30 days.
      </p>
    </div>
  );
};

export default NotificationsPage;
