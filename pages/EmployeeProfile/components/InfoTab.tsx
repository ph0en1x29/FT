import { MapPin,Phone } from 'lucide-react';
import { EmploymentStatus } from '../../../types';
import { InfoTabProps } from '../types';

/**
 * InfoTab - Displays and edits employee personal information
 * Shows address, emergency contact, and notes in view mode
 * Provides form inputs for editing all employee details
 */
export function InfoTab({
  employee,
  editing,
  editData,
  setEditData,
}: InfoTabProps) {
  if (editing) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={editData.full_name || ''}
              onChange={(e) =>
                setEditData({ ...editData, full_name: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Employee Code
            </label>
            <input
              type="text"
              value={editData.employee_code || ''}
              onChange={(e) =>
                setEditData({ ...editData, employee_code: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={editData.phone || ''}
              onChange={(e) =>
                setEditData({ ...editData, phone: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={editData.email || ''}
              onChange={(e) =>
                setEditData({ ...editData, email: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              IC Number
            </label>
            <input
              type="text"
              value={editData.ic_number || ''}
              onChange={(e) =>
                setEditData({ ...editData, ic_number: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Department
            </label>
            <input
              type="text"
              value={editData.department || ''}
              onChange={(e) =>
                setEditData({ ...editData, department: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Position
            </label>
            <input
              type="text"
              value={editData.position || ''}
              onChange={(e) =>
                setEditData({ ...editData, position: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Status
            </label>
            <select
              value={editData.employment_status}
              onChange={(e) =>
                setEditData({
                  ...editData,
                  employment_status: e.target.value as EmploymentStatus,
                })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            >
              <option value={EmploymentStatus.ACTIVE}>Active</option>
              <option value={EmploymentStatus.INACTIVE}>Inactive</option>
              <option value={EmploymentStatus.ON_LEAVE}>On Leave</option>
              <option value={EmploymentStatus.TERMINATED}>Terminated</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Address
          </label>
          <textarea
            value={editData.address || ''}
            onChange={(e) =>
              setEditData({ ...editData, address: e.target.value })
            }
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
          />
        </div>

        <div>
          <h4 className="font-medium text-slate-700 mb-3">Emergency Contact</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Name"
              value={editData.emergency_contact_name || ''}
              onChange={(e) =>
                setEditData({
                  ...editData,
                  emergency_contact_name: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
            <input
              type="tel"
              placeholder="Phone"
              value={editData.emergency_contact_phone || ''}
              onChange={(e) =>
                setEditData({
                  ...editData,
                  emergency_contact_phone: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
            <input
              type="text"
              placeholder="Relationship"
              value={editData.emergency_contact_relationship || ''}
              onChange={(e) =>
                setEditData({
                  ...editData,
                  emergency_contact_relationship: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Address */}
      {employee.address && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-2">Address</h4>
          <p className="text-slate-600 flex items-start gap-2">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {employee.address}
          </p>
        </div>
      )}

      {/* Emergency Contact */}
      {employee.emergency_contact_name && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-2">
            Emergency Contact
          </h4>
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="font-medium text-slate-800">
              {employee.emergency_contact_name}
            </p>
            <p className="text-sm text-slate-600">
              {employee.emergency_contact_relationship}
            </p>
            {employee.emergency_contact_phone && (
              <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                <Phone className="w-3 h-3" />
                {employee.emergency_contact_phone}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {employee.notes && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-2">Notes</h4>
          <p className="text-slate-600">{employee.notes}</p>
        </div>
      )}
    </div>
  );
}
