import React from 'react';
import { ArrowLeft, Edit, Save, X } from 'lucide-react';
import { Employee } from '../../../types';

interface ProfileHeaderProps {
  employee: Employee;
  isOwnProfile: boolean;
  editing: boolean;
  canEdit: boolean;
  onNavigateBack: () => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * Header component with navigation, title, and edit controls
 */
export function ProfileHeader({
  employee,
  isOwnProfile,
  editing,
  canEdit,
  onNavigateBack,
  onStartEdit,
  onSave,
  onCancel,
}: ProfileHeaderProps) {
  return (
    <div className="flex items-center gap-4">
      <button
        onClick={onNavigateBack}
        className="p-2 hover:bg-slate-100 rounded-lg transition"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-slate-800">
          {isOwnProfile ? 'My Profile' : (employee.full_name || employee.name)}
        </h1>
        <p className="text-slate-600">
          {employee.position}
          {employee.department && ` • ${employee.department}`}
        </p>
      </div>
      {canEdit && !editing && (
        <button
          onClick={onStartEdit}
          className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
        >
          <Edit className="w-5 h-5" />
          Edit
        </button>
      )}
      {editing && (
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
            Cancel
          </button>
          <button
            onClick={onSave}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Save className="w-5 h-5" />
            Save
          </button>
        </div>
      )}
    </div>
  );
}
