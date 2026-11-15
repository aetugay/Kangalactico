// Ters coğrafi kodlama (saf; Node testleri de kullanır: scripts/test-revgeo.mjs).
// Nokta → ülke (Natural Earth 110m admin-0) ya da deniz/okyanus (Natural Earth 50m marine) adı, TR ve EN ayrı.
// En yakın şehir 300 km içindeyse eklenir: "Kisangani yakını, Demokratik Kongo Cumhuriyeti" / "near Kisangani, Democratic Republic of the Congo";
// denizde "Kuzey Atlas Okyanusu, New York açıkları" / "North Atlantic Ocean, off New York". Hiçbiri yoksa null (çağıran koordinat okur).
import type { LatLon } from './geo.ts';

export interface RegionsFile { countries: Packed[]; marine: (Packed & { kind?: string })[] }
interface Packed { tr: string; en: string; cc?: string; b: [number, number, number, number]; r: string }
interface Region { tr: string; en: string; cc?: string; b: [number, number, number, number]; rings: Float32Array[]; area: number }
export interface Names { tr: string; en: string }
/** Şehir: TR/EN adı, uzaklık, ülke kodu (ISO-2) ve ülkesinin TR/EN adı. */
export interface NearCity { tr: string; en: string; km: number; cc?: string; country?: Names }
const SEP = -32768;

function unpack(p: Packed): Region {
  const bin = typeof atob === 'function' ? Uint8Array.from(atob(p.r), (c) => c.charCodeAt(0)) : new Uint8Array(Buffer.from(p.r, 'base64'));
  const a = new Int16Array(bin.buffer, bin.byteOffset, bin.byteLength >> 1), rings: Float32Array[] = [];
  let cur: number[] = [];
  for (let i = 0; i < a.length; i += 2) { if (a[i] === SEP) { if (cur.length) rings.push(new Float32Array(cur)); cur = []; continue; } cur.push(a[i] / 100, a[i + 1] / 100); }
  if (cur.length) rings.push(new Float32Array(cur));
  return { tr: p.tr, en: p.en, cc: p.cc, b: p.b, rings, area: (p.b[2] - p.b[0]) * (p.b[3] - p.b[1]) };
}
/** evenodd: halkalar arası delikler doğru sayılır. */
function inside(R: Region, lon: number, lat: number): boolean {
  const [x0, y0, x1, y1] = R.b; if (lon < x0 || lon > x1 || lat < y0 || lat > y1) return false;
  let c = false;
  for (const r of R.rings) for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const km = (a: LatLon, b: LatLon) => { const R = Math.PI / 180, x = Math.sin(((b.lat - a.lat) * R) / 2) ** 2 + Math.cos(a.lat * R) * Math.cos(b.lat * R) * Math.sin(((b.lon - a.lon) * R) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };

export class RevGeo {
  private countries: Region[]; private marine: Region[];
  constructor(f: RegionsFile) { this.countries = f.countries.map(unpack); this.marine = f.marine.map(unpack).sort((a, b) => a.area - b.area); } // küçük (özgül) deniz önce: Akdeniz > Atlas Okyanusu
  country(p: LatLon): (Names & { cc?: string }) | null { const c = this.countries.find((R) => inside(R, p.lon, p.lat)); return c ? { tr: c.tr, en: c.en, cc: c.cc } : null; }
  sea(p: LatLon): Names | null {
    const m = this.marine.find((R) => inside(R, p.lon, p.lat)); if (m) return { tr: m.tr, en: m.en };
    // kıyı boşluğu: 400 km içindeki en yakın deniz bölgesi köşesi
    let best: Region | null = null, bd = 400;
    for (const R of this.marine) for (const r of R.rings) for (let i = 0; i < r.length; i += 6) { const d = km(p, { lat: r[i + 1], lon: r[i] }); if (d < bd) { bd = d; best = R; } }
    return best ? { tr: best.tr, en: best.en } : null;
  }
  /** Adlandır. city: en yakın şehir (TR/EN adı + uzaklık km), varsa. Kutuplar: ülke/deniz yoksa "Kuzey/Güney Kutbu bölgesi". */
  name(p: LatLon, city?: NearCity | null): Names | null {
    const near = city && city.km <= 300 ? city : null;
    const c = this.country(p);
    // karada: şehir YALNIZ noktanın bulunduğu ülkedeyse eklenir ("Arlit yakını, Cezayir" yanlış — Arlit Nijer'de)
    if (c && near && near.cc && c.cc && near.cc !== c.cc) {
      return near.km <= 100 && near.country ? { tr: `${c.tr}, ${near.country.tr} sınırına yakın`, en: `${c.en}, near the border with ${near.country.en}` } : { tr: c.tr, en: c.en };
    }
    if (c) return near ? (near.km < 25 ? { tr: `${near.tr}, ${c.tr}`, en: `${near.en}, ${c.en}` } : { tr: `${near.tr} yakını, ${c.tr}`, en: `near ${near.en}, ${c.en}` }) : c; // şehrin üstünde: "Sivas, Türkiye"
    const s = this.sea(p);
    if (s) return near ? { tr: `${s.tr}, ${near.tr} açıkları`, en: `${s.en}, off ${near.en}` } : s;
    if (Math.abs(p.lat) >= 80) return p.lat > 0 ? { tr: 'Kuzey Kutbu bölgesi', en: 'North Pole region' } : { tr: 'Güney Kutbu bölgesi', en: 'South Pole region' };
    return near ? { tr: `${near.tr} yakını`, en: `near ${near.en}` } : null;
  }
}
