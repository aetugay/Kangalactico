// Radar sonifikasyonu — saf hesap (DOM/ses yok; Node testleri de bunu kullanır).
// Caldwell 73 (SVS 13786) yöntemi Dünya'ya uyarlandı:
//   yön (ışın açısı)   → stereo konum (doğu sağ, batı sol)
//   uzaklık (halka)     → perde (yakın pes, uzak tiz)
//   katman / tür        → enstrüman
//   değer               → ses şiddeti
import { destination, compass8, formatKm, type LatLon } from './geo.ts';

export type Timbre = 'co2' | 'temp' | 'sst' | 'black_carbon' | 'dust' | 'sea_salt' | 'sulfate' | 'lightning';
export type Mode = 'bilim' | 'hikaye';

export interface RadarLayer {
  id: Timbre;
  label: string;          // "Yüzey sıcaklığı"
  instrument: string;     // "yumuşak telli" — lejant ve etiketler için
  unit: string | null;    // "°C" ya da null (göreli)
  min: number; max: number; // değer → şiddet için sabit aralık (bilim modu)
  baseHz: number;         // en yakın halkanın perdesi
  when: string;           // zaman açıklaması ("14 Kas 2026 15:00 UTC (tahmin)")
  /** Noktadaki değer; veri yoksa NaN. */
  sample(p: LatLon): number;
  /** Ekran okuyucu için değer metni */
  fmt(v: number): string;
}

export interface RadarParams { center: LatLon; rangeKm: number; beams: number; rings: number }
export const DEFAULTS = { beams: 36, rings: 8 };

export const bearingOf = (b: number, beams: number) => (b * 360) / beams;
export const ringKm = (k: number, rings: number, rangeKm: number) => ((k + 0.5) / rings) * rangeKm;

/** Bir katmanın ışın×halka değerleri (halka bandında 3 alt örneğin ortalaması). */
export function sampleLayer(layer: RadarLayer, P: RadarParams): Float32Array {
  const out = new Float32Array(P.beams * P.rings);
  for (let b = 0; b < P.beams; b++) {
    const br = bearingOf(b, P.beams);
    for (let k = 0; k < P.rings; k++) {
      let s = 0, n = 0;
      for (const f of [0.25, 0.5, 0.75]) {
        const v = layer.sample(destination(P.center, br, ((k + f) / P.rings) * P.rangeKm));
        if (!Number.isNaN(v)) { s += v; n++; }
      }
      out[b * P.rings + k] = n ? s / n : NaN;
    }
  }
  return out;
}

const PENTA = [0, 2, 4, 7, 9];
/** Halka → perde. Bilim: uzaklıkla doğrusal yarım ton (2 oktav). Hikâye: pentatonik. */
export function pitchFor(ring: number, rings: number, mode: Mode, baseHz: number): number {
  if (mode === 'bilim') return baseHz * Math.pow(2, ((ring / Math.max(1, rings - 1)) * 24) / 12);
  const step = Math.round((ring / Math.max(1, rings - 1)) * 10); // 0..10 → 2 oktav pentatonik
  return baseHz * Math.pow(2, (Math.floor(step / 5) * 12 + PENTA[step % 5]) / 12);
}

/** Değer → şiddet 0..1. Bilim: katmanın sabit aralığı. Hikâye: radar içindeki min..max'a yayılır. */
export function gainFor(v: number, layer: RadarLayer, mode: Mode, local?: { min: number; max: number }): number {
  if (Number.isNaN(v)) return 0;
  const lo = mode === 'hikaye' && local ? local.min : layer.min;
  const hi = mode === 'hikaye' && local ? local.max : layer.max;
  const t = hi > lo ? (v - lo) / (hi - lo) : 0.5;
  return Math.max(0, Math.min(1, t));
}

/** Yön → stereo (-1 batı … +1 doğu). Kuzey ve güney ortada; kuzey her turun başında "tık" ile belirtilir. */
export const panFor = (bearingDeg: number) => Math.sin((bearingDeg * Math.PI) / 180);

export function localRange(vals: Float32Array): { min: number; max: number; coverage: number } {
  let min = Infinity, max = -Infinity, n = 0;
  for (const v of vals) if (!Number.isNaN(v)) { n++; if (v < min) min = v; if (v > max) max = v; }
  return { min, max, coverage: n / vals.length };
}

export interface Extreme { v: number; bearing: number; km: number }
export function extremes(vals: Float32Array, P: RadarParams): { max: Extreme | null; min: Extreme | null } {
  let mx: Extreme | null = null, mn: Extreme | null = null;
  for (let b = 0; b < P.beams; b++) for (let k = 0; k < P.rings; k++) {
    const v = vals[b * P.rings + k]; if (Number.isNaN(v)) continue;
    const e = { v, bearing: bearingOf(b, P.beams), km: ringKm(k, P.rings, P.rangeKm) };
    if (!mx || v > mx.v) mx = e;
    if (!mn || v < mn.v) mn = e;
  }
  return { max: mx, min: mn };
}

/** Ekran okuyucu özeti (S tuşu). */
export function summarize(layer: RadarLayer, vals: Float32Array, P: RadarParams, placeName: string): string {
  const c = layer.sample(P.center);
  const { max, min } = extremes(vals, P);
  const cov = localRange(vals).coverage;
  const parts = [`${placeName}, ${layer.label}, ${layer.when}.`];
  parts.push(Number.isNaN(c) ? 'Merkezde veri yok.' : `Merkezde ${layer.fmt(c)}.`);
  if (max && min) {
    parts.push(`${formatKm(P.rangeKm)} içinde en yüksek ${layer.fmt(max.v)}, ${compass8(max.bearing)} yönünde ${formatKm(max.km)} uzakta.`);
    parts.push(`En düşük ${layer.fmt(min.v)}, ${compass8(min.bearing)} yönünde ${formatKm(min.km)} uzakta.`);
  } else parts.push('Radar alanında veri yok.');
  if (cov < 0.999) parts.push(`Alanın yüzde ${Math.round(cov * 100)}'inde veri var.`);
  return parts.join(' ');
}

/** Tek ışın açıklaması (←/→ ile elle yön çevirirken). */
export function describeBeam(layer: RadarLayer, vals: Float32Array, P: RadarParams, b: number): string {
  const br = bearingOf(b, P.beams);
  const pick = (k: number) => { const v = vals[b * P.rings + k]; return Number.isNaN(v) ? 'veri yok' : layer.fmt(v); };
  const near = 0, mid = Math.floor(P.rings / 2), far = P.rings - 1;
  return `${compass8(br)}, ${Math.round(br)} derece. Yakın ${pick(near)}, orta ${pick(mid)}, uzak ${pick(far)}.`;
}
