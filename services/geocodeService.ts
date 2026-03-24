/**
 * Geocoding via Nominatim (OpenStreetMap) — free, no key needed.
 * Requires User-Agent header per Nominatim usage policy.
 */

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  display_name: string;
}

export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  if (!address.trim()) return null;

  try {
    const params = new URLSearchParams({
      q: address,
      format: 'json',
      limit: '1',
      countrycodes: 'my', // Bias toward Malaysia
    });

    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        'User-Agent': 'FieldPro-FSM/1.0 (dev@fieldpro.app)',
      },
    });

    if (!res.ok) return null;

    const data: NominatimResult[] = await res.json();
    if (!data.length) return null;

    return {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
      display_name: data[0].display_name,
    };
  } catch {
    console.warn('Geocoding failed for:', address);
    return null;
  }
}
