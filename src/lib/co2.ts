// OCO-2 GEOS L3 CO₂ (2021) — ekip paketinden üretilen 96x60 aylık ızgara ve istasyon serileri.
// Herhangi bir lat/lon: en yakın ızgara noktası ya da çift doğrusal interpolasyon. Sabit şehir yok.
import { haversineKm, type LatLon } from './geo.ts';

export interface Co2GridFile {
  unit: 'ppm'; credit: string; notes: string[]; encoding: string;
  grid: { nLat: number; nLon: number; lat0: number; dLat: number; lon0: number; dLon: number };
  months: string[]; refDates: string[]; values: number[][];
  rings: { lats: number[]; lons: number[]; byLat: Record<string, number[][]> };
  daily: { start: string; days: number; global: number[]; north: number[]; south: number[] };
}
export interface Co2StationsFile {
  credit: string; notes: string[]; start: string; days: number;
  stations: { id: string; region: string; lat: number; lon: number; ppm: number[] }[];
}
export const decodePpm = (v: number) => 400 + v / 100;

export class Co2Grid {
  readonly f: Co2GridFile;
  constructor(f: Co2GridFile) { this.f = f; }
  get months() { return this.f.months; }

  private at(m: number, k: number, i: number): number {
    const { nLat, nLon } = this.f.grid;
    const kk = Math.max(0, Math.min(nLat - 1, k)), ii = ((i % nLon) + nLon) % nLon;
    return decodePpm(this.f.values[m][kk * nLon + ii]);
  }
  /** Sürekli ızgara koordinatı (k: enlem indeksi, i: boylam indeksi). */
  private pos(p: LatLon) {
    const g = this.f.grid;
    return { fk: (p.lat - g.lat0) / g.dLat, fi: (p.lon - g.lon0) / g.dLon };
  }
  /** En yakın ızgara noktası ve değeri. */
  nearest(p: LatLon, month: number): { lat: number; lon: number; ppm: number; km: number } {
    const g = this.f.grid, { fk, fi } = this.pos(p);
    const k = Math.max(0, Math.min(g.nLat - 1, Math.round(fk))), i = (((Math.round(fi)) % g.nLon) + g.nLon) % g.nLon;
    const q = { lat: g.lat0 + k * g.dLat, lon: g.lon0 + i * g.dLon };
    return { ...q, ppm: this.at(month, k, i), km: haversineKm(p, q) };
  }
  /** Çift doğrusal interpolasyon (boylam sarmalanır, kutuplarda en uç enleme kenetlenir). */
  bilinear(p: LatLon, month: number): number {
    const { fk, fi } = this.pos(p);
    const k0 = Math.floor(fk), i0 = Math.floor(fi), tk = Math.max(0, Math.min(1, fk - k0)), ti = fi - i0;
    const a = this.at(month, k0, i0), b = this.at(month, k0, i0 + 1), c = this.at(month, k0 + 1, i0), d = this.at(month, k0 + 1, i0 + 1);
    return (a * (1 - ti) + b * ti) * (1 - tk) + (c * (1 - ti) + d * ti) * tk;
  }
  /** Bir yerin 12 aylık serisi (ayın 1. günü değerleri). */
  monthSeries(p: LatLon): number[] { return this.f.months.map((_, m) => this.bilinear(p, m)); }
  /** Bir aydaki tüm ızgaranın min/max'ı (renk/ses ölçeği için). */
  private rangeMemo: ({ min: number; max: number } | undefined)[] = [];
  private yearMemo: { min: number; max: number } | null = null;
  monthRange(month: number): { min: number; max: number } {
    const hit = this.rangeMemo[month]; if (hit) return hit; // her pikselde çağrılır: bir kez hesapla
    let min = Infinity, max = -Infinity;
    for (const v of this.f.values[month]) { const x = decodePpm(v); if (x < min) min = x; if (x > max) max = x; }
    return (this.rangeMemo[month] = { min, max });
  }
  yearRange(): { min: number; max: number } {
    if (this.yearMemo) return this.yearMemo;
    let min = Infinity, max = -Infinity;
    for (let m = 0; m < this.f.months.length; m++) { const r = this.monthRange(m); min = Math.min(min, r.min); max = Math.max(max, r.max); }
    return (this.yearMemo = { min, max });
  }
}

export class Co2Stations {
  readonly f: Co2StationsFile;
  constructor(f: Co2StationsFile) { this.f = f; }
  series(id: string): number[] { return (this.f.stations.find((s) => s.id === id)?.ppm ?? []).map(decodePpm); }
  /** maxKm içindeki en yakın istasyon (yoksa null). */
  near(p: LatLon, maxKm: number) {
    let best: { s: Co2StationsFile['stations'][number]; km: number } | null = null;
    for (const s of this.f.stations) { const km = haversineKm(p, s); if (km <= maxKm && (!best || km < best.km)) best = { s, km }; }
    return best;
  }
  /** Bir enlem bandındaki istasyonlar (Dünya turu "öne çıkan duraklar"). */
  nearLatitude(lat: number, bandDeg: number) { return this.f.stations.filter((s) => Math.abs(s.lat - lat) <= bandDeg); }
}

const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthName = (m: number, lang: 'tr' | 'en' = 'tr') => (lang === 'en' ? MONTHS_EN : MONTHS_TR)[m];
export const stationLabel = (id: string) => id.replace(/_/g, ' ');
