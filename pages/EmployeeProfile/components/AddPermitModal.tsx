import { FileText,Upload,X } from 'lucide-react';
import React,{ useRef,useState } from 'react';
import { HRService } from '../../../services/hrService';
import { showToast } from '../../../services/toastService';
import { LicenseStatus } from '../../../types';
import { AddPermitModalProps } from '../types';

/**
 * AddPermitModal - Modal form for adding a new special permit
 * Supports uploading permit document (image or PDF)
 */
export default function AddPermitModal({
  userId,
  onClose,
  onSave,
}: AddPermitModalProps) {
  const [formData, setFormData] = useState({
    permit_type: '',
    permit_number: '',
    permit_name: '',
    issuing_authority: '',
    issue_date: '',
    expiry_date: '',
    restricted_areas: '',
    alert_days_before: 30,
    notes: '',
  });
  const [permitDocument, setPermitDocument] = useState<File | null>(null);
  const [documentPreview, setDocumentPreview] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const documentInputRef = useRef<HTMLInputElement>(null);

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPermitDocument(file);
      // For images, show preview; for PDFs, show file name
      if (file.type.startsWith('image/')) {
        setDocumentPreview(URL.createObjectURL(file));
      } else {
        setDocumentPreview('');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.permit_type || !formData.permit_number || !formData.expiry_date) {
      alert('Please fill in required fields (Permit Type, Number, and Expiry Date)');
      return;
    }
    setSaving(true);
    try {
      let documentUrl = '';

      // Upload document if provided
      if (permitDocument) {
        setUploadProgress('Uploading document...');
        documentUrl = await HRService.uploadPermitDocument(userId, permitDocument);
      }

      setUploadProgress('Saving permit...');
      await onSave({
        user_id: userId,
        permit_type: formData.permit_type,
        permit_number: formData.permit_number,
        permit_name: formData.permit_name,
        issuing_authority: formData.issuing_authority,
        issue_date: formData.issue_date || undefined,
        expiry_date: formData.expiry_date,
        restricted_areas: formData.restricted_areas
          ? formData.restricted_areas.split(',').map((s) => s.trim()).filter(s => s)
          : [],
        alert_days_before: formData.alert_days_before,
        permit_document_url: documentUrl || undefined,
        notes: formData.notes || undefined,
        status: LicenseStatus.ACTIVE,
      });
    } catch (_error) {
      showToast.error('Failed to save permit');
      alert('Failed to save permit. Please try again.');
    } finally {
      setSaving(false);
      setUploadProgress('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-slate-800">Add Special Permit</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Permit Type *
              </label>
              <select
                value={formData.permit_type}
                onChange={(e) => setFormData({ ...formData, permit_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select Type</option>
                <option value="Security Clearance">Security Clearance</option>
                <option value="Hazardous Area">Hazardous Area Access</option>
                <option value="Port Access">Port Access</option>
                <option value="Airport Access">Airport Access</option>
                <option value="Factory Entry">Factory Entry</option>
                <option value="Restricted Zone">Restricted Zone</option>
                <option value="Safety Permit">Safety Permit</option>
                <option value="Work Permit">Work Permit</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Permit Number *
              </label>
              <input
                type="text"
                value={formData.permit_number}
                onChange={(e) => setFormData({ ...formData, permit_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., PMT-2024-001"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Permit Name/Description
            </label>
            <input
              type="text"
              value={formData.permit_name}
              onChange={(e) => setFormData({ ...formData, permit_name: e.target.value })}
              placeholder="e.g., Shell Refinery Access Pass"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Issuing Authority
            </label>
            <input
              type="text"
              value={formData.issuing_authority}
              onChange={(e) => setFormData({ ...formData, issuing_authority: e.target.value })}
              placeholder="e.g., Shell Malaysia Security Dept"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Issue Date
              </label>
              <input
                type="date"
                value={formData.issue_date}
                onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Expiry Date *
              </label>
              <input
                type="date"
                value={formData.expiry_date}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Restricted/Authorized Areas (comma-separated)
            </label>
            <input
              type="text"
              value={formData.restricted_areas}
              onChange={(e) => setFormData({ ...formData, restricted_areas: e.target.value })}
              placeholder="e.g., Zone A, Zone B, Loading Dock, Warehouse"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Alert Days Before Expiry
            </label>
            <select
              value={formData.alert_days_before}
              onChange={(e) => setFormData({ ...formData, alert_days_before: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
            </select>
          </div>

          {/* Permit Document Upload */}
          <div className="border-t border-slate-200 pt-4">
            <h4 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Permit Document (Optional)
            </h4>
            <input
              ref={documentInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleDocumentChange}
              className="hidden"
            />
            <div
              onClick={() => documentInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-4 cursor-pointer transition hover:border-blue-400 hover:bg-blue-50 ${
                permitDocument ? 'border-blue-300' : 'border-slate-300'
              }`}
            >
              {documentPreview ? (
                <img loading="lazy" decoding="async"
                  src={documentPreview}
                  alt="Permit document"
                  className="w-full h-40 object-contain rounded"
                />
              ) : permitDocument ? (
                <div className="text-center py-4">
                  <FileText className="w-12 h-12 text-blue-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700">{permitDocument.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {(permitDocument.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Click to upload permit document</p>
                  <p className="text-xs text-slate-400 mt-1">Supports images and PDF</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Any additional notes..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2"
            >
              {saving ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                  {uploadProgress || 'Saving...'}
                </>
              ) : (
                'Add Permit'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
