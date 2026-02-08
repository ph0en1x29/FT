import {
AlertTriangle,
Bell,BellRing,
CalendarCheck,
CalendarDays,
CalendarX,
Check,CheckCheck,
CheckCircle,
ChevronRight,
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
import React,{ useEffect,useRef,useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';
import type { Notification,User } from '../types';
import { NotificationType,ROLE_PERMISSIONS } from '../types';

interface NotificationBellProps {
  currentUser: User;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await markAsRead(notificationId);
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  const handleNotificationClick = (notification: Notification) => {
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
    setIsOpen(false);
  };

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
        return <Bell className="w-4 h-4 text-[var(--text-muted)]" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-l-red-500 bg-[var(--error-bg)]';
      case 'high': return 'border-l-orange-500 bg-[var(--warning-bg)]';
      case 'normal': return 'border-l-blue-500';
      default: return 'border-l-[var(--border)]';
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

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-[var(--bg-subtle)] transition-colors"
      >
        {unreadCount > 0 ? (
          <BellRing className="w-6 h-6 text-[var(--accent)] animate-pulse" />
        ) : (
          <Bell className="w-6 h-6 text-[var(--text-muted)]" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[var(--surface)] rounded-xl shadow-[var(--shadow-lg)] border border-[var(--border)] overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 bg-[var(--surface-2)] border-b border-[var(--border)]">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[var(--text)]">Notifications</h3>
                {/* Connection indicator */}
                <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                  isConnected 
                    ? 'text-green-600 bg-[var(--success-bg)]' 
                    : 'text-[var(--text-muted)] bg-[var(--bg-subtle)]'
                }`}>
                  {isConnected ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                  {isConnected ? 'Live' : 'Offline'}
                </div>
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-[var(--accent)] hover:opacity-80 flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" /> Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.slice(0, 10).map(notification => (
                <div
                  key={notification.notification_id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`
                    px-4 py-3 border-b border-[var(--border-subtle)] cursor-pointer 
                    hover:bg-[var(--bg-subtle)] transition-colors border-l-4
                    ${getPriorityColor(notification.priority)}
                    ${!notification.is_read ? 'bg-[var(--accent-subtle)]' : ''}
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
                      <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">
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
                        onClick={(e) => handleMarkRead(notification.notification_id, e)}
                        className="p-1 hover:bg-[var(--bg-subtle)] rounded"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4 text-[var(--text-muted)]" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-[var(--text-muted)]">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No notifications</p>
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 10 && (
            <div className="px-4 py-2 bg-[var(--surface-2)] border-t border-[var(--border)] text-center">
              <button className="text-sm text-[var(--accent)] hover:underline">
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
