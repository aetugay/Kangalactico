import { useEffect, useRef } from 'react';
import { destination, formatKm, type LatLon } from '../lib/geo.ts';
import { drawCoast, type LandMask } from '../lib/land.ts';

interface Props {
  center: LatLon;
  rangeKm: number;
  /** Radar ekranındaki noktanın rengi; null = veri yok. */
  paint: (p: LatLon) => [number, number, number] | null;
  paintKey: string;
  /** Işın açısı (derece) — her karede çağrılır; null = ışın yok. */
  angle: () => number | null;
  /** Ek işaretler (örn. yıldırım olayları): radar içi { bearing, km, color } */
  marks?: { bearing: number; km: number; color: string }[];
  land?: LandMask | null;
}

const SIZE = 320; // görüntü örnekleme çözünürlüğü (CSS boyutundan bağımsız)

/** Kutupsal (azimutal eşit uzaklık) radar ekranı: merkez seçilen yer, yukarı kuzey. */
export function RadarView({ center, rangeKm, paint, paintKey, angle, marks = [], land }: Props) {
  const cv = useRef<HTMLCanvasElement>(null);
  const base = useRef<HTMLCanvasElement | null>(null);

  // Arka plan görüntüsü: her piksel → (yön, uzaklık) → coğrafi nokta → renk
  useEffect(() => {
    const c = document.createElement('canvas');
    c.width = SIZE; c.height = SIZE;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(SIZE, SIZE);
    const R = SIZE / 2;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const dx = x + 0.5 - R, dy = y + 0.5 - R, r = Math.hypot(dx, dy);
      const o = (y * SIZE + x) * 4;
      if (r > R) { img.data[o + 3] = 0; continue; }
      const br = (Math.atan2(dx, -dy) * 180) / Math.PI;
      const rgb = paint(destination(center, br, (r / R) * rangeKm)) ?? [60, 60, 60];
      img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255;
    }
    if (land) drawCoast(img.data, SIZE, SIZE, (x, y) => { const dx = x + 0.5 - R, dy = y + 0.5 - R, r = Math.hypot(dx, dy); if (r > R) return null; return land.isLand(destination(center, (Math.atan2(dx, -dy) * 180) / Math.PI, (r / R) * rangeKm)); });
    ctx.putImageData(img, 0, 0);
    base.current = c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paintKey, center.lat, center.lon, rangeKm, land]);

  useEffect(() => {
    let raf = 0;
    const frame = () => {
      const canvas = cv.current, b = base.current;
      if (canvas && b) {
        const dpr = window.devicePixelRatio || 1;
        const w = canvas.clientWidth;
        if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(w * dpr); }
        const ctx = canvas.getContext('2d')!;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const R = w / 2 - 14, C = w / 2;
        ctx.clearRect(0, 0, w, w);
        ctx.save(); ctx.beginPath(); ctx.arc(C, C, R, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(b, C - R, C - R, 2 * R, 2 * R);
        ctx.restore();
        // halkalar
        ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1;
        for (let k = 1; k <= 4; k++) { ctx.beginPath(); ctx.arc(C, C, (R * k) / 4, 0, Math.PI * 2); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(C, C - R); ctx.lineTo(C, C + R); ctx.moveTo(C - R, C); ctx.lineTo(C + R, C); ctx.stroke();
        // işaretler
        for (const m of marks) {
          const a = (m.bearing * Math.PI) / 180, rr = (m.km / rangeKm) * R;
          ctx.fillStyle = m.color; ctx.beginPath(); ctx.arc(C + Math.sin(a) * rr, C - Math.cos(a) * rr, 2.5, 0, Math.PI * 2); ctx.fill();
        }
        // ışın
        const ang = angle();
        if (ang !== null) {
          const a = (ang * Math.PI) / 180;
          const g = ctx.createConicGradient ? ctx.createConicGradient(a - Math.PI / 2 - 0.6, C, C) : null;
          if (g) {
            g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.095, 'rgba(255,255,255,.35)'); g.addColorStop(0.096, 'rgba(255,255,255,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(C, C, R, 0, Math.PI * 2); ctx.fill();
          }
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(C, C); ctx.lineTo(C + Math.sin(a) * R, C - Math.cos(a) * R); ctx.stroke();
        }
        // merkez + yön harfleri
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(C, C, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(C, C, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111'; ctx.font = '700 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('K', C, 7); ctx.fillText('G', C, w - 7); ctx.fillText('D', w - 7, C); ctx.fillText('B', 7, C);
        ctx.font = '600 11px system-ui, sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
        ctx.fillText(formatKm(rangeKm), C + 4, C - R + 10);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [angle, marks, rangeKm]);

  return <canvas ref={cv} className="radarview" aria-hidden="true" />;
}
