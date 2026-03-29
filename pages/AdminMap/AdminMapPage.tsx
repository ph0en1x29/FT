import { Loader2, MapPin } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../services/supabaseService';

// Fix default marker icons (Leaflet + bundler issue)
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface SiteWithJobs {
  site_id: string;
  site_name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  customer_name: string;
  active_job_count: number;
}

// Resize map when container changes
const MapResizer: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

const AdminMapPage: React.FC = () => {
  const [sites, setSites] = useState<SiteWithJobs[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSites = async () => {
      try {
        // Get sites with coordinates
        const { data: siteData } = await supabase
          .from('customer_sites')
          .select('site_id, site_name, address, latitude, longitude, customer_id')
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
          .eq('is_active', true);

        if (!siteData?.length) {
          setLoading(false);
          return;
        }

        // Get active job counts per site
        const siteIds = siteData.map(s => s.site_id);
        const { data: jobCounts } = await supabase
          .from('jobs')
          .select('site_id')
          .in('site_id', siteIds)
          .is('deleted_at', null)
          .in('status', ['new', 'assigned', 'in_progress', 'pending_review']);

        const countMap: Record<string, number> = {};
        jobCounts?.forEach(j => {
          countMap[j.site_id] = (countMap[j.site_id] || 0) + 1;
        });

        // Get customer names
        const customerIds = [...new Set(siteData.map(s => s.customer_id))];
        const { data: customers } = await supabase
          .from('customers')
          .select('customer_id, name')
          .in('customer_id', customerIds);

        const customerMap: Record<string, string> = {};
        customers?.forEach(c => { customerMap[c.customer_id] = c.name; });

        setSites(siteData.map(s => ({
          site_id: s.site_id,
          site_name: s.site_name,
          address: s.address,
          latitude: s.latitude as number,
          longitude: s.longitude as number,
          customer_name: customerMap[s.customer_id] || 'Unknown',
          active_job_count: countMap[s.site_id] || 0,
        })));
      } catch (err) {
        console.error('Failed to load map sites:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSites();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <MapPin className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-lg text-[var(--text)]">Site Map</h1>
          <p className="text-xs text-[var(--text-muted)]">{sites.length} sites with coordinates</p>
        </div>
      </div>

      <div className="flex-1 relative min-h-[400px]">
        {sites.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--text-muted)]">
            <MapPin className="w-12 h-12 opacity-30" />
            <p className="text-sm">No sites with coordinates yet.</p>
            <p className="text-xs">Add coordinates via the "📍 Locate on map" button when editing sites.</p>
          </div>
        ) : (
          <MapContainer
            center={[4.2, 108.0]}
            zoom={6}
            className="h-full w-full z-0"
            style={{ minHeight: '400px' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapResizer />
            {sites.map(site => (
              <Marker key={site.site_id} position={[site.latitude, site.longitude]}>
                <Popup>
                  <div className="text-sm min-w-[180px]">
                    <p className="font-bold text-slate-800">{site.site_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{site.customer_name}</p>
                    {site.address && (
                      <p className="text-xs text-slate-600 mt-1">{site.address}</p>
                    )}
                    <div className="mt-2 pt-1.5 border-t border-slate-200">
                      <span className={`text-xs font-medium ${site.active_job_count > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                        {site.active_job_count} active job{site.active_job_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
};

export default AdminMapPage;
