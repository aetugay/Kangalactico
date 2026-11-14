// Küresel geometri (WGS84 küre yaklaşımı, R = 6371 km).
export const R_EARTH = 6371.0088;
const rad = Math.PI / 180;

export interface LatLon { lat: number; lon: number }

export function haversineKm(a: LatLon, b: LatLon): number {
  const s = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Başlangıç noktasından `bearingDeg` yönünde (kuzeyden saat yönü) `km` gidilince varılan nokta. */
export function destination(p: LatLon, bearingDeg: number, km: number): LatLon {
  const d = km / R_EARTH, b = bearingDeg * rad, la = p.lat * rad, lo = p.lon * rad;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
  const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return { lat: la2 / rad, lon: ((((lo2 / rad) + 540) % 360) - 180) };
}

/** a'dan b'ye ilk yön (derece, kuzeyden saat yönü). */
export function bearing(a: LatLon, b: LatLon): number {
  const la1 = a.lat * rad, la2 = b.lat * rad, dl = (b.lon - a.lon) * rad;
  const y = Math.sin(dl) * Math.cos(la2), x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dl);
  return ((Math.atan2(y, x) / rad) + 360) % 360;
}

const DIR8 = ['kuzey', 'kuzeydoğu', 'doğu', 'güneydoğu', 'güney', 'güneybatı', 'batı', 'kuzeybatı'];
const DIR8_EN = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
const DIR8_SHORT = ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'];
export const compass8 = (deg: number, lang: 'tr' | 'en' = 'tr') => (lang === 'en' ? DIR8_EN : DIR8)[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
export const compass8Short = (deg: number) => DIR8_SHORT[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

export function formatLatLon(p: LatLon): string {
  const f = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(2)}°${v >= 0 ? pos : neg}`;
  return `${f(p.lat, 'K', 'G')} ${f(p.lon, 'D', 'B')}`;
}

export const formatKm = (km: number) => (km >= 100 ? `${Math.round(km / 10) * 10} km` : `${Math.round(km)} km`);
