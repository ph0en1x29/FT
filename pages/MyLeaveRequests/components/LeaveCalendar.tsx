import { ChevronLeft,ChevronRight,X } from 'lucide-react';
import { useEffect,useState } from 'react';
import { HRService } from '../../../services/hrService';
import { EmployeeLeave,LeaveStatus,LeaveType } from '../../../types';

interface LeaveCalendarProps {
  userId: string;
  employeeName: string;
  onClose: () => void;
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function LeaveCalendar({ userId, employeeName, onClose }: LeaveCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [leaves, setLeaves] = useState<EmployeeLeave[]>([]);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    loadLeaves();
  }, [year, month]);

  const loadLeaves = async () => {
    try {
      setLoading(true);
      const data = await HRService.getLeaves({
        userId,
        startDate: new Date(year, month, 1).toISOString().split('T')[0],
        endDate: new Date(year, month + 1, 0).toISOString().split('T')[0],
      });
      setLeaves(data.filter(l => l.status === LeaveStatus.APPROVED || l.status === LeaveStatus.PENDING));
    } catch (_error) {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const isLeaveDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return leaves.find(leave => dateStr >= leave.start_date && dateStr <= leave.end_date);
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-10" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const leave = isLeaveDay(day);
      const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
      const isPast = new Date(year, month, day) < new Date(new Date().setHours(0, 0, 0, 0));
      const leaveType = leave?.leave_type as LeaveType;

      days.push(
        <div key={day} className={`h-10 flex items-center justify-center rounded-lg relative ${isToday ? 'ring-2 ring-blue-500' : ''} ${isPast ? 'text-slate-400' : ''}`}>
          {leave ? (
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${leave.status === LeaveStatus.PENDING ? 'bg-yellow-500' : ''}`}
              style={{ backgroundColor: leave.status === LeaveStatus.APPROVED ? leaveType?.color || '#3B82F6' : undefined }}
              title={`${leaveType?.name || 'Leave'} - ${leave.status}`}
            >
              {day}
            </div>
          ) : (
            <span className={isToday ? 'font-bold text-blue-600' : ''}>{day}</span>
          )}
        </div>
      );
    }
    return days;
  };

  const uniqueLeaveTypes = leaves.filter((l, i, arr) => 
    l.status === LeaveStatus.APPROVED && 
    arr.findIndex(x => (x.leave_type as LeaveType)?.leave_type_id === (l.leave_type as LeaveType)?.leave_type_id) === i
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Leave Calendar</h2>
            <p className="text-sm text-slate-500">{employeeName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCurrentDate(new Date(year, month - 1))} className="p-2 hover:bg-slate-100 rounded-lg">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold">{MONTH_NAMES[month]} {year}</h3>
            <button onClick={() => setCurrentDate(new Date(year, month + 1))} className="p-2 hover:bg-slate-100 rounded-lg">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAY_NAMES.map(day => (
              <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-slate-500">{day}</div>
            ))}
          </div>

          {loading ? (
            <div className="h-60 flex items-center justify-center text-slate-500">Loading...</div>
          ) : (
            <div className="grid grid-cols-7 gap-1">{renderCalendar()}</div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-200">
            <h4 className="text-sm font-medium text-slate-700 mb-2">Legend</h4>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-xs text-slate-600">Pending</span>
              </div>
              {uniqueLeaveTypes.map(leave => {
                const leaveType = leave.leave_type as LeaveType;
                return (
                  <div key={leaveType?.leave_type_id} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: leaveType?.color || '#3B82F6' }} />
                    <span className="text-xs text-slate-600">{leaveType?.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {leaves.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <h4 className="text-sm font-medium text-slate-700 mb-2">This Month's Leaves</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {leaves.map(leave => {
                  const leaveType = leave.leave_type as LeaveType;
                  return (
                    <div key={leave.leave_id} className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 rounded-full" style={{
                        backgroundColor: leave.status === LeaveStatus.PENDING ? '#EAB308' : leaveType?.color || '#3B82F6'
                      }} />
                      <span className="text-slate-600">
                        {new Date(leave.start_date).toLocaleDateString()}
                        {leave.start_date !== leave.end_date && ` - ${new Date(leave.end_date).toLocaleDateString()}`}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        leave.status === LeaveStatus.PENDING ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                      }`}>{leave.status}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
