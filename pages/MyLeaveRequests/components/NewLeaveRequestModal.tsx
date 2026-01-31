import React, { useState, useRef } from 'react';
import { EmployeeLeave, LeaveType } from '../../../types';
import { HRService } from '../../../services/hrService';
import { X, Calendar, CalendarDays, FileText, Upload } from 'lucide-react';

interface NewLeaveRequestModalProps {
  userId: string;
  leaveTypes: LeaveType[];
  onClose: () => void;
  onSave: (data: Partial<EmployeeLeave>) => Promise<void>;
}

export function NewLeaveRequestModal({
  userId,
  leaveTypes,
  onClose,
  onSave,
}: NewLeaveRequestModalProps) {
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
