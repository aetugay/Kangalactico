// Şehir arama ve adlandırma — public/data/cities.json (GeoNames cities15000, CC BY 4.0).
// HİÇBİR şehir burada sabit kodlanmaz; her şey kullanıcının seçimine göre.
import { haversineKm, type LatLon } from './geo.ts';

export type CityRow = [name: string, cc: string, lat: number, lon: number, pop: number];
export interface CitiesFile { cities: CityRow[]; asciiNames: Record<string, string>; count: number }
export interface Place extends LatLon { name: string; country?: string; source: 'arama' | 'harita' | 'konum' | 'bağlantı' }

/** Türkçe ve aksanlı harfleri sadeleştir (İ→i, ş→s, ...) — "sivas", "SİVAS", "Sıvas" eşleşsin. */
export function fold(s: string): string {
  return s
    .replace(/İ/g, 'i').replace(/I/g, 'ı').toLocaleLowerCase('tr')
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

const regionNames = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['tr'], { type: 'region' }) : null;
export const countryName = (cc: string) => { try { return regionNames?.of(cc) ?? cc; } catch { return cc; } };

export class Cities {
  private keys: string[];
  readonly data: CitiesFile;
  constructor(data: CitiesFile) {
    this.data = data;
    this.keys = data.cities.map((c) => fold(c[0]) + '|' + fold(data.asciiNames[`${c[0]}|${c[1]}`] ?? ''));
  }
  /** Önek eşleşmesi önce, sonra içerme; nüfusa göre sıralı (dosya zaten nüfusa göre sıralı). */
  search(q: string, limit = 8): CityRow[] {
    const f = fold(q.trim());
    if (f.length < 2) return [];
    const pre: CityRow[] = [], inc: CityRow[] = [];
    for (let k = 0; k < this.keys.length && pre.length < limit; k++) {
      const key = this.keys[k];
      if (key.startsWith(f) || key.includes('|' + f)) pre.push(this.data.cities[k]);
      else if (inc.length < limit && key.includes(f)) inc.push(this.data.cities[k]);
    }
    return [...pre, ...inc].slice(0, limit);
  }
  find(q: string): CityRow | undefined { return this.search(q, 1)[0]; }
  /** Bir noktaya en yakın şehir (maxKm içinde). */
  nearest(p: LatLon, maxKm = 75): { row: CityRow; km: number } | null {
    let best: { row: CityRow; km: number } | null = null;
    for (const c of this.data.cities) {
      if (Math.abs(c[2] - p.lat) > maxKm / 100) continue;
      const km = haversineKm(p, { lat: c[2], lon: c[3] });
      if (km <= maxKm && (!best || km < best.km)) best = { row: c, km };
    }
    return best;
  }
  /** Enlem bandındaki büyük şehirler (Dünya turu için), boylama göre. */
  alongParallel(lat: number, bandDeg = 1.5, minPop = 1_000_000): CityRow[] {
    return this.data.cities.filter((c) => Math.abs(c[2] - lat) <= bandDeg && c[4] >= minPop);
  }
}

export const rowToPlace = (c: CityRow, source: Place['source']): Place => ({ name: c[0], country: countryName(c[1]), lat: c[2], lon: c[3], source });
export const placeLabel = (p: Place) => (p.country ? `${p.name}, ${p.country}` : p.name);
