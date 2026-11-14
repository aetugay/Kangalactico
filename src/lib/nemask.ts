// Natural Earth 1:50m kara poligonları → eşdikdörtgen kara rasterı (yalnız GÖRSEL: veri katmanını kıyıdan keskin kırpmak için).
// Ses ve radar bunu KULLANMAZ; onlar gerçek veri hücrelerini kullanır.
export interface LandRaster { w: number; h: number; isLand(lat: number, lon: number): boolean }

export async function loadLandRaster(base: string, w = 2880, h = 1440): Promise<LandRaster> {
  const j = await (await fetch(`${base}data/land_50m.json`)).json() as { points: number; starts: number[]; data: string };
  const bin = atob(j.data), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const q = new Int16Array(u8.buffer), ends = [...j.starts.slice(1), j.points];
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff'; ctx.beginPath();
  j.starts.forEach((s0, r) => {
    for (let i = s0; i < ends[r]; i++) {
      const x = ((q[2 * i] / 100 + 180) / 360) * w, y = ((90 - q[2 * i + 1] / 100) / 180) * h;
      if (i === s0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  });
  ctx.fill('evenodd');
  const px = ctx.getImageData(0, 0, w, h).data;
  return {
    w, h,
    isLand(lat, lon) {
      const i = Math.min(w - 1, Math.max(0, Math.floor(((lon + 180) / 360) * w))), k = Math.min(h - 1, Math.max(0, Math.floor(((90 - lat) / 180) * h)));
      return px[(k * w + i) * 4] > 127;
    },
  };
}
