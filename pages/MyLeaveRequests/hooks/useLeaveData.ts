import { useCallback,useEffect,useState } from 'react';
import { HRService } from '../../../services/hrService';
import { showToast } from '../../../services/toastService';
import { EmployeeLeave,LeaveStatus,LeaveType } from '../../../types';

export interface LeaveStats {
  pending: number;
  approved: number;
  totalDays: number;
}

export type LeaveFilter = 'all' | 'upcoming' | 'pending' | 'past';

export function useLeaveData(userId: string) {
  const [leaves, setLeaves] = useState<EmployeeLeave[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [leavesData, typesData] = await Promise.all([
        HRService.getLeaves({ userId }),
        HRService.getLeaveTypes(),
      ]);
      setLeaves(leavesData);
      setLeaveTypes(typesData);
    } catch (_error) {
      showToast.error('Failed to load leave data');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const cancelLeave = async (leaveId: string) => {
    try {
      await HRService.cancelLeave(leaveId);
      await loadData();
      showToast.success('Leave request cancelled');
      return true;
    } catch (_error) {
      showToast.error('Failed to cancel leave');
      return false;
    }
  };

  const createLeave = async (data: Partial<EmployeeLeave>) => {
    await HRService.createLeave(data);
    await loadData();
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stats: LeaveStats = {
    pending: leaves.filter(l => l.status === LeaveStatus.PENDING).length,
    approved: leaves.filter(l => l.status === LeaveStatus.APPROVED && new Date(l.end_date) >= today).length,
    totalDays: leaves
      .filter(l => l.status === LeaveStatus.APPROVED)
      .reduce((acc, l) => acc + (l.total_days || 0), 0),
  };

  const filterLeaves = (filter: LeaveFilter): EmployeeLeave[] => {
    return leaves.filter((leave) => {
      const endDate = new Date(leave.end_date);

      switch (filter) {
        case 'upcoming':
          return endDate >= today && (leave.status === LeaveStatus.APPROVED || leave.status === LeaveStatus.PENDING);
        case 'pending':
          return leave.status === LeaveStatus.PENDING;
        case 'past':
          return endDate < today || leave.status === LeaveStatus.CANCELLED || leave.status === LeaveStatus.REJECTED;
        default:
          return true;
      }
    });
  };

  return {
    leaves,
    leaveTypes,
    loading,
    stats,
    loadData,
    cancelLeave,
    createLeave,
    filterLeaves,
  };
}
