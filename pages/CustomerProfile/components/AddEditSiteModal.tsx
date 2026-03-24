import { Building2, Loader2, MapPin, Save, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { addCustomerSite, updateCustomerSite } from '../../../services/customerService';
import { geocodeAddress } from '../../../services/geocodeService';
import type { CustomerSite } from '../../../types';

// Fix default marker icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface AddEditSiteModalProps {
  customerId: string;
  site: CustomerSite | null;
  onClose: () => void;
}

const inputClassName = "w-full px-3 py-2.5 bg-[#f5f5f5] text-[#111827] border border-[#d1d5db] rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 placeholder-slate-400 transition-all duration-200";

// Click handler to reposition marker
const MapClickHandler: React.FC<{ onMove: (lat: number, lng: number) => void }> = ({ onMove }) => {
  useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// Fly to a position
const FlyTo: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 14, { duration: 0.8 });
  }, [map, lat, lng]);
  return null;
};

const AddEditSiteModal: React.FC<AddEditSiteModalProps> = ({
  customerId,
  site,
  onClose
}) => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    site?.latitude && site?.longitude ? { lat: site.latitude, lng: site.longitude } : null
  );
  const [formData, setFormData] = useState({
    site_name: site?.site_name || '',
    address: site?.address || '',
    notes: site?.notes || '',
    is_active: site?.is_active ?? true,
  });

  const handleGeocode = useCallback(async () => {
    if (!formData.address.trim()) return;
    setGeocoding(true);
    try {
      const result = await geocodeAddress(formData.address);
      if (result) {
        setCoords({ lat: result.latitude, lng: result.longitude });
        setShowMap(true);
      } else {
        alert('Could not find coordinates for this address. You can manually place the pin on the map.');
        setShowMap(true);
      }
    } finally {
      setGeocoding(false);
    }
  }, [formData.address]);

  const handleSubmit = async () => {
    if (!formData.site_name.trim()) {
      alert('Site name is required');
      return;
    }
    if (!formData.address.trim()) {
      alert('Address is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
      };

      if (site) {
        await updateCustomerSite(site.site_id, payload);
      } else {
        await addCustomerSite({
          customer_id: customerId,
          ...payload,
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['customer-sites', customerId] });
      onClose();
    } catch (error) {
      alert('Failed to save site: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const mapCenter: [number, number] = coords
    ? [coords.lat, coords.lng]
    : [4.2, 108.0];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-[var(--surface)] rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="px-5 py-3 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-green-600 flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5 text-white" />
              </div>
              <h3 className="font-bold text-base text-slate-800">
                {site ? 'Edit Site' : 'Add Site'}
              </h3>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable form body */}
          <div className="overflow-y-auto flex-1 p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Site Name *
              </label>
              <input
                type="text"
                className={inputClassName}
                placeholder="e.g. Main Warehouse, Factory A"
                value={formData.site_name}
                onChange={(e) => setFormData({ ...formData, site_name: e.target.value })}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Address *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className={`${inputClassName} flex-1`}
                  placeholder="Full address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={handleGeocode}
                  disabled={geocoding || !formData.address.trim()}
                  className="px-3 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-100 text-sm font-medium disabled:opacity-40 shrink-0 flex items-center gap-1.5"
                  title="Locate on map"
                >
                  {geocoding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <MapPin className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">Locate</span>
                </button>
              </div>
            </div>

            {/* Mini-map preview */}
            {showMap && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Pin Location
                  <span className="font-normal normal-case ml-1 text-slate-400">
                    (click map to adjust)
                  </span>
                </label>
                <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: 200 }}>
                  <MapContainer
                    center={mapCenter}
                    zoom={coords ? 14 : 6}
                    className="h-full w-full z-0"
                    style={{ height: 200 }}
                  >
                    <TileLayer
                      attribution='&copy; OSM'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapClickHandler onMove={(lat, lng) => setCoords({ lat, lng })} />
                    {coords && (
                      <>
                        <Marker position={[coords.lat, coords.lng]} />
                        <FlyTo lat={coords.lat} lng={coords.lng} />
                      </>
                    )}
                  </MapContainer>
                </div>
                {coords && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                  </p>
                )}
              </div>
            )}

            {!showMap && coords && (
              <button
                type="button"
                onClick={() => setShowMap(true)}
                className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
              >
                <MapPin className="w-3 h-3" />
                Show map ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
              </button>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Notes
              </label>
              <textarea
                className={`${inputClassName} h-20 resize-none`}
                placeholder="Additional information about this site..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500"
                />
                <span className="text-sm text-slate-700">Active Site</span>
              </label>
              <p className="text-xs text-slate-500 mt-1 ml-6">
                Inactive sites are still visible but marked as not in use
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 flex gap-3 justify-end border-t border-slate-200 bg-slate-50/80 rounded-b-2xl shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-medium text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="px-5 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium shadow-sm flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : site ? 'Save Changes' : 'Add Site'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddEditSiteModal;
