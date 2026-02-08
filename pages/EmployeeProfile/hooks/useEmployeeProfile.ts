import React,{ useCallback,useEffect,useState } from 'react';
import { HRService } from '../../../services/hrService';
import { showToast } from '../../../services/toastService';
import { Employee,LeaveType } from '../../../types';

interface UseEmployeeProfileParams {
  userId: string | undefined;
  currentUserId: string;
  currentUserName: string;
}

interface UseEmployeeProfileReturn {
  employee: Employee | null;
  loading: boolean;
  editing: boolean;
  editData: Partial<Employee>;
  leaveTypes: LeaveType[];
  setEditing: (editing: boolean) => void;
  setEditData: React.Dispatch<React.SetStateAction<Partial<Employee>>>;
  handleSave: () => Promise<void>;
  loadEmployee: () => Promise<void>;
  cancelEdit: () => void;
}

/**
 * Hook for managing employee profile data and editing state
 */
export function useEmployeeProfile({
  userId,
  currentUserId,
  currentUserName,
}: UseEmployeeProfileParams): UseEmployeeProfileReturn {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Employee>>({});
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);

  const loadEmployee = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const data = await HRService.getEmployeeByUserId(userId);
      setEmployee(data);
      if (data) {
        setEditData(data);
      }
    } catch (error) {
      showToast.error('Failed to load employee profile');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadLeaveTypes = useCallback(async () => {
    try {
      const types = await HRService.getLeaveTypes();
      setLeaveTypes(types);
    } catch (error) {
      showToast.error('Failed to load leave types');
    }
  }, []);

  useEffect(() => {
    if (userId) {
      loadEmployee();
      loadLeaveTypes();
    }
  }, [userId, loadEmployee, loadLeaveTypes]);

  const handleSave = async () => {
    if (!userId || !employee) return;
    try {
      await HRService.updateEmployee(
        userId,
        editData,
        currentUserId,
        currentUserName
      );
      setEmployee({ ...employee, ...editData });
      setEditing(false);
    } catch (error) {
      showToast.error('Failed to update employee');
    }
  };

  const cancelEdit = () => {
    setEditing(false);
    if (employee) {
      setEditData(employee);
    }
  };

  return {
    employee,
    loading,
    editing,
    editData,
    leaveTypes,
    setEditing,
    setEditData,
    handleSave,
    loadEmployee,
    cancelEdit,
  };
}
