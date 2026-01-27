import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle, AlertTriangle, Info, Wrench, UserPlus, ChevronRight } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';

interface DashboardNotificationCardProps {
  maxItems?: number;
}

const DashboardNotificationCard: React.FC<DashboardNotificationCardProps> = ({ maxItems = 5 }) => {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  // Get recent unread notifications (up to maxItems)
  const recentNotifications = notifications
    .filter(n => !n.is_read)
    .slice(0, maxItems);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'job_assigned':
        return <Wrench className="w-4 h-4 text-[var(--info)]" />;
      case 'job_request':
      case 'request_approved':
      case 'request_rejected':
        return <UserPlus className="w-4 h-4 text-[var(--warning)]" />;
      case 'job_completed':
        return <CheckCircle className="w-4 h-4 text-[var(--success)]" />;
      case 'urgent':
      case 'escalation':
        return <AlertTriangle className="w-4 h-4 text-[var(--error)]" />;
      default:
        return <Info className="w-4 h-4 text-[var(--accent)]" />;
    }
  };

  const handleNotificationClick = async (notification: typeof notifications[0]) => {
    await markAsRead(notification.notification_id);

    // Navigate to the relevant page based on reference type
    if (notification.reference_type === 'job' && notification.reference_id) {
      navigate(`/jobs/${notification.reference_id}`);
    } else if (notification.reference_type === 'request' && notification.reference_id) {
      navigate('/pending-confirmations');
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (recentNotifications.length === 0) {
    return (
      <div className="card-premium p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
            <Bell className="w-5 h-5 text-[var(--text-muted)]" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text)]">Notifications</h3>
            <p className="text-xs text-[var(--text-muted)]">You're all caught up!</p>
          </div>
        </div>
        <p className="text-sm text-[var(--text-muted)] text-center py-4">No new notifications</p>
      </div>
    );
  }

  return (
    <div className="card-premium p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center relative">
            <Bell className="w-5 h-5 text-[var(--accent)]" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--error)] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text)]">Notifications</h3>
            <p className="text-xs text-[var(--text-muted)]">{unreadCount} unread</p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllAsRead()}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="space-y-2">
        {recentNotifications.map((notification) => (
          <div
            key={notification.notification_id}
            onClick={() => handleNotificationClick(notification)}
            className="flex items-start gap-3 p-3 bg-[var(--bg-subtle)] rounded-xl cursor-pointer hover:bg-[var(--surface)] transition-colors border border-transparent hover:border-[var(--border)]"
          >
            <div className="mt-0.5">
              {getNotificationIcon(notification.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text)] truncate">{notification.title}</p>
              <p className="text-xs text-[var(--text-muted)] truncate">{notification.message}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">{formatTime(notification.created_at)}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 mt-1" />
          </div>
        ))}
      </div>

      {unreadCount > maxItems && (
        <button
          onClick={() => navigate('/notifications')}
          className="w-full mt-3 text-sm text-[var(--accent)] hover:underline text-center"
        >
          View all {unreadCount} notifications
        </button>
      )}
    </div>
  );
};

export default DashboardNotificationCard;
