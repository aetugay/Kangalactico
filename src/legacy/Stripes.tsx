import { useEffect, useRef } from 'react';
import { colour, type Scale, type Series } from './mapping';

interface Props {
  series: Series;
  scale: Scale;
  idx: number;
  /** x: 0..1 arası yatay konum */
  onPointerDown: (x: number) => void;
  onPointerMove: (x: number) => void;
  onPointerLeave: () => void;
}

/** Görsel iklim şeritleri + tarama yüzeyi. Ekran okuyucu için asıl kontrol YearSlider'dır. */
export function Stripes({ series, scale, idx, onPointerDown, onPointerMove, onPointerLeave }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = cv.current!;
    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = series.length;
      const bw = w / n;
      series.forEach(([, v], i) => {
        ctx.fillStyle = colour(scale.norm(v));
        ctx.fillRect(i * bw, 0, Math.ceil(bw) + 0.5, h);
      });
      ctx.beginPath();
      series.forEach(([, v], i) => {
        const x = i * bw + bw / 2;
        const y = h - 14 - scale.norm(v) * (h - 28);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.strokeStyle = 'rgba(28,31,38,.55)';
      ctx.lineWidth = 2;
      ctx.stroke();
      const x = idx * bw;
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.fillRect(x, 0, bw, h);
      ctx.strokeStyle = '#1c1f26';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, 1, Math.max(bw - 2, 2), h - 2);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [series, scale, idx]);

  const fx = (clientX: number) => {
    const r = wrap.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  };

  return (
    <div
      ref={wrap}
      className="stripes"
      aria-hidden="true"
      onPointerDown={(e) => onPointerDown(fx(e.clientX))}
      onPointerMove={(e) => onPointerMove(fx(e.clientX))}
      onPointerLeave={onPointerLeave}
    >
      <canvas ref={cv} />
    </div>
  );
}
