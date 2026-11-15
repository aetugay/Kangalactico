// 5° ayrı katmanlar (Ceyhun paketi 2026-11-15 → scripts/ceyhun-data-export.mjs → public/data/c5/*.json).
// Kendi çözünürlüğünde kalır: radar/SVS 1° ızgarasına karıştırılmaz, yeniden örneklenip incelmez. Nokta değeri = en yakın 5° hücre (≤ 400 km);
// alan dışı (deniz katmanında kara, kara katmanında deniz, GEDI'de |enlem| > 51,6°) → NaN = "veri yok".
import { haversineKm, type LatLon } from './geo.ts';
import type { RadarLayer } from './radar.ts';

export type C5Id = 'currents' | 'lis' | 'gedi';
export interface C5File {
  id: C5Id; unit: string; domain: 'sea' | 'land' | 'all'; scale: 'linear' | 'log'; min: number; max: number; cellDeg: number; resolutionKm: number; latLimit?: number;
  kanit: { koleksiyon: string; degisken: string; donem: string; birim: string; toplama: string; kaynak_paket: string };
  note: { tr: string; en: string }; cells: [number, number, number][];
}
const MAX_KM = 400;
export class C5Source {
  readonly f: C5File;
  private buckets = new Map<string, [number, number, number][]>();
  private isLand: ((lat: number, lon: number) => boolean) | null;
  /** isLand: Natural Earth kara maskesi (yoksa alan sınaması yapılmaz). */
  constructor(f: C5File, isLand: ((lat: number, lon: number) => boolean) | null = null) {
    this.f = f; this.isLand = isLand;
    for (const c of f.cells) { const k = `${Math.floor(c[0] / 5)},${Math.floor(c[1] / 5)}`; if (!this.buckets.has(k)) this.buckets.set(k, []); this.buckets.get(k)!.push(c); }
  }
  setLand(fn: ((lat: number, lon: number) => boolean) | null) { this.isLand = fn; }
  /** En yakın hücre değeri; yoksa NaN. */
  value(p: LatLon): number {
    const f = this.f;
    if (f.latLimit && Math.abs(p.lat) > f.latLimit) return NaN;                      // GEDI ölçüm alanı dışı
    if (this.isLand && f.domain !== 'all' && this.isLand(p.lat, p.lon) !== (f.domain === 'land')) return NaN;
    const bi = Math.floor(p.lat / 5), bj = Math.floor(p.lon / 5); let best = NaN, bd = MAX_KM;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const j = (((bj + dj + 36) % 72) + 72) % 72 - 36; // boylam kovası, ±180° sarması
      for (const c of this.buckets.get(`${bi + di},${j}`) ?? []) { const d = haversineKm(p, { lat: c[0], lon: c[1] }); if (d < bd) { bd = d; best = c[2]; } }
    }
    return best;
  }
  fmt(v: number, en: boolean): string {
    if (Number.isNaN(v)) return en ? 'no data' : 'veri yok';
    const n = (x: number, d: number) => (en ? x.toFixed(d) : x.toFixed(d).replace('.', ','));
    if (this.f.id === 'currents') return `${n(v, 2)} m/s`;
    if (this.f.id === 'lis') return v <= 0 ? (en ? 'no measurable lightning' : 'ölçülebilir yıldırım yok') : `${n(v, v < 10 ? 1 : 0)} ${en ? 'flashes/km²/yr' : 'flaş/km²/yıl'}`;
    return `${n(v, 0)} m`;
  }
  radarLayer(lang: 'tr' | 'en'): RadarLayer {
    const en = lang === 'en', f = this.f;
    const L = { currents: [en ? 'Ocean currents · 5°' : 'Okyanus akıntıları · 5°', en ? 'wave tempo' : 'dalga temposu'], lis: [en ? 'Lightning climatology · 5°' : 'Yıldırım iklimi · 5°', en ? 'thunder' : 'gök gürültüsü'], gedi: [en ? 'Forest height · 5°' : 'Orman yüksekliği · 5°', en ? 'leaves + birds' : 'yaprak + kuşlar'] }[f.id];
    return {
      id: f.id, label: L[0], instrument: L[1], unit: f.unit, min: f.min, max: f.max, log: f.scale === 'log', baseHz: 220,
      when: `${f.kanit.donem} · ${f.kanit.koleksiyon.split(' (')[0]}`, sample: (p) => this.value(p), fmt: (v) => this.fmt(v, en),
    };
  }
}
export async function loadC5(base: string, id: C5Id, isLand: ((lat: number, lon: number) => boolean) | null) {
  const r = await fetch(`${base}data/c5/${id}.json`); if (!r.ok) throw new Error(`c5/${id}.json: HTTP ${r.status}`);
  return new C5Source(await r.json() as C5File, isLand);
}
