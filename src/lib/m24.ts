// Aylık NASA katmanları (MERRA-2 2024 + OCO-2 GEOS L3 2021) — Ceyhun'un paketinden (sürüm 3) denetimden geçenler (public/data/m24).
// Yalnız statik dosyalar; canlı API (sürüm 2) kullanılmaz.
// Statik ikili dosya okuyucu: int16 LE, q ∈ 0..1000, -1 = veri yok. API gerekmez.
import type { LatLon } from './geo.ts';
import type { RadarLayer, Timbre } from './radar.ts';
import { monthName } from './co2.ts';

export interface M24LayerMeta {
  index: number; src: string; id: string; tr: string; en: string; product: string; variable: string; unit: string;
  nasa: string; note?: string; daily?: boolean; transform: 'linear' | 'log1p'; vmin: number; vmax: number; sourceLabel: string;
  year: number; signed?: boolean;
  kanit?: { nasa_koleksiyon?: string; netcdf_degiskeni?: string; nasa_long_name?: string; orijinal_birim?: string; ornek_granul_dosyasi?: string; dosya_sayisi?: number };
}
export interface M24Preset { key: string; ad: string; layers: string[]; removed: string[] }
export interface M24Meta {
  year: number; months: string[];
  grid: { nLat: number; nLon: number; lat0: number; dLat: number; lon0: number; dLon: number; cell: string };
  files: { monthly: string; monthlyShape: [number, number, number]; co2Daily: string; co2DailyShape: [number, number]; co2DailyStart: string; co2DailyNote: string };
  provenance: string; layers: M24LayerMeta[]; clipped?: boolean; clipping?: string; presets?: M24Preset[]; surum?: number;
}

/** Normalize q (0..1000) → gerçek birim. */
export function m24Phys(L: M24LayerMeta, q: number): number {
  if (q < 0) return NaN;
  const t = q / 1000;
  if (L.transform === 'linear') return L.vmin + t * (L.vmax - L.vmin);
  return Math.expm1(Math.log1p(L.vmin) + t * (Math.log1p(L.vmax) - Math.log1p(L.vmin)));
}

export class M24 {
  readonly meta: M24Meta;
  readonly monthly: Int16Array;
  private daily: Int16Array | null = null;
  private ranges = new Map<string, { min: number; max: number }>();
  constructor(meta: M24Meta, monthly: ArrayBuffer) { this.meta = meta; this.monthly = new Int16Array(monthly); }

  static async load(base: string): Promise<M24> {
    const meta = await (await fetch(`${base}data/m24/meta.json`)).json() as M24Meta;
    const r = await fetch(`${base}data/m24/${meta.files.monthly}`);
    if (!r.ok) throw new Error(`m24 monthly: HTTP ${r.status}`);
    return new M24(meta, await r.arrayBuffer());
  }

  private q(arr: Int16Array, slab: number, k: number, i: number): number {
    const g = this.meta.grid;
    const kk = Math.max(0, Math.min(g.nLat - 1, k)), ii = ((i % g.nLon) + g.nLon) % g.nLon;
    return arr[slab * g.nLat * g.nLon + kk * g.nLon + ii];
  }
  /** Çift doğrusal (gerçek birimde). Noktanın kendi hücresi boşsa NaN — komşudan değer taşınmaz. */
  private sampleSlab(arr: Int16Array, slab: number, L: M24LayerMeta, p: LatLon): number {
    const g = this.meta.grid;
    const fk = (p.lat - g.lat0) / g.dLat, fi = (p.lon - g.lon0) / g.dLon;
    if (this.q(arr, slab, Math.round(fk), Math.round(fi)) < 0) return NaN;
    const k0 = Math.floor(fk), i0 = Math.floor(fi), tk = fk - k0, ti = fi - i0;
    let s = 0, w = 0;
    for (const [dk, di] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
      const v = m24Phys(L, this.q(arr, slab, k0 + dk, i0 + di)); if (Number.isNaN(v)) continue;
      const wt = (dk ? tk : 1 - tk) * (di ? ti : 1 - ti); s += v * wt; w += wt;
    }
    return w > 1e-6 ? s / w : NaN;
  }
  value(layerIdx: number, month: number, p: LatLon): number { return this.sampleSlab(this.monthly, layerIdx * 12 + month, this.meta.layers[layerIdx], p); }

  /** O ayın küresel min/max'ı (gerçek birim; görsel renk ölçeği için). */
  monthRange(layerIdx: number, month: number) {
    const key = `${layerIdx}:${month}`; const c = this.ranges.get(key); if (c) return c;
    const L = this.meta.layers[layerIdx], n = this.meta.grid.nLat * this.meta.grid.nLon, off = (layerIdx * 12 + month) * n;
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < n; i++) { const q = this.monthly[off + i]; if (q < 0) continue; const v = m24Phys(L, q); if (v < min) min = v; if (v > max) max = v; }
    const r = { min, max }; this.ranges.set(key, r); return r;
  }

  radarLayer(layerIdx: number, month: number, lang: 'tr' | 'en' = 'tr'): RadarLayer {
    const L = this.meta.layers[layerIdx], en = lang === 'en';
    const unit = L.unit === '0–1' || L.unit === '' ? null : L.unit;
    const dec = Math.abs(L.vmax - L.vmin) < 2 ? 3 : Math.abs(L.vmax - L.vmin) < 50 ? 1 : 0;
    return {
      id: L.id as Timbre, label: en ? L.en : L.tr, instrument: INSTRUMENT_LABEL[L.id]?.[lang] ?? '', unit,
      min: L.vmin, max: L.vmax, baseHz: 0, when: `${monthName(month, lang)} ${L.year} · ${L.product} ${L.variable}`,
      sample: (p) => this.value(layerIdx, month, p),
      // kırpılmış pakette (sürüm 2) sınırdaki değer "≥ / ≤" okunur; sürüm 3'te kırpma yok → kesin değer
      fmt: (v) => { const tol = (L.vmax - L.vmin) * 0.002; const pre = !this.meta.clipped ? '' : v >= L.vmax - tol ? '≥ ' : v <= L.vmin + tol ? '≤ ' : ''; return `${pre}${v.toFixed(dec)}${L.unit && L.unit !== '0–1' ? ' ' + L.unit : ''}`; },
    };
  }

  // --- günlük CO₂ (yılı meta.files.co2DailyStart; 9 MB; istenince yüklenir)
  get dailyLoaded() { return !!this.daily; }
  async loadDaily(base: string) {
    if (this.daily) return;
    const r = await fetch(`${base}data/m24/${this.meta.files.co2Daily}`);
    if (!r.ok) throw new Error(`co2 daily: HTTP ${r.status}`);
    this.daily = new Int16Array(await r.arrayBuffer());
  }
  /** Bir yerin 365 günlük CO₂ serisi (ppm). */
  dailyCo2(p: LatLon): number[] {
    if (!this.daily) return [];
    const L = this.meta.layers.find((l) => l.daily)!;
    return Array.from({ length: this.meta.files.co2DailyShape[0] }, (_, d) => this.sampleSlab(this.daily!, d, L, p));
  }
}

/** Katman → enstrüman adı (ses motorundaki eşleme lib/radar.ts INSTRUMENT_OF ile aynı). */
export const INSTRUMENT_LABEL: Record<string, { tr: string; en: string }> = {
  co2_24: { tr: 'keman', en: 'violin' }, so2_24: { tr: 'marimba', en: 'marimba' }, aod_24: { tr: 'çelesta', en: 'celesta' },
  t2m_24: { tr: 'gitar', en: 'guitar' }, ts_24: { tr: 'gitar (pes)', en: 'guitar (low)' }, albedo_24: { tr: 'flüt', en: 'flute' },
  sst_24: { tr: 'arp', en: 'harp' }, precip_24: { tr: 'çello', en: 'cello' }, seaice_24: { tr: 'flüt (tiz)', en: 'flute (high)' },
  o3_24: { tr: 'çelesta (seyrek)', en: 'celesta (sparse)' }, twland_24: { tr: 'çello (pes)', en: 'cello (low)' }, lai_24: { tr: 'marimba (orta)', en: 'marimba (mid)' },
};
