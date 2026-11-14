// Aylık NASA katmanları (MERRA-2 2024 + OCO-2 GEOS L3 2021) — Ceyhun'un paketinden (sürüm 3) denetimden geçenler (public/data/m24).
// Birincil kaynak statik dosyalar (internetsiz de çalışır). monthly.bin yüklenemezse YEDEK: Ceyhun'un API'si (sürüm 3;
// statik dosyalarla 5 noktada birebir aynı — data/api_v3_tutarlilik.json). API yalnız nokta veriyor → radarın örneklediği
// hücreler istendikçe çekilir (en çok 6 eşzamanlı); aynı düzeltmeler uygulanır (SMAP denizde, deniz buzu karada "yok").
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

export const M24_API = 'https://jukebox-api-h5ve.onrender.com';
export type M24Source = 'static' | 'api';
const DAYS_2021 = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export class M24 {
  readonly meta: M24Meta;
  readonly monthly: Int16Array;
  /** Veri kaynağı: statik dosya (birincil) ya da API yedeği. */
  source: M24Source = 'static';
  /** API yedeğinde yeni hücreler gelince çağrılır (radar yeniden örneklesin). */
  onUpdate: (() => void) | null = null;
  apiFailures = 0;
  /** API yedeğinde istekler sürüyor mu (sürerken radar sessiz kalır). */
  get pending() { return this.queue.length + this.inflight > 0; }
  private daily: Int16Array | null = null;
  private ranges = new Map<string, { min: number; max: number }>();
  private cellState: Uint8Array | null = null;   // API: 0 yok · 1 bekliyor · 2 geldi · 3 hata
  private queue: number[] = []; private inflight = 0; private updTimer = 0;
  private apiDaily = new Map<number, number[]>();
  constructor(meta: M24Meta, monthly: ArrayBuffer) { this.meta = meta; this.monthly = new Int16Array(monthly); }

  /** Birincil: statik dosyalar. monthly.bin yüklenemezse API yedeği (hücre hücre). meta.json (12 KB) uygulamayla aynı yerden gelir. */
  static async load(base: string): Promise<M24> {
    const meta = await (await fetch(`${base}data/m24/meta.json`)).json() as M24Meta;
    try {
      const r = await fetch(`${base}data/m24/${meta.files.monthly}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return new M24(meta, await r.arrayBuffer());
    } catch (e) {
      console.warn('m24: statik monthly.bin yüklenemedi → API yedeği', e);
      const [n, , np] = meta.files.monthlyShape;
      const m = new M24(meta, new ArrayBuffer(n * 12 * np * 2));
      m.monthly.fill(-1); m.source = 'api'; m.cellState = new Uint8Array(np);
      return m;
    }
  }

  // ---------- API yedeği
  private request(cell: number) {
    const st = this.cellState; if (!st || st[cell] !== 0) return;
    st[cell] = 1; this.queue.push(cell);
    if (this.queue.length > 400) { const old = this.queue.shift()!; st[old] = 0; } // yer değişince eski istekler düşer
    this.pump();
  }
  private pump() {
    while (this.inflight < 6 && this.queue.length) {
      const cell = this.queue.pop()!; this.inflight++;                       // son istenen önce (yeni yer)
      fetch(`${M24_API}/api/point-sonify?id=${cell}`, { signal: AbortSignal.timeout(30000) })
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((j) => this.fill(cell, j))
        .catch(() => { this.apiFailures++; if (this.cellState) this.cellState[cell] = 3; })
        .finally(() => { this.inflight--; this.pump(); if (!this.pending) this.onUpdate?.(); }); // son hücre: radar tam veriyle yeniden örneklesin
    }
  }
  private fill(cell: number, j: { nokta_id: number; seriler: Record<string, { degerler?: number[] }> }) {
    if (j.nokta_id !== cell) throw new Error('nokta_id uyuşmuyor');
    const np = this.meta.files.monthlyShape[2], S = j.seriler;
    const land = (m: number) => (S.IMERG?.degerler?.[m] ?? -1) !== -1;     // MERRA-2 lnd dosyasının kara tanımı
    for (const L of this.meta.layers) {
      const v = S[L.src]?.degerler; if (!v) continue;
      let months: number[];
      if (v.length === 365) { // CO₂: API günlük veriyor → ay ortalaması (statik aylık değerden ort. 0,07 ppm, en çok ~1 ppm farklı olabilir)
        this.apiDaily.set(cell, v); let d0 = 0;
        months = DAYS_2021.map((n) => { const xs = v.slice(d0, d0 + n).filter((x) => x >= 0); d0 += n; return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : -1; });
      } else months = v.slice(0, 12);
      months.forEach((q, m) => {
        if (L.src === 'SMAP' && !land(m)) q = -1;                             // aynı düzeltme: deniz dolgusu
        if (L.src === 'SEAICE' && q === 0 && land(m)) q = -1;                 // karadaki 0 → yok
        this.monthly[(L.index * 12 + m) * np + cell] = q;
      });
    }
    if (this.cellState) this.cellState[cell] = 2;
    this.ranges.clear();
    if (!this.updTimer) this.updTimer = window.setTimeout(() => { this.updTimer = 0; this.onUpdate?.(); }, 250);
  }
  private cellOf(k: number, i: number) { const g = this.meta.grid; return Math.max(0, Math.min(g.nLat - 1, k)) * g.nLon + (((i % g.nLon) + g.nLon) % g.nLon); }

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
  /** want = true (radar): API yedeğinde eksik hücreleri ister. Boyama ister değildir (12.960 isteği önlemek için). */
  value(layerIdx: number, month: number, p: LatLon, want = false): number {
    if (want && this.cellState) { const g = this.meta.grid, fk = (p.lat - g.lat0) / g.dLat, fi = (p.lon - g.lon0) / g.dLon, k0 = Math.floor(fk), i0 = Math.floor(fi); let ready = true; for (const [dk, di] of [[0, 0], [0, 1], [1, 0], [1, 1]]) { const c = this.cellOf(k0 + dk, i0 + di); this.request(c); if (this.cellState[c] < 2) ready = false; }
      if (!ready || this.pending) return NaN; } // yükleme bitmeden (eksik hücre/halka) hiç nota yok: kısa sessizlik, yanlış değer değil
    return this.sampleSlab(this.monthly, layerIdx * 12 + month, this.meta.layers[layerIdx], p);
  }

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
      sample: (p) => this.value(layerIdx, month, p, true),
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
  /** Günlük CO₂: önce statik dosya, olmazsa API (en yakın hücre). */
  async dailyCo2Async(p: LatLon, base: string): Promise<number[]> {
    if (this.source === 'static') { try { await this.loadDaily(base); return this.dailyCo2(p); } catch { /* API'ye düş */ } }
    const g = this.meta.grid, cell = this.cellOf(Math.round((p.lat - g.lat0) / g.dLat), Math.round((p.lon - g.lon0) / g.dLon));
    let v = this.apiDaily.get(cell);
    if (!v) { const r = await fetch(`${M24_API}/api/point-sonify?id=${cell}`, { signal: AbortSignal.timeout(30000) }); if (!r.ok) throw new Error(`API HTTP ${r.status}`); v = (await r.json()).seriler?.CO2?.degerler as number[]; }
    const L = this.meta.layers.find((l) => l.daily)!;
    return (v ?? []).map((q) => m24Phys(L, q));
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
  o3_24: { tr: 'çelesta (seyrek)', en: 'celesta (sparse)' }, twland_24: { tr: 'çello (pes)', en: 'cello (low)' }, lai_24: { tr: 'marimba (orta)', en: 'marimba (mid)' }, gwettop_24: { tr: 'arp (kara)', en: 'harp (land)' },
};
