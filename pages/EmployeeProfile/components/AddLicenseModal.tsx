import { Camera,Upload,X } from 'lucide-react';
import React,{ useRef,useState } from 'react';
import { HRService } from '../../../services/hrService';
import { showToast } from '../../../services/toastService';
import { LicenseStatus } from '../../../types';
import { AddLicenseModalProps } from '../types';

/**
 * AddLicenseModal - Modal form for adding a new driving license
 * Supports uploading front and back images of the license
 */
export default function AddLicenseModal({
  userId,
  onClose,
  onSave,
}: AddLicenseModalProps) {
  const [formData, setFormData] = useState({
    license_type: '',
    license_number: '',
    issuing_authority: '',
    issue_date: '',
    expiry_date: '',
    alert_days_before: 30,
    notes: '',
  });
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string>('');
  const [backPreview, setBackPreview] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    side: 'front' | 'back'
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (side === 'front') {
        setFrontImage(file);
        setFrontPreview(URL.createObjectURL(file));
      } else {
        setBackImage(file);
        setBackPreview(URL.createObjectURL(file));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.license_type || !formData.license_number || !formData.expiry_date) {
      alert('Please fill in required fields (License Type, Number, and Expiry Date)');
      return;
    }
    setSaving(true);
    try {
      let frontUrl = '';
      let backUrl = '';

      // Upload images if provided
      if (frontImage) {
        setUploadProgress('Uploading front image...');
        frontUrl = await HRService.uploadLicenseImage(userId, frontImage, 'front');
      }
      if (backImage) {
        setUploadProgress('Uploading back image...');
        backUrl = await HRService.uploadLicenseImage(userId, backImage, 'back');
      }

      setUploadProgress('Saving license...');
      await onSave({
        user_id: userId,
        ...formData,
        license_front_image_url: frontUrl || undefined,
        license_back_image_url: backUrl || undefined,
        status: LicenseStatus.ACTIVE,
      });
    } catch (error) {
      showToast.error('Failed to save license');
      alert('Failed to save license. Please try again.');
    } finally {
      setSaving(false);
      setUploadProgress('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-slate-800">Add Driving License</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                License Type *
              </label>
              <select
                value={formData.license_type}
                onChange={(e) => setFormData({ ...formData, license_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select Type</option>
                <option value="Class B">Class B (Car)</option>
                <option value="Class D">Class D (Motorcycle)</option>
                <option value="Class E">Class E (Commercial)</option>
                <option value="Class E1">Class E1 (Forklift)</option>
                <option value="Class E2">Class E2 (Lorry)</option>
                <option value="Class G">Class G (Crane)</option>
                <option value="GDL">GDL (Goods Driving License)</option>
                <option value="PSV">PSV (Public Service Vehicle)</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                License Number *
              </label>
              <input
                type="text"
                value={formData.license_number}
                onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., D12345678"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Issuing Authority
            </label>
            <input
              type="text"
              value={formData.issuing_authority}
              onChange={(e) => setFormData({ ...formData, issuing_authority: e.target.value })}
              placeholder="e.g., JPJ Malaysia"
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

          {/* License Image Uploads */}
          <div className="border-t border-slate-200 pt-4">
            <h4 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
              <Camera className="w-4 h-4" />
              License Images (Optional)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Front Image */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Front Side
                </label>
                <input
                  ref={frontInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e, 'front')}
                  className="hidden"
                />
                <div
                  onClick={() => frontInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-4 cursor-pointer transition hover:border-blue-400 hover:bg-blue-50 ${
                    frontPreview ? 'border-blue-300' : 'border-slate-300'
                  }`}
                >
                  {frontPreview ? (
                    <img loading="lazy" decoding="async"
                      src={frontPreview}
                      alt="License front"
                      className="w-full h-32 object-contain rounded"
                    />
                  ) : (
                    <div className="text-center py-4">
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Click to upload front</p>
                    </div>
                  )}
                </div>
                {frontImage && (
                  <p className="text-xs text-slate-500 mt-1 truncate">{frontImage.name}</p>
                )}
              </div>

              {/* Back Image */}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Back Side
                </label>
                <input
                  ref={backInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageChange(e, 'back')}
                  className="hidden"
                />
                <div
                  onClick={() => backInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-4 cursor-pointer transition hover:border-blue-400 hover:bg-blue-50 ${
                    backPreview ? 'border-blue-300' : 'border-slate-300'
                  }`}
                >
                  {backPreview ? (
                    <img loading="lazy" decoding="async"
                      src={backPreview}
                      alt="License back"
                      className="w-full h-32 object-contain rounded"
                    />
                  ) : (
                    <div className="text-center py-4">
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Click to upload back</p>
                    </div>
                  )}
                </div>
                {backImage && (
                  <p className="text-xs text-slate-500 mt-1 truncate">{backImage.name}</p>
                )}
              </div>
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
                'Add License'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
