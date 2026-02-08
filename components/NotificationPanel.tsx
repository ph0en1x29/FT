import {
AlertTriangle,
Bell,BellRing,
CalendarCheck,
CalendarDays,
CalendarX,
CheckCheck,
CheckCircle,
Clock,
Cog,
Package,
Truck,
UserCheck,
UserPlus,
Wifi,WifiOff,
Wrench,
XCircle
} from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Notification,User } from '../types';
import { NotificationType,ROLE_PERMISSIONS } from '../types';

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
  maxItems = 10,
}) => {
  const navigate = useNavigate();

  const getNotificationIcon = (type: NotificationType) => {
    const iconMap: Record<string, { icon: React.ReactNode; bg: string }> = {
      [NotificationType.JOB_ASSIGNED]: { 
        icon: <Wrench className="w-3.5 h-3.5 text-blue-600" />, 
        bg: 'bg-blue-50' 
      },
      [NotificationType.JOB_PENDING]: { 
        icon: <Clock className="w-3.5 h-3.5 text-amber-600" />, 
        bg: 'bg-amber-50' 
      },
      [NotificationType.SERVICE_DUE]: { 
        icon: <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />, 
        bg: 'bg-orange-50' 
      },
      [NotificationType.RENTAL_ENDING]: { 
        icon: <Truck className="w-3.5 h-3.5 text-purple-600" />, 
        bg: 'bg-purple-50' 
      },
      [NotificationType.LOW_STOCK]: { 
        icon: <Package className="w-3.5 h-3.5 text-red-600" />, 
        bg: 'bg-red-50' 
      },
      [NotificationType.LEAVE_REQUEST]: { 
        icon: <CalendarDays className="w-3.5 h-3.5 text-amber-600" />, 
        bg: 'bg-amber-50' 
      },
      [NotificationType.LEAVE_APPROVED]: { 
        icon: <CalendarCheck className="w-3.5 h-3.5 text-green-600" />, 
        bg: 'bg-green-50' 
      },
      [NotificationType.LEAVE_REJECTED]: { 
        icon: <CalendarX className="w-3.5 h-3.5 text-red-600" />, 
        bg: 'bg-red-50' 
      },
      [NotificationType.HELPER_REQUEST]: { 
        icon: <UserPlus className="w-3.5 h-3.5 text-blue-600" />, 
        bg: 'bg-blue-50' 
      },
      [NotificationType.SPARE_PART_REQUEST]: { 
        icon: <Cog className="w-3.5 h-3.5 text-orange-600" />, 
        bg: 'bg-orange-50' 
      },
      [NotificationType.SKILLFUL_TECH_REQUEST]: { 
        icon: <UserPlus className="w-3.5 h-3.5 text-purple-600" />, 
        bg: 'bg-purple-50' 
      },
      [NotificationType.REQUEST_APPROVED]: { 
        icon: <CheckCircle className="w-3.5 h-3.5 text-green-600" />, 
        bg: 'bg-green-50' 
      },
      [NotificationType.REQUEST_REJECTED]: { 
        icon: <XCircle className="w-3.5 h-3.5 text-red-600" />, 
        bg: 'bg-red-50' 
      },
      [NotificationType.JOB_REASSIGNED]: { 
        icon: <UserCheck className="w-3.5 h-3.5 text-indigo-600" />, 
        bg: 'bg-indigo-50' 
      },
    };
    return iconMap[type] || { icon: <Bell className="w-3.5 h-3.5 text-slate-500" />, bg: 'bg-slate-50' };
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
    <div className="card-premium flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 pb-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              unreadCount > 0 
                ? 'bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)]' 
                : 'bg-[var(--bg-subtle)]'
            }`}>
              {unreadCount > 0 ? (
                <BellRing className="w-4 h-4 text-white" />
              ) : (
                <Bell className="w-4 h-4 text-[var(--text-muted)]" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-[var(--text)] text-sm">Notifications</h3>
              <p className="text-[10px] text-[var(--text-muted)]">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                isConnected
                  ? 'text-[var(--success)] bg-[var(--success-bg)]'
                  : 'text-[var(--text-muted)] bg-[var(--bg-subtle)]'
              }`}
            >
              {isConnected ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
              {isConnected ? 'Live' : 'Offline'}
            </div>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="mt-2 text-[10px] text-[var(--accent)] hover:opacity-80 flex items-center gap-1"
          >
            <CheckCheck className="w-3 h-3" /> Mark all as read
          </button>
        )}
      </div>

      {/* Notification List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {displayNotifications.length > 0 ? (
          <div className="divide-y divide-[var(--border-subtle)]">
            {displayNotifications.map(notification => {
              const { icon, bg } = getNotificationIcon(notification.type as NotificationType);
              return (
                <div
                  key={notification.notification_id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`
                    flex items-start gap-3 p-3 cursor-pointer transition-all
                    hover:bg-[var(--bg-subtle)]
                    ${!notification.is_read ? 'bg-[var(--accent)]/5' : ''}
                  `}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs leading-tight ${!notification.is_read ? 'font-semibold text-[var(--text)]' : 'text-[var(--text-secondary)]'}`}>
                        {notification.title}
                      </p>
                      <span className="text-[10px] text-[var(--text-subtle)] whitespace-nowrap flex-shrink-0">
                        {formatTime(notification.created_at)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-2 leading-tight">
                      {notification.message}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <div className="w-2 h-2 rounded-full bg-[var(--accent)] flex-shrink-0 mt-1" />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center mb-3">
              <Bell className="w-6 h-6 text-[var(--text-muted)] opacity-50" />
            </div>
            <p className="text-sm font-medium text-[var(--text)]">No notifications</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">You're all caught up!</p>
          </div>
        )}
      </div>

      {/* Footer */}
      {hasMore && (
        <div className="p-3 border-t border-[var(--border-subtle)]">
          <button className="w-full text-xs text-[var(--accent)] hover:opacity-80 transition-opacity">
            View all {notifications.length} notifications →
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
