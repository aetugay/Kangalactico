// Görsel doğrulama: tahmini pikselin çevresini büyütüp kırmızı artı + 1-piksel cetvel noktaları çizer.
import { lonLatToPixel } from './geo.mjs';
import { writePng } from './raster.mjs';

/** points: [{name,lat,lon}], R: kaynak px yarıçap, Z: büyütme. Yan yana kareler → PNG. */
export function cropTiles(img, bounds, points, out, { R = 24, Z = 5, region = { x0: 0, x1: img.w } } = {}) {
  const T = (2 * R + 1) * Z;
  const W = T * points.length + 4 * (points.length - 1);
  const buf = new Uint8Array(W * T * 3).fill(255);
  points.forEach((pt, k) => {
    const p = lonLatToPixel(pt.lon, pt.lat, region.x1 - region.x0, img.h, bounds);
    const cx = Math.floor(p.x) + region.x0, cy = Math.floor(p.y);
    const ox = k * (T + 4);
    for (let sy = -R; sy <= R; sy++) for (let sx = -R; sx <= R; sx++) {
      const x = Math.min(img.w - 1, Math.max(0, cx + sx)), y = Math.min(img.h - 1, Math.max(0, cy + sy));
      const si = (y * img.w + x) * 3;
      for (let zy = 0; zy < Z; zy++) for (let zx = 0; zx < Z; zx++) {
        const di = (((sy + R) * Z + zy) * W + ox + (sx + R) * Z + zx) * 3;
        buf[di] = img.data[si]; buf[di + 1] = img.data[si + 1]; buf[di + 2] = img.data[si + 2];
      }
    }
    // artı: tahmini (sürekli) konum
    const mx = Math.round((p.x - Math.floor(p.x) + R) * Z), my = Math.round((p.y - Math.floor(p.y) + R) * Z);
    const set = (x, y, c) => { if (x < 0 || y < 0 || x >= T || y >= T) return; const i = (y * W + ox + x) * 3; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; };
    for (let d = -T; d <= T; d++) {
      const dist = Math.abs(d);
      if (dist < Z * 0.6) continue; // merkezi açık bırak
      const onTick = dist % Z === 0;
      set(mx + d, my, onTick ? [255, 255, 0] : [255, 0, 0]);
      set(mx, my + d, onTick ? [255, 255, 0] : [255, 0, 0]);
    }
  });
  writePng(out, W, T, buf, 'rgb24');
}
