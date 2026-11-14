// Küre/harita için eşdikdörtgen (2:1) dokular. Üst satır = kuzey, sol sütun = 180°B.
import type { LatLon } from './geo.ts';
import type { LandMask } from './land.ts';

/** Bir boyama fonksiyonundan 2:1 canvas (veri yoksa saydam). */
export function paintEquirect(paint: (p: LatLon) => [number, number, number] | null, w = 1024, h = 512): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let j = 0; j < h; j++) {
    const lat = 90 - ((j + 0.5) / h) * 180;
    for (let i = 0; i < w; i++) {
      const rgb = paint({ lat, lon: -180 + ((i + 0.5) / w) * 360 });
      const o = (j * w + i) * 4;
      if (!rgb) { img.data[o + 3] = 0; continue; }
      img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * Kara/kıyı dokusu: R = kıyı çizgisi (0/255), G = kara (0/255). Shader'da taban renk ve kıyı katmanı için.
 * Kaynak: SVS 5544 görselinden türetilmiş 0.5° kara maskesi.
 */
export function landTexture(land: LandMask, w = 2048, h = 1024): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  const L = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) L[j * w + i] = land.isLand({ lat: 90 - ((j + 0.5) / h) * 180, lon: -180 + ((i + 0.5) / w) * 360 }) ? 1 : 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const c0 = L[j * w + i], r = L[j * w + ((i + 1) % w)], d = j + 1 < h ? L[(j + 1) * w + i] : c0;
    const o = (j * w + i) * 4;
    img.data[o] = c0 !== r || c0 !== d ? 255 : 0;
    img.data[o + 1] = c0 ? 255 : 0;
    img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
