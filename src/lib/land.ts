// Kara maskesi (0.5°) — kıyı çizgisi çizimi için. Kaynak: SVS 5544 NDVI görselinden türetildi (public/data/land_mask.json).
import { decodeBase64 } from './grid.ts';
import type { LatLon } from './geo.ts';

export interface LandFile { w: number; h: number; data: string }

export class LandMask {
  readonly w: number;
  readonly h: number;
  private bits: Uint8Array;
  constructor(f: LandFile) { this.w = f.w; this.h = f.h; this.bits = decodeBase64(f.data); }
  isLand(p: LatLon): boolean {
    const i = ((Math.floor(((p.lon + 180) / 360) * this.w) % this.w) + this.w) % this.w;
    const j = Math.max(0, Math.min(this.h - 1, Math.floor(((90 - p.lat) / 180) * this.h)));
    const c = j * this.w + i;
    return (this.bits[c >> 3] >> (c & 7) & 1) === 1;
  }
}

/** Kenar bulma: kara/deniz değişen piksellere kıyı rengi (RGBA tampon üzerinde, yerinde). */
export function drawCoast(rgba: Uint8ClampedArray, w: number, h: number, land: (x: number, y: number) => boolean | null, color: [number, number, number] = [15, 15, 20]) {
  const L = new Int8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = land(x, y); L[y * w + x] = v === null ? -1 : v ? 1 : 0; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = L[y * w + x]; if (c < 0) continue;
    const r = x + 1 < w ? L[y * w + x + 1] : c, d = y + 1 < h ? L[(y + 1) * w + x] : c;
    if ((r >= 0 && r !== c) || (d >= 0 && d !== c)) { const o = (y * w + x) * 4; rgba[o] = color[0]; rgba[o + 1] = color[1]; rgba[o + 2] = color[2]; rgba[o + 3] = 255; }
  }
}
