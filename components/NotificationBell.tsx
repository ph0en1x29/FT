import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Notification, NotificationType, User, ROLE_PERMISSIONS } from '../types_with_invoice_tracking';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { 
  Bell, BellRing, Check, CheckCheck, Clock, 
  AlertTriangle, Wrench, Truck, Package, X, CalendarDays, CalendarCheck, CalendarX,
  ChevronRight
} from 'lucide-react';

interface NotificationBellProps {
  currentUser: User;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [currentUser.user_id]);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    try {
      const [notifs, count] = await Promise.all([
        MockDb.getNotifications(currentUser.user_id, false),
        MockDb.getUnreadNotificationCount(currentUser.user_id),
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };


  const handleMarkRead = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await MockDb.markNotificationRead(notificationId);
    setNotifications(prev => 
      prev.map(n => n.notification_id === notificationId ? { ...n, is_read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    await MockDb.markAllNotificationsRead(currentUser.user_id);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      MockDb.markNotificationRead(notification.notification_id);
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    
    // Navigate to reference
    if (notification.reference_type === 'job' && notification.reference_id) {
      navigate(`/jobs/${notification.reference_id}`);
    } else if (notification.reference_type === 'forklift' && notification.reference_id) {
      navigate(`/forklifts/${notification.reference_id}`);
    } else if (notification.reference_type === 'leave') {
      // For leave requests (to approve), go to HR dashboard if user has permission
      // For leave approved/rejected notifications, go to My Leave page
      const canApproveLeave = ROLE_PERMISSIONS[currentUser.role]?.canApproveLeave;
      if (notification.type === NotificationType.LEAVE_REQUEST && canApproveLeave) {
        navigate('/hr');
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
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-l-red-500 bg-red-50';
      case 'high': return 'border-l-orange-500 bg-orange-50';
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


  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
      >
        {unreadCount > 0 ? (
          <BellRing className="w-6 h-6 text-blue-600 animate-pulse" />
        ) : (
          <Bell className="w-6 h-6 text-slate-600" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-bold text-slate-800">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <CheckCheck className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.slice(0, 10).map(notification => (
                <div
                  key={notification.notification_id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`
                    px-4 py-3 border-b border-slate-100 cursor-pointer 
                    hover:bg-slate-50 transition-colors border-l-4
                    ${getPriorityColor(notification.priority)}
                    ${!notification.is_read ? 'bg-blue-50/50' : ''}
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getNotificationIcon(notification.type as NotificationType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notification.is_read ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-slate-400">
                          {formatTime(notification.created_at)}
                        </p>
                        {notification.reference_type && (
                          <span className="text-xs text-blue-600 flex items-center gap-0.5">
                            View <ChevronRight className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </div>
                    {!notification.is_read && (
                      <button
                        onClick={(e) => handleMarkRead(notification.notification_id, e)}
                        className="p-1 hover:bg-slate-200 rounded"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4 text-slate-400" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-400">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No notifications</p>
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 10 && (
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-center">
              <button className="text-sm text-blue-600 hover:underline">
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
