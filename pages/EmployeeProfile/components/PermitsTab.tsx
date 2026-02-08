import {
AlertTriangle,
CheckCircle,
Clock,
FileText,
Plus,
Shield,
Trash2,
} from 'lucide-react';
import { HRService } from '../../../services/hrService';
import { showToast } from '../../../services/toastService';
import { PermitsTabProps } from '../types';

/**
 * PermitsTab - Displays and manages employee special permits
 * Shows permit cards with expiry status and restricted areas
 * Supports adding and deleting permits
 */
export default function PermitsTab({
  employee,
  canManage,
  onAdd,
  onRefresh,
}: PermitsTabProps) {
  const permits = employee.permits || [];

  const getDaysUntilExpiry = (expiryDate: string) => {
    return Math.ceil(
      (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
  };

  const handleDelete = async (permitId: string) => {
    if (!confirm('Are you sure you want to delete this permit?')) return;
    try {
      await HRService.deletePermit(permitId);
      onRefresh();
    } catch (error) {
      showToast.error('Failed to delete permit');
      alert('Failed to delete permit');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-slate-800">Special Permits</h3>
        {canManage && (
          <button
            onClick={onAdd}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add Permit
          </button>
        )}
      </div>

      {permits.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <Shield className="w-12 h-12 mx-auto mb-2 text-slate-300" />
          <p>No permits recorded</p>
          {canManage && (
            <button
              onClick={onAdd}
              className="mt-2 text-blue-600 hover:underline text-sm"
            >
              Add your first permit
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {permits.map((permit) => {
            const daysLeft = getDaysUntilExpiry(permit.expiry_date);
            const isExpired = daysLeft < 0;
            const isExpiring = daysLeft <= 30 && daysLeft >= 0;

            return (
              <div
                key={permit.permit_id}
                className={`border rounded-lg p-4 ${
                  isExpired ? 'border-red-300 bg-red-50' : 
                  isExpiring ? 'border-yellow-300 bg-yellow-50' : 
                  'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h4 className="font-medium text-slate-800">
                        {permit.permit_type}
                      </h4>
                      {permit.permit_name && (
                        <span className="text-sm text-slate-600">
                          - {permit.permit_name}
                        </span>
                      )}
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
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-slate-500">Permit No:</span>{' '}
                        <span className="text-slate-800">
                          {permit.permit_number}
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
                          {new Date(permit.expiry_date).toLocaleDateString()}
                        </span>
                      </div>
                      {permit.issue_date && (
                        <div>
                          <span className="text-slate-500">Issued:</span>{' '}
                          <span className="text-slate-800">
                            {new Date(permit.issue_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {permit.issuing_authority && (
                        <div>
                          <span className="text-slate-500">Issuer:</span>{' '}
                          <span className="text-slate-800">
                            {permit.issuing_authority}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Restricted Areas */}
                    {permit.restricted_areas &&
                      permit.restricted_areas.length > 0 && (
                        <div className="mt-2">
                          <span className="text-sm text-slate-500">
                            Access Areas:
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {permit.restricted_areas.map((area, idx) => (
                              <span
                                key={idx}
                                className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded"
                              >
                                {area}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Document Link */}
                    {permit.permit_document_url && (
                      <a
                        href={permit.permit_document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-3 bg-blue-50 px-2 py-1 rounded w-fit"
                      >
                        <FileText className="w-3 h-3" />
                        View Document
                      </a>
                    )}
                  </div>

                  {canManage && (
                    <button
                      onClick={() => handleDelete(permit.permit_id)}
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
