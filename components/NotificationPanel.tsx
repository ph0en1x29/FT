import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, BellRing, Check, CheckCheck, Clock, 
  AlertTriangle, Wrench, Truck, Package, CalendarDays, CalendarCheck, CalendarX,
  ChevronRight, Wifi, WifiOff, UserPlus, UserCheck, UserX, Cog, CheckCircle, XCircle
} from 'lucide-react';
import { Notification, NotificationType, User, ROLE_PERMISSIONS } from '../types_with_invoice_tracking';

interface NotificationPanelProps {
  notifications: Notification[];
  unreadCount: number;
  isConnected: boolean;
  onMarkRead: (notificationId: string) => void;
  onMarkAllRead: () => void;
  currentUser: User;
  maxItems?: number;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications,
  unreadCount,
  isConnected,
  onMarkRead,
  onMarkAllRead,
  currentUser,
  maxItems = 5,
}) => {
  const navigate = useNavigate();

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case NotificationType.JOB_ASSIGNED:
        return <Wrench className="w-4 h-4 text-blue-500" />;
      case NotificationType.JOB_PENDING:
        return <Clock className="w-4 h-4 text-amber-500" />;
      case NotificationType.SERVICE_DUE:
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case NotificationType.RENTAL_ENDING:
        return <Truck className="w-4 h-4 text-purple-500" />;
      case NotificationType.LOW_STOCK:
        return <Package className="w-4 h-4 text-red-500" />;
      case NotificationType.LEAVE_REQUEST:
        return <CalendarDays className="w-4 h-4 text-amber-500" />;
      case NotificationType.LEAVE_APPROVED:
        return <CalendarCheck className="w-4 h-4 text-green-500" />;
      case NotificationType.LEAVE_REJECTED:
        return <CalendarX className="w-4 h-4 text-red-500" />;
      // New notification types for request system
      case NotificationType.HELPER_REQUEST:
        return <UserPlus className="w-4 h-4 text-blue-500" />;
      case NotificationType.SPARE_PART_REQUEST:
        return <Cog className="w-4 h-4 text-orange-500" />;
      case NotificationType.SKILLFUL_TECH_REQUEST:
        return <UserPlus className="w-4 h-4 text-purple-500" />;
      case NotificationType.REQUEST_APPROVED:
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case NotificationType.REQUEST_REJECTED:
        return <XCircle className="w-4 h-4 text-red-500" />;
      case NotificationType.JOB_REASSIGNED:
        return <UserCheck className="w-4 h-4 text-indigo-500" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-l-red-500';
      case 'high': return 'border-l-orange-500';
      case 'normal': return 'border-l-blue-500';
      default: return 'border-l-slate-300';
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
    return date.toLocaleDateString();
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      onMarkRead(notification.notification_id);
    }
    
    if (notification.reference_type === 'job' && notification.reference_id) {
      navigate(`/jobs/${notification.reference_id}`);
    } else if (notification.reference_type === 'forklift' && notification.reference_id) {
      navigate(`/forklifts/${notification.reference_id}`);
    } else if (notification.reference_type === 'leave') {
      const canApproveLeave = ROLE_PERMISSIONS[currentUser.role]?.canApproveLeave;
      if (notification.type === NotificationType.LEAVE_REQUEST && canApproveLeave) {
        navigate('/hr');
      } else {
        navigate('/my-leave');
      }
    }
  };

  const displayNotifications = notifications.slice(0, maxItems);
  const hasMore = notifications.length > maxItems;

  return (
    <div className="card-premium p-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {unreadCount > 0 ? (
            <BellRing className="w-5 h-5 text-[var(--accent)]" />
          ) : (
            <Bell className="w-5 h-5 text-[var(--text-muted)]" />
          )}
          <h3 className="font-semibold text-[var(--text)]">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 bg-[var(--error-bg)] text-[var(--error)] text-xs font-bold rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Connection status indicator */}
          <div
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${
              isConnected
                ? 'text-[var(--success)] border-[var(--success)] bg-[var(--success-bg)]'
                : 'text-[var(--text-muted)] border-[var(--border)] bg-[var(--bg-subtle)]'
            }`}
          >
            {isConnected ? (
              <>
                <Wifi className="w-3 h-3" />
                <span>Live</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                <span>Offline</span>
              </>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="text-xs text-[var(--accent)] hover:opacity-80 flex items-center gap-1"
            >
              <CheckCheck className="w-3 h-3" /> Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Notification List */}
      <div className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
        {displayNotifications.length > 0 ? (
          displayNotifications.map(notification => (
            <div
              key={notification.notification_id}
              onClick={() => handleNotificationClick(notification)}
              className={`
                p-3 rounded-xl border border-[var(--border-subtle)] border-l-4 cursor-pointer 
                bg-[var(--surface)] hover:bg-[var(--surface-2)] hover:border-[var(--border-strong)]
                transition-all
                ${getPriorityStyles(notification.priority)}
                ${!notification.is_read ? 'ring-1 ring-blue-200' : ''}
              `}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {getNotificationIcon(notification.type as NotificationType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!notification.is_read ? 'font-semibold text-[var(--text)]' : 'text-[var(--text-secondary)]'}`}>
                    {notification.title}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1">
                    {notification.message}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-[var(--text-subtle)]">
                      {formatTime(notification.created_at)}
                    </p>
                    {notification.reference_type && (
                      <span className="text-xs text-[var(--accent)] flex items-center gap-0.5">
                        View <ChevronRight className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
                {!notification.is_read && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkRead(notification.notification_id);
                    }}
                    className="p-1 hover:bg-[var(--bg-subtle)] rounded-lg"
                    title="Mark as read"
                  >
                    <Check className="w-4 h-4 text-[var(--text-muted)]" />
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="py-10 text-center text-[var(--text-muted)]">
            <Bell className="w-9 h-9 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium text-[var(--text)]">No notifications</p>
            <p className="text-xs mt-1 text-[var(--text-muted)]">You're all caught up.</p>
          </div>
        )}
      </div>

      {/* Footer */}
      {hasMore && (
        <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] text-center">
          <button className="text-sm text-[var(--accent)] hover:opacity-80 hover:underline">
            View all {notifications.length} notifications
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
