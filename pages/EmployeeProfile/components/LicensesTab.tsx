import {
AlertTriangle,
Car,
CheckCircle,
Clock,
Image as ImageIcon,
Plus,
Trash2,
} from 'lucide-react';
import { HRService } from '../../../services/hrService';
import { showToast } from '../../../services/toastService';
import { LicensesTabProps } from '../types';

/**
 * LicensesTab - Displays and manages employee driving licenses
 * Shows license cards with expiry status indicators
 * Supports adding and deleting licenses
 */
export default function LicensesTab({
  employee,
  canManage,
  onAdd,
  onRefresh,
}: LicensesTabProps) {
  const licenses = employee.licenses || [];

  const getDaysUntilExpiry = (expiryDate: string) => {
    return Math.ceil(
      (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
  };

  const handleDelete = async (licenseId: string) => {
    if (!confirm('Are you sure you want to delete this license?')) return;
    try {
      await HRService.deleteLicense(licenseId);
      onRefresh();
    } catch (_error) {
      showToast.error('Failed to delete license');
      alert('Failed to delete license');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-slate-800">Driving Licenses</h3>
        {canManage && (
          <button
            onClick={onAdd}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add License
          </button>
        )}
      </div>

      {licenses.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <Car className="w-12 h-12 mx-auto mb-2 text-slate-300" />
          <p>No licenses recorded</p>
          {canManage && (
            <button
              onClick={onAdd}
              className="mt-2 text-blue-600 hover:underline text-sm"
            >
              Add your first license
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {licenses.map((license) => {
            const daysLeft = getDaysUntilExpiry(license.expiry_date);
            const isExpired = daysLeft < 0;
            const isExpiring = daysLeft <= 30 && daysLeft >= 0;

            return (
              <div
                key={license.license_id}
                className={`border rounded-lg p-4 ${
                  isExpired ? 'border-red-300 bg-red-50' : 
                  isExpiring ? 'border-yellow-300 bg-yellow-50' : 
                  'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium text-slate-800">
                        {license.license_type}
                      </h4>
                      {isExpired && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Expired {Math.abs(daysLeft)} days ago
                        </span>
                      )}
                      {isExpiring && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Expiring in {daysLeft} days
                        </span>
                      )}
                      {!isExpired && !isExpiring && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Valid
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="text-slate-500">License No:</span>{' '}
                        <span className="text-slate-800">
                          {license.license_number}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Expiry:</span>{' '}
                        <span
                          className={
                            isExpired || isExpiring
                              ? 'text-red-600 font-medium'
                              : 'text-slate-800'
                          }
                        >
                          {new Date(license.expiry_date).toLocaleDateString()}
                        </span>
                      </div>
                      {license.issue_date && (
                        <div>
                          <span className="text-slate-500">Issued:</span>{' '}
                          <span className="text-slate-800">
                            {new Date(license.issue_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {license.issuing_authority && (
                        <div>
                          <span className="text-slate-500">Issuer:</span>{' '}
                          <span className="text-slate-800">
                            {license.issuing_authority}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* License Images */}
                    {(license.license_front_image_url ||
                      license.license_back_image_url) && (
                      <div className="flex gap-3 mt-3">
                        {license.license_front_image_url && (
                          <a
                            href={license.license_front_image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded"
                          >
                            <ImageIcon className="w-3 h-3" />
                            View Front
                          </a>
                        )}
                        {license.license_back_image_url && (
                          <a
                            href={license.license_back_image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded"
                          >
                            <ImageIcon className="w-3 h-3" />
                            View Back
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {canManage && (
                    <button
                      onClick={() => handleDelete(license.license_id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
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
  );
}
