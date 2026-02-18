import {
Building2,
Calendar,
FileText,
Mail,
Phone,
User as UserIcon,
} from 'lucide-react';
import { Employee,EmploymentStatus } from '../../../types';
import { InfoItem } from './InfoItem';

interface ProfileCardProps {
  employee: Employee;
}

/**
 * Profile card showing avatar and basic employee information
 */
export function ProfileCard({ employee }: ProfileCardProps) {
  return (
    <div className="bg-[var(--surface)] rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center overflow-hidden">
            {employee.profile_photo_url ? (
              <img
                loading="lazy"
                decoding="async"
                src={employee.profile_photo_url}
                alt={employee.full_name || employee.name || ''}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-3xl font-bold text-slate-500">
                {(employee.full_name || employee.name || 'U').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="mt-2 text-center">
            <span
              className={`inline-flex items-center gap-1 text-sm px-3 py-1 rounded-full ${
                employee.employment_status === EmploymentStatus.ACTIVE
                  ? 'bg-green-100 text-green-800'
                  : employee.employment_status === EmploymentStatus.ON_LEAVE
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              {employee.employment_status}
            </span>
          </div>
        </div>

        {/* Basic Info Grid */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <InfoItem
            icon={<UserIcon className="w-4 h-4" />}
            label="Employee Code"
            value={employee.employee_code || '-'}
          />
          <InfoItem
            icon={<Phone className="w-4 h-4" />}
            label="Phone"
            value={employee.phone || '-'}
          />
          <InfoItem
            icon={<Mail className="w-4 h-4" />}
            label="Email"
            value={employee.email || '-'}
          />
          <InfoItem
            icon={<Calendar className="w-4 h-4" />}
            label="Joined Date"
            value={new Date(employee.joined_date).toLocaleDateString()}
          />
          <InfoItem
            icon={<Building2 className="w-4 h-4" />}
            label="Department"
            value={employee.department || '-'}
          />
          <InfoItem
            icon={<FileText className="w-4 h-4" />}
            label="IC Number"
            value={employee.ic_number || '-'}
          />
        </div>
      </div>
    </div>
  );
}
