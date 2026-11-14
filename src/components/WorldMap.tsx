import { useEffect, useRef } from 'react';
import { destination, type LatLon } from '../lib/geo.ts';
import { drawCoast, type LandMask } from '../lib/land.ts';

interface Props {
  /** Noktanın rengi; null = veri yok. */
  paint: (p: LatLon) => [number, number, number] | null;
  land?: LandMask | null;
  paintKey: string; // değişince yeniden boya
  center: LatLon | null;
  rangeKm: number;
  onPick: (p: LatLon) => void;
}

/** Eşdikdörtgen dünya haritası (1° ızgara). Dokunarak konum seçilir; klavye için şehir arama kullanılır. */
export function WorldMap({ paint, paintKey, center, rangeKm, onPick, land }: Props) {
  const cv = useRef<HTMLCanvasElement>(null);
  const base = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = document.createElement('canvas');
    const W = 720, H = 360;
    c.width = W; c.height = H;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(W, H);
    const ll = (i: number, j: number) => ({ lat: 90 - ((j + 0.5) / H) * 180, lon: -180 + ((i + 0.5) / W) * 360 });
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const rgb = paint(ll(i, j)) ?? [200, 200, 200];
      const o = (j * W + i) * 4;
      img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255;
    }
    if (land) drawCoast(img.data, W, H, (i, j) => land.isLand(ll(i, j)));
    ctx.putImageData(img, 0, 0);
    base.current = c;
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paintKey, land]);

  useEffect(() => { draw(); }); // merkez/menzil değişince

  function draw() {
    const canvas = cv.current, b = base.current;
    if (!canvas || !b) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = w / 2;
    canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(b, 0, 0, w, h);
    if (!center) return;
    const X = (lon: number) => ((lon + 180) / 360) * w, Y = (lat: number) => ((90 - lat) / 180) * h;
    // menzil çemberi (dünya üzerinde gerçek çember; haritada eğri)
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    let prev: { x: number; y: number } | null = null;
    ctx.beginPath();
    for (let a = 0; a <= 360; a += 3) {
      const p = destination(center, a, rangeKm), x = X(p.lon), y = Y(p.lat);
      if (!prev || Math.abs(x - prev.x) > w / 2) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      prev = { x, y };
    }
    ctx.stroke(); ctx.setLineDash([]);
    const cx = X(center.lon), cy = Y(center.lat);
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
  }

  useEffect(() => {
    const ro = new ResizeObserver(() => draw());
    if (cv.current) ro.observe(cv.current);
    return () => ro.disconnect();
  });

  return (
    <canvas
      ref={cv}
      className="worldmap"
      role="img"
      aria-label="Dünya haritası. Dokunarak radar merkezini seçebilirsin; klavye ve ekran okuyucu için şehir arama kutusunu kullan."
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const lon = ((e.clientX - r.left) / r.width) * 360 - 180;
        const lat = 90 - ((e.clientY - r.top) / r.height) * 180;
        onPick({ lat: Math.max(-89.5, Math.min(89.5, lat)), lon });
      }}
    />
  );
}
