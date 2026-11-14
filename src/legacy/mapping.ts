// Veri → ses/renk eşlemeleri (demo/index.html'den taşındı).

export type Series = [number, number][];

export interface Scale {
  lo: number;
  hi: number;
  /** Değeri 0..1 aralığına getirir. */
  norm: (v: number) => number;
  /** i. yıldaki değişimin 0..1 gücü (ilk yıl 0). */
  growth: number[];
}

export function makeScale(series: Series): Scale {
  const vals = series.map((d) => d[1]);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const norm = (v: number) => (v - lo) / span;

  const deltas = series.slice(1).map((d, k) => d[1] - series[k][1]);
  const dlo = Math.min(...deltas);
  const dhi = Math.max(...deltas);
  const dspan = dhi - dlo || 1;
  const growth = [0, ...deltas.map((d) => (d - dlo) / dspan)];

  return { lo, hi, norm, growth };
}

// C majör pentatonik, C3'ten ~2.5 oktav (Hikâye modu tabanı).
const PENTA = [0, 2, 4, 7, 9];
const C3 = 130.81;
export function noteFor(t: number): number {
  const steps = 13;
  const k = Math.round(t * (steps - 1));
  const oct = Math.floor(k / 5);
  const deg = PENTA[k % 5];
  return C3 * Math.pow(2, (oct * 12 + deg) / 12);
}

/** Sürekli perde (tarama modu): 0..1 → 30 yarım ton. */
export const freqFor = (t: number) => C3 * Math.pow(2, (t * 30) / 12);

/** Mavi → soluk → turuncu → kırmızı. */
const STOPS = [
  [37, 99, 235],
  [147, 197, 253],
  [254, 243, 199],
  [251, 146, 60],
  [185, 28, 28],
];
export function colour(t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(x));
  const f = x - i;
  const c = STOPS[i].map((s, k) => Math.round(s + (STOPS[i + 1][k] - s) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
