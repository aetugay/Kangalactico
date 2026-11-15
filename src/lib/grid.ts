// public/data/<id>.json ızgaralarını (360x180, 1°, 8-bit nicemli base64) çözme ve örnekleme.
import type { LatLon } from './geo.ts';

export interface Quant { bits: 8; nodata: 255; scale?: number; offset?: number; encoding?: 'sqrt'; max?: number }
export interface GridMeta { w: number; h: number; lonL: number; lonR: number; latT: number; latB: number }

/** Bir katmanın bayt dizisi (frames × w × h) + çözme. */
export class Layer {
  readonly bytes: Uint8Array;
  readonly frames: number;
  readonly grid: GridMeta;
  readonly quant: Quant;
  constructor(grid: GridMeta, b64: string, quant: Quant) {
    this.grid = grid; this.quant = quant;
    this.bytes = decodeBase64(b64);
    this.frames = this.bytes.length / (grid.w * grid.h);
  }
  /** Hücre değeri; veri yoksa NaN. */
  cell(frame: number, i: number, j: number): number {
    const q = this.bytes[frame * this.grid.w * this.grid.h + j * this.grid.w + i];
    if (q === 255) return NaN;
    if (this.quant.encoding === 'sqrt') return (this.quant.max ?? 1) * (q / 254) ** 2;
    return (this.quant.offset ?? 0) + q * (this.quant.scale ?? 1);
  }
  /**
   * Çift doğrusal örnekleme (veri olmayan komşular ağırlıktan düşülür). Boylam sarmalanır.
   * mode: 'sound' (varsayılan; radar/ses — kendi hücresi boşsa NaN) · 'smooth' (yalnız görsel; kıyıyı kara/deniz poligonu keser)
   *       · 'cells' (yalnız görsel; ham hücre değeri, "veri hücrelerini göster").
   */
  sample(frame: number, p: LatLon, mode: 'sound' | 'smooth' | 'cells' = 'sound'): number {
    const { w, h, lonL, lonR, latT, latB } = this.grid;
    const fx = ((p.lon - lonL) / (lonR - lonL)) * w - 0.5;
    const fy = ((latT - p.lat) / (latT - latB)) * h - 0.5;
    // Noktanın KENDİ hücresinde veri yoksa NaN (ör. okyanus katmanı karada): komşu hücrelerden değer taşınmaz.
    const ci = ((Math.floor(fx + 0.5) % w) + w) % w, cj = Math.min(h - 1, Math.max(0, Math.floor(fy + 0.5)));
    if (mode === 'cells') return this.cell(frame, ci, cj);
    if (mode === 'sound' && Number.isNaN(this.cell(frame, ci, cj))) return NaN;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    let s = 0, ws = 0;
    for (let dy = 0; dy <= 1; dy++) {
      const j = Math.min(h - 1, Math.max(0, y0 + dy));
      for (let dx = 0; dx <= 1; dx++) {
        const i = (((x0 + dx) % w) + w) % w;
        const v = this.cell(frame, i, j);
        if (Number.isNaN(v)) continue;
        const wt = (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty);
        s += v * wt; ws += wt;
      }
    }
    if (ws > 1e-6) return s / ws;
    if (mode !== 'smooth') return NaN;
    // YALNIZ GÖRSEL: kaynak görselin piksel analizinde değer çıkmayan küçük boşluk kümeleri (≤ 2 hücre) komşulardan
    // uzaklık ağırlıklı doldurulur; ses / okunan değer bu yolu KULLANMAZ ('sound' kendi hücresine bakar). Kıyıyı maske keser.
    let s2 = 0, w2 = 0;
    for (let dy = -2; dy <= 2; dy++) {
      const j = Math.min(h - 1, Math.max(0, cj + dy));
      for (let dx = -2; dx <= 2; dx++) {
        const v = this.cell(frame, (((ci + dx) % w) + w) % w, j);
        if (Number.isNaN(v)) continue;
        const wt = 1 / (1 + dx * dx + dy * dy); s2 += v * wt; w2 += wt;
      }
    }
    return w2 > 0 ? s2 / w2 : NaN;
  }
}

export function decodeBase64(b64: string): Uint8Array {
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  // Node (testler)
  return new Uint8Array((globalThis as unknown as { Buffer: { from(s: string, e: string): Uint8Array } }).Buffer.from(b64, 'base64'));
}

export interface ColorStep { v: number; rgb: [number, number, number] }
export interface ColorScale { id: string; kind: string; unit: string | null; min: number; max: number; steps: ColorStep[] }

/** Değer → renk (renk skalası tablosundan, en yakın adım). */
export function colorFor(cs: ColorScale, v: number): [number, number, number] {
  const t = (v - cs.min) / (cs.max - cs.min);
  const k = Math.max(0, Math.min(cs.steps.length - 1, Math.round(t * (cs.steps.length - 1))));
  return cs.steps[k].rgb;
}
