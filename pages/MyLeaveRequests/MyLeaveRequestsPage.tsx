import { ArrowLeft,Calendar,CalendarDays,Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../../types';
import {
LeaveCalendar,
LeaveFilterTabs,
LeaveRequestCard,
LeaveStatsCards,
NewLeaveRequestModal,
} from './components';
import { LeaveFilter,useLeaveData } from './hooks/useLeaveData';

interface MyLeaveRequestsPageProps {
  currentUser: User;
}

export default function MyLeaveRequestsPage({ currentUser }: MyLeaveRequestsPageProps) {
  const navigate = useNavigate();
  const [showAddLeave, setShowAddLeave] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [filter, setFilter] = useState<LeaveFilter>('all');

  const {
    leaveTypes,
    loading,
    stats,
    cancelLeave,
    createLeave,
    filterLeaves,
  } = useLeaveData(currentUser.user_id);

  const filteredLeaves = filterLeaves(filter);

  const handleCancelLeave = async (leaveId: string) => {
    await cancelLeave(leaveId);
  };

  const handleCreateLeave = async (data: Parameters<typeof createLeave>[0]) => {
    await createLeave(data);
    setShowAddLeave(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-theme-muted">Loading your leave requests...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-theme-surface-2 rounded-lg transition theme-transition"
        >
          <ArrowLeft className="w-5 h-5 text-theme" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-theme">My Leave Requests</h1>
          <p className="text-theme-muted">Manage your leave applications</p>
        </div>
        <button
          onClick={() => setShowCalendar(true)}
          className="flex items-center gap-2 px-4 py-2 border border-theme text-theme-muted rounded-lg hover:bg-theme-surface-2 transition theme-transition"
        >
          <CalendarDays className="w-5 h-5" />
          Calendar
        </button>
        <button
          onClick={() => setShowAddLeave(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" />
          Request Leave
        </button>
      </div>

      {/* Stats Cards */}
      <LeaveStatsCards stats={stats} />

      {/* Filter Tabs & Leave List */}
      <div className="bg-[var(--surface)] rounded-xl shadow-sm border border-slate-200">
        <LeaveFilterTabs
          filter={filter}
          onFilterChange={setFilter}
          pendingCount={stats.pending}
        />

        <div className="p-4">
          {filteredLeaves.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No leave requests found</p>
              <button
                onClick={() => setShowAddLeave(true)}
                className="mt-2 text-blue-600 hover:underline text-sm"
              >
                Submit your first leave request
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLeaves.map((leave) => (
                <div key={leave.leave_id}>
                  <LeaveRequestCard
                    leave={leave}
                    onCancel={handleCancelLeave}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddLeave && (
        <NewLeaveRequestModal
          userId={currentUser.user_id}
          leaveTypes={leaveTypes}
          onClose={() => setShowAddLeave(false)}
          onSave={handleCreateLeave}
        />
      )}

      {showCalendar && (
        <LeaveCalendar
          userId={currentUser.user_id}
          employeeName={currentUser.name}
          onClose={() => setShowCalendar(false)}
        />
      )}
    </div>
  );
}
