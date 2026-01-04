import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  EmployeeLeave,
  LeaveType,
  LeaveStatus,
  ROLE_PERMISSIONS,
} from '../types_with_invoice_tracking';
import { HRService } from '../services/hrService';
import { showToast } from '../services/toastService';
import {
  ArrowLeft,
  Calendar,
  Plus,
  Clock,
  CheckCircle,
  X,
  AlertTriangle,
  CalendarDays,
  FileText,
  Upload,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react';

interface MyLeaveRequestsProps {
  currentUser: User;
}

export default function MyLeaveRequests({ currentUser }: MyLeaveRequestsProps) {
  const navigate = useNavigate();
  const [leaves, setLeaves] = useState<EmployeeLeave[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddLeave, setShowAddLeave] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'pending' | 'past'>('all');
  
  // Cancel confirmation modal state
  const [cancelModal, setCancelModal] = useState<{
    isOpen: boolean;
    leaveId: string | null;
  }>({ isOpen: false, leaveId: null });

  const canApproveLeave = ROLE_PERMISSIONS[currentUser.role]?.canApproveLeave;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [leavesData, typesData] = await Promise.all([
        HRService.getLeaves({ userId: currentUser.user_id }),
        HRService.getLeaveTypes(),
      ]);
      setLeaves(leavesData);
      setLeaveTypes(typesData);
    } catch (error) {
      console.error('Error loading leave data:', error);
      showToast.error('Failed to load leave data');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (leaveId: string) => {
    try {
      await HRService.cancelLeave(leaveId);
      setCancelModal({ isOpen: false, leaveId: null });
      loadData();
      showToast.success('Leave request cancelled');
    } catch (error) {
      console.error('Error canceling leave:', error);
      showToast.error('Failed to cancel leave');
    }
  };
  
  const openCancelModal = (leaveId: string) => {
    setCancelModal({ isOpen: true, leaveId });
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filteredLeaves = leaves.filter((leave) => {
    const startDate = new Date(leave.start_date);
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

  const getStatusColor = (status: LeaveStatus) => {
    switch (status) {
      case LeaveStatus.APPROVED:
        return 'bg-green-100 text-green-800';
      case LeaveStatus.PENDING:
        return 'bg-yellow-100 text-yellow-800';
      case LeaveStatus.REJECTED:
        return 'bg-red-100 text-red-800';
      case LeaveStatus.CANCELLED:
        return 'bg-slate-100 text-slate-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusIcon = (status: LeaveStatus) => {
    switch (status) {
      case LeaveStatus.APPROVED:
        return <CheckCircle className="w-4 h-4" />;
      case LeaveStatus.PENDING:
        return <Clock className="w-4 h-4" />;
      case LeaveStatus.REJECTED:
        return <X className="w-4 h-4" />;
      case LeaveStatus.CANCELLED:
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  // Summary Stats
  const stats = {
    pending: leaves.filter(l => l.status === LeaveStatus.PENDING).length,
    approved: leaves.filter(l => l.status === LeaveStatus.APPROVED && new Date(l.end_date) >= today).length,
    totalDays: leaves
      .filter(l => l.status === LeaveStatus.APPROVED)
      .reduce((acc, l) => acc + (l.total_days || 0), 0),
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-theme rounded-xl p-4 theme-transition">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-theme-muted">Pending Approval</p>
              <p className="text-2xl font-bold text-theme">{stats.pending}</p>
            </div>
          </div>
        </div>
        <div className="card-theme rounded-xl p-4 theme-transition">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-theme-muted">Upcoming Approved</p>
              <p className="text-2xl font-bold text-theme">{stats.approved}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Days Used</p>
              <p className="text-2xl font-bold text-slate-800">{stats.totalDays}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200 px-4">
          <nav className="flex -mb-px">
            {(['all', 'upcoming', 'pending', 'past'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition capitalize ${
                  filter === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-800'
                }`}
              >
                {tab}
                {tab === 'pending' && stats.pending > 0 && (
                  <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full">
                    {stats.pending}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Leave List */}
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
              {filteredLeaves.map((leave) => {
                const isUpcoming = new Date(leave.start_date) > today;
                const isCurrent = new Date(leave.start_date) <= today && new Date(leave.end_date) >= today;
                const canCancel = (leave.status === LeaveStatus.PENDING || 
                  (leave.status === LeaveStatus.APPROVED && new Date(leave.start_date) > today));

                return (
                  <div
                    key={leave.leave_id}
                    className={`border rounded-lg p-4 ${
                      isCurrent ? 'border-blue-300 bg-blue-50' :
                      isUpcoming && leave.status === LeaveStatus.APPROVED ? 'border-green-200 bg-green-50' :
                      leave.status === LeaveStatus.PENDING ? 'border-yellow-200 bg-yellow-50' :
                      'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: (leave.leave_type as LeaveType)?.color || '#3B82F6',
                            }}
                          />
                          <h4 className="font-medium text-slate-800">
                            {(leave.leave_type as LeaveType)?.name || 'Leave'}
                          </h4>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${getStatusColor(leave.status)}`}
                          >
                            {getStatusIcon(leave.status)}
                            {leave.status}
                          </span>
                          {isCurrent && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                              Currently on leave
                            </span>
                          )}
                          {isUpcoming && leave.status === LeaveStatus.APPROVED && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                              Scheduled
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          <div>
                            <span className="text-slate-500">From:</span>{' '}
                            <span className="text-slate-800">
                              {new Date(leave.start_date).toLocaleDateString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">To:</span>{' '}
                            <span className="text-slate-800">
                              {new Date(leave.end_date).toLocaleDateString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">Days:</span>{' '}
                            <span className="text-slate-800">
                              {leave.total_days}
                              {leave.is_half_day && ` (${leave.half_day_type})`}
                            </span>
                          </div>
                          {leave.requested_at && (
                            <div>
                              <span className="text-slate-500">Requested:</span>{' '}
                              <span className="text-slate-800">
                                {new Date(leave.requested_at).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                        {leave.reason && (
                          <p className="text-sm text-slate-600 mt-2">
                            <span className="text-slate-500">Reason:</span> {leave.reason}
                          </p>
                        )}
                        {leave.rejection_reason && (
                          <p className="text-sm text-red-600 mt-2">
                            <span className="text-red-500">Rejection reason:</span> {leave.rejection_reason}
                          </p>
                        )}
                        {leave.approved_at && leave.approved_by_name && (
                          <p className="text-xs text-slate-500 mt-2">
                            Approved by {leave.approved_by_name} on {new Date(leave.approved_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      {canCancel && (
                        <button
                          onClick={() => handleCancel(leave.leave_id)}
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Cancel leave request"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add Leave Modal */}
      {showAddLeave && (
        <AddLeaveModal
          userId={currentUser.user_id}
          leaveTypes={leaveTypes}
          onClose={() => setShowAddLeave(false)}
          onSave={async (data) => {
            await HRService.createLeave(data);
            loadData();
            setShowAddLeave(false);
          }}
        />
      )}

      {/* Calendar Modal */}
      {showCalendar && (
        <LeaveCalendarModal
          userId={currentUser.user_id}
          employeeName={currentUser.name}
          onClose={() => setShowCalendar(false)}
        />
      )}
    </div>
  );
}


// Add Leave Modal with Scheduling
function AddLeaveModal({
  userId,
  leaveTypes,
  onClose,
  onSave,
}: {
  userId: string;
  leaveTypes: LeaveType[];
  onClose: () => void;
  onSave: (data: Partial<EmployeeLeave>) => Promise<void>;
}) {
  const today = new Date().toISOString().split('T')[0];
  const documentInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    is_half_day: false,
    half_day_type: 'morning' as 'morning' | 'afternoon',
    reason: '',
  });
  const [supportingDocument, setSupportingDocument] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const selectedLeaveType = leaveTypes.find(lt => lt.leave_type_id === formData.leave_type_id);
  
  const calculateDays = () => {
    if (!formData.start_date || !formData.end_date) return 0;
    if (formData.is_half_day) return 0.5;
    
    const start = new Date(formData.start_date);
    const end = new Date(formData.end_date);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const totalDays = calculateDays();
  const isSchedulingAhead = formData.start_date && new Date(formData.start_date) > new Date();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.leave_type_id || !formData.start_date || !formData.end_date) {
      alert('Please fill in required fields');
      return;
    }

    if (new Date(formData.start_date) > new Date(formData.end_date)) {
      alert('End date must be after start date');
      return;
    }

    if (selectedLeaveType?.requires_document && !supportingDocument) {
      alert(`${selectedLeaveType.name} requires a supporting document`);
      return;
    }

    setSaving(true);
    try {
      let documentUrl = '';
      if (supportingDocument) {
        setUploadProgress('Uploading document...');
        documentUrl = await HRService.uploadLeaveDocument(userId, supportingDocument);
      }

      setUploadProgress('Submitting request...');
      await onSave({
        user_id: userId,
        leave_type_id: formData.leave_type_id,
        start_date: formData.start_date,
        end_date: formData.is_half_day ? formData.start_date : formData.end_date,
        is_half_day: formData.is_half_day,
        half_day_type: formData.is_half_day ? formData.half_day_type : undefined,
        reason: formData.reason,
        supporting_document_url: documentUrl || undefined,
        total_days: totalDays,
      });
    } catch (error) {
      console.error('Error submitting leave:', error);
      alert('Failed to submit leave request');
    } finally {
      setSaving(false);
      setUploadProgress('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Request Leave</h2>
            <p className="text-sm text-slate-500">Submit a leave request for approval</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Leave Type *</label>
            <select
              value={formData.leave_type_id}
              onChange={(e) => setFormData({ ...formData, leave_type_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              required
            >
              <option value="">Select Leave Type</option>
              {leaveTypes.map((lt) => (
                <option key={lt.leave_type_id} value={lt.leave_type_id}>
                  {lt.name}{lt.requires_document && ' (Document Required)'}
                </option>
              ))}
            </select>
            {selectedLeaveType && (
              <div className="mt-2 p-2 bg-slate-50 rounded text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedLeaveType.color }} />
                  <span>{selectedLeaveType.description || selectedLeaveType.name}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_half_day}
                onChange={(e) => setFormData({
                  ...formData,
                  is_half_day: e.target.checked,
                  end_date: e.target.checked ? formData.start_date : formData.end_date,
                })}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-slate-700">Half Day</span>
            </label>
            {formData.is_half_day && (
              <select
                value={formData.half_day_type}
                onChange={(e) => setFormData({ ...formData, half_day_type: e.target.value as 'morning' | 'afternoon' })}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
              >
                <option value="morning">Morning (AM)</option>
                <option value="afternoon">Afternoon (PM)</option>
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {formData.is_half_day ? 'Date *' : 'Start Date *'}
              </label>
              <input
                type="date"
                value={formData.start_date}
                min={today}
                onChange={(e) => setFormData({
                  ...formData,
                  start_date: e.target.value,
                  end_date: formData.is_half_day || !formData.end_date || e.target.value > formData.end_date 
                    ? e.target.value : formData.end_date,
                })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                required
              />
            </div>
            {!formData.is_half_day && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">End Date *</label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  min={formData.start_date || today}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
            )}
          </div>

          {formData.start_date && formData.end_date && (
            <div className={`p-3 rounded-lg ${isSchedulingAhead ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isSchedulingAhead ? (
                    <>
                      <CalendarDays className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">Scheduling Ahead</span>
                    </>
                  ) : (
                    <>
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">Leave Duration</span>
                    </>
                  )}
                </div>
                <span className={`text-lg font-bold ${isSchedulingAhead ? 'text-green-700' : 'text-blue-700'}`}>
                  {totalDays} {totalDays === 1 || totalDays === 0.5 ? 'day' : 'days'}
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              placeholder="Please provide a reason..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Supporting Document {selectedLeaveType?.requires_document ? '*' : '(Optional)'}
            </label>
            <input ref={documentInputRef} type="file" accept="image/*,.pdf" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setSupportingDocument(file);
            }} className="hidden" />
            <div
              onClick={() => documentInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-3 cursor-pointer transition hover:border-blue-400 hover:bg-blue-50 ${
                supportingDocument ? 'border-blue-300 bg-blue-50' : 'border-slate-300'
              }`}
            >
              {supportingDocument ? (
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{supportingDocument.name}</p>
                    <p className="text-xs text-slate-500">{(supportingDocument.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setSupportingDocument(null); }}
                    className="ml-auto p-1 text-slate-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="text-center py-2">
                  <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                  <p className="text-sm text-slate-500">Click to upload</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg" disabled={saving}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? uploadProgress || 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// Leave Calendar Modal
function LeaveCalendarModal({
  userId,
  employeeName,
  onClose,
}: {
  userId: string;
  employeeName: string;
  onClose: () => void;
}) {
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
    } catch (error) {
      console.error('Error loading leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

      days.push(
        <div key={day} className={`h-10 flex items-center justify-center rounded-lg relative ${isToday ? 'ring-2 ring-blue-500' : ''} ${isPast ? 'text-slate-400' : ''}`}>
          {leave ? (
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${leave.status === LeaveStatus.PENDING ? 'bg-yellow-500' : ''}`}
              style={{ backgroundColor: leave.status === LeaveStatus.APPROVED ? (leave.leave_type as LeaveType)?.color || '#3B82F6' : undefined }}
              title={`${(leave.leave_type as LeaveType)?.name || 'Leave'} - ${leave.status}`}
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
            <h3 className="text-lg font-semibold">{monthNames[month]} {year}</h3>
            <button onClick={() => setCurrentDate(new Date(year, month + 1))} className="p-2 hover:bg-slate-100 rounded-lg">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map(day => (
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
              {leaves.filter((l, i, arr) => 
                l.status === LeaveStatus.APPROVED && 
                arr.findIndex(x => (x.leave_type as LeaveType)?.leave_type_id === (l.leave_type as LeaveType)?.leave_type_id) === i
              ).map(leave => (
                <div key={(leave.leave_type as LeaveType)?.leave_type_id} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: (leave.leave_type as LeaveType)?.color || '#3B82F6' }} />
                  <span className="text-xs text-slate-600">{(leave.leave_type as LeaveType)?.name}</span>
                </div>
              ))}
            </div>
          </div>

          {leaves.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <h4 className="text-sm font-medium text-slate-700 mb-2">This Month's Leaves</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {leaves.map(leave => (
                  <div key={leave.leave_id} className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full" style={{
                      backgroundColor: leave.status === LeaveStatus.PENDING ? '#EAB308' : (leave.leave_type as LeaveType)?.color || '#3B82F6'
                    }} />
                    <span className="text-slate-600">
                      {new Date(leave.start_date).toLocaleDateString()}
                      {leave.start_date !== leave.end_date && ` - ${new Date(leave.end_date).toLocaleDateString()}`}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      leave.status === LeaveStatus.PENDING ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                    }`}>{leave.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
