import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, User as UserIcon } from 'lucide-react';

/**
 * Loading state component
 */
export function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-slate-500">Loading employee...</div>
    </div>
  );
}

interface ProfileNotSetUpProps {
  onBack: () => void;
}

/**
 * State when viewing own profile but employee record doesn't exist
 */
export function ProfileNotSetUp({ onBack }: ProfileNotSetUpProps) {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <UserIcon className="w-8 h-8 text-slate-400" />
      </div>
      <h2 className="text-xl font-semibold text-slate-800 mb-2">
        Profile Not Set Up
      </h2>
      <p className="text-slate-600 mb-4 max-w-md mx-auto">
        Your employee profile hasn't been created yet. Please contact your
        administrator or HR to set up your employee record.
      </p>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>
    </div>
  );
}

/**
 * State when employee is not found (viewing another user's profile)
 */
export function EmployeeNotFound() {
  return (
    <div className="text-center py-12">
      <h2 className="text-xl font-semibold text-slate-800">
        Employee not found
      </h2>
      <Link
        to="/hr/employees"
        className="text-blue-600 hover:underline mt-2 inline-block"
      >
        Back to Employees
      </Link>
    </div>
  );
}
