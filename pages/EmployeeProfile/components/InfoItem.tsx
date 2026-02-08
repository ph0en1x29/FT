import { InfoItemProps } from '../types';

/**
 * InfoItem - Displays a labeled piece of information with an icon
 * Used throughout the employee profile for consistent info display
 */
export function InfoItem({ icon, label, value }: InfoItemProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600">
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-800">{value}</p>
      </div>
    </div>
  );
}
