import { AlertTriangle,Bell,CalendarDays,CheckCircle,ChevronDown,ChevronRight,ChevronUp,Clock,Info,Package,Settings,Truck,UserPlus,Wrench,XCircle } from 'lucide-react';
import React,{ useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';

interface DashboardNotificationCardProps {
  maxItems?: number;
  showAllByDefault?: boolean;
  expandable?: boolean;
}

const DashboardNotificationCard: React.FC<DashboardNotificationCardProps> = ({ 
  maxItems = 5,
  showAllByDefault = false,
  expandable = true
}) => {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isExpanded, setIsExpanded] = useState(showAllByDefault);
  const [showReadNotifications, setShowReadNotifications] = useState(false);

  // Filter notifications based on settings
  const filteredNotifications = showReadNotifications 
    ? notifications 
    : notifications.filter(n => !n.is_read);

  // Get notifications to display
  const displayNotifications = isExpanded 
    ? filteredNotifications.slice(0, 20) // Show up to 20 when expanded
    : filteredNotifications.slice(0, maxItems);

  const hasMore = filteredNotifications.length > displayNotifications.length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'job_assigned':
      case 'JOB_ASSIGNED':
        return <Wrench className="w-4 h-4 text-[var(--info)]" />;
      case 'job_request':
      case 'request_approved':
      case 'REQUEST_APPROVED':
        return <CheckCircle className="w-4 h-4 text-[var(--success)]" />;
      case 'request_rejected':
      case 'REQUEST_REJECTED':
        return <XCircle className="w-4 h-4 text-[var(--error)]" />;
      case 'job_completed':
      case 'JOB_COMPLETED':
        return <CheckCircle className="w-4 h-4 text-[var(--success)]" />;
      case 'urgent':
      case 'escalation':
      case 'ESCALATION':
        return <AlertTriangle className="w-4 h-4 text-[var(--error)]" />;
      case 'helper_request':
      case 'HELPER_REQUEST':
        return <UserPlus className="w-4 h-4 text-[var(--warning)]" />;
      case 'spare_part_request':
      case 'SPARE_PART_REQUEST':
        return <Package className="w-4 h-4 text-[var(--warning)]" />;
      case 'job_pending':
      case 'JOB_PENDING':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'service_due':
      case 'SERVICE_DUE':
        return <Settings className="w-4 h-4 text-orange-500" />;
      case 'rental_ending':
      case 'RENTAL_ENDING':
        return <Truck className="w-4 h-4 text-purple-500" />;
      case 'leave_request':
      case 'LEAVE_REQUEST':
      case 'leave_approved':
      case 'LEAVE_APPROVED':
      case 'leave_rejected':
      case 'LEAVE_REJECTED':
        return <CalendarDays className="w-4 h-4 text-blue-500" />;
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
    } else if (notification.reference_type === 'forklift' && notification.reference_id) {
      navigate(`/forklifts/${notification.reference_id}`);
    } else if (notification.reference_type === 'leave') {
      navigate('/my-leave');
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

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
      case 'high':
        return 'border-l-4 border-l-red-500';
      case 'medium':
        return 'border-l-4 border-l-amber-500';
      default:
        return 'border-l-4 border-l-transparent';
    }
  };

  if (filteredNotifications.length === 0 && !showReadNotifications) {
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
        {notifications.length > 0 && (
          <button
            onClick={() => setShowReadNotifications(true)}
            className="w-full mt-2 text-xs text-[var(--accent)] hover:underline text-center"
          >
            Show read notifications ({notifications.length})
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="card-premium p-5">
      {/* Header */}
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
            <p className="text-xs text-[var(--text-muted)]">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsRead()}
              className="text-xs text-[var(--accent)] hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Filter Toggle */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setShowReadNotifications(false)}
          className={`px-2 py-1 text-xs rounded-full transition ${
            !showReadNotifications 
              ? 'bg-[var(--accent)] text-white' 
              : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
          }`}
        >
          Unread ({unreadCount})
        </button>
        <button
          onClick={() => setShowReadNotifications(true)}
          className={`px-2 py-1 text-xs rounded-full transition ${
            showReadNotifications 
              ? 'bg-[var(--accent)] text-white' 
              : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]'
          }`}
        >
          All ({notifications.length})
        </button>
      </div>

      {/* Notification List */}
      <div className={`space-y-2 ${isExpanded ? 'max-h-96 overflow-y-auto scrollbar-premium' : ''}`}>
        {displayNotifications.map((notification) => (
          <div
            key={notification.notification_id}
            onClick={() => handleNotificationClick(notification)}
            className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors ${getPriorityColor(notification.priority)} ${
              notification.is_read 
                ? 'bg-[var(--surface)] hover:bg-[var(--bg-subtle)] opacity-70' 
                : 'bg-[var(--bg-subtle)] hover:bg-[var(--surface)]'
            } border border-transparent hover:border-[var(--border)]`}
          >
            <div className="mt-0.5 flex-shrink-0">
              {getNotificationIcon(notification.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className={`text-sm ${notification.is_read ? 'text-[var(--text-secondary)]' : 'font-medium text-[var(--text)]'} line-clamp-1`}>
                  {notification.title}
                </p>
                {!notification.is_read && (
                  <span className="w-2 h-2 rounded-full bg-[var(--accent)] flex-shrink-0 mt-1.5" />
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)] line-clamp-2 mt-0.5">{notification.message}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">{formatTime(notification.created_at)}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 mt-1" />
          </div>
        ))}
      </div>

      {/* Expand/Collapse & View All */}
      <div className="mt-3 flex items-center justify-between">
        {expandable && filteredNotifications.length > maxItems && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3" /> Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" /> Show more ({filteredNotifications.length - maxItems} more)
              </>
            )}
          </button>
        )}
        {hasMore && isExpanded && (
          <button
            onClick={() => navigate('/notifications')}
            className="text-xs text-[var(--accent)] hover:underline"
          >
            View all notifications →
          </button>
        )}
      </div>
    </div>
  );
};

export default DashboardNotificationCard;
