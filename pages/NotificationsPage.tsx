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
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';
import { supabase } from '../services/supabaseService';
import type { Notification, User } from '../types';
import { NotificationType, ROLE_PERMISSIONS } from '../types';
import type { AppNotification } from '../utils/useRealtimeNotifications';

interface NotificationsPageProps {
  currentUser: User;
}

type TabFilter = 'unread' | 'all';

const PAGE_SIZE = 30;

const NotificationsPage: React.FC<NotificationsPageProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const { notifications: realtimeNotifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const [tab, setTab] = useState<TabFilter>('all');
  const [allNotifications, setAllNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  // Load all notifications from DB (paginated)
  const loadNotifications = useCallback(async (pageNum: number, append = false) => {
    setLoading(true);
    try {
      const from = (pageNum - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentUser.user_id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (!error && data) {
        const typed = data as AppNotification[];
        setAllNotifications(prev => append ? [...prev, ...typed] : typed);
        setHasMore(typed.length === PAGE_SIZE);
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser.user_id]);

  useEffect(() => {
    loadNotifications(1);
  }, [loadNotifications]);

  // Sync realtime updates into allNotifications
  useEffect(() => {
    setAllNotifications(prev => {
      const existingIds = new Set(prev.map(n => n.notification_id));
      const newOnes = realtimeNotifications.filter(n => !existingIds.has(n.notification_id));
      if (newOnes.length === 0) {
        // Update is_read status from realtime state
        return prev.map(n => {
          const rt = realtimeNotifications.find(r => r.notification_id === n.notification_id);
          return rt && rt.is_read !== n.is_read ? { ...n, is_read: rt.is_read } : n;
        });
      }
      return [...newOnes, ...prev];
    });
  }, [realtimeNotifications]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadNotifications(nextPage, true);
  };

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
