// Radar sonifikasyonu — saf hesap (DOM/ses yok; Node testleri de bunu kullanır).
// Caldwell 73 (SVS 13786) yöntemi Dünya'ya uyarlandı:
//   yön (ışın açısı)   → stereo konum (doğu sağ, batı sol)
//   katman / tür        → enstrüman (keman, gitar, arp, çello, çelesta, flüt, marimba)
//   değer               → nota (yüksek değer ince nota) + hafif vurgu
//   uzaklık             → ışını elle çevirirken (←/→) yakın-orta-uzak üç nota
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
export const DEFAULTS = { beams: 32, rings: 8 }; // 32 ışın = 2 ölçü (16'lık adımlar)

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

// ---------------- Müzik eşlemesi (orkestra) ----------------
// Değer → nota (Do majör pentatonik: her nota birbiriyle uyumlu). Katman → enstrüman ve ritim rolü.
/** Do majör pentatonik dizinin i. notası (i = 0 → C2). */
export const pentaHz = (i: number) => 65.406 * Math.pow(2, (12 * Math.floor(i / 5) + PENTA[((i % 5) + 5) % 5]) / 12);

/** start: en pes nota (pentaHz indeksi) · span: nota aralığı · every: kaç ışında bir çalar · offset: ritim kayması · gate: bu eşiğin altı sessiz. */
export interface Part { start: number; span: number; every: number; offset: number; gate: number }
export const PARTS: Record<Timbre, Part> = {
  co2: { start: 12, span: 9, every: 4, offset: 0, gate: -1 },          // keman: uzun yaylı notalar (E4…)
  temp: { start: 5, span: 10, every: 2, offset: 0, gate: -1 },          // gitar: sekizlikler (C3…)
  sst: { start: 13, span: 9, every: 1, offset: 0, gate: -1 },           // arp: her adım (yalnız deniz üstünde)
  black_carbon: { start: 0, span: 7, every: 2, offset: 1, gate: 0.07 }, // çello pizzicato (C2…)
  dust: { start: 20, span: 7, every: 1, offset: 0, gate: 0.07 },        // çelesta (C6…)
  sea_salt: { start: 15, span: 7, every: 4, offset: 2, gate: 0.07 },    // flüt (C5…)
  sulfate: { start: 10, span: 8, every: 2, offset: 0, gate: 0.07 },     // marimba (C4…)
  lightning: { start: 20, span: 5, every: 1, offset: 0, gate: 0.07 },
};

/** [b, b+count) ışınlarında, [k0, k1) halkalarında ortalama değer ve veri kapsamı (0..1). Veri yoksa mean = NaN. */
export function groupMean(vals: Float32Array, P: RadarParams, b: number, count: number, k0 = 0, k1 = P.rings): { mean: number; cover: number } {
  let s = 0, n = 0, total = 0;
  for (let i = 0; i < count; i++) {
    const bb = (b + i) % P.beams;
    for (let k = k0; k < k1; k++) { total++; const v = vals[bb * P.rings + k]; if (!Number.isNaN(v)) { s += v; n++; } }
  }
  return { mean: n ? s / n : NaN, cover: total ? n / total : 0 };
}

/** Değer (0..1'e ölçeklenmiş) → enstrümanın notası (Hz). Değer yükseldikçe nota incelir. */
export const noteHz = (t: number, part: Part) => pentaHz(part.start + Math.round(Math.max(0, Math.min(1, t)) * part.span));

/** Sesli özet (S tuşu). */
export function summarize(layer: RadarLayer, vals: Float32Array, P: RadarParams, placeName: string, lang: 'tr' | 'en' = 'tr'): string {
  const en = lang === 'en';
  const c = layer.sample(P.center);
  const { max, min } = extremes(vals, P);
  const cov = localRange(vals).coverage;
  const parts = [`${placeName}, ${layer.label}, ${layer.when}.`];
  if (en) {
    parts.push(Number.isNaN(c) ? 'No data at the center.' : `At the center: ${layer.fmt(c)}.`);
    if (max && min) {
      parts.push(`Within ${formatKm(P.rangeKm)}, the highest is ${layer.fmt(max.v)}, ${formatKm(max.km)} to the ${compass8(max.bearing, 'en')}.`);
      parts.push(`The lowest is ${layer.fmt(min.v)}, ${formatKm(min.km)} to the ${compass8(min.bearing, 'en')}.`);
    } else parts.push('No data in the radar area.');
    if (cov < 0.999) parts.push(`Data covers ${Math.round(cov * 100)} percent of the area.`);
  } else {
    parts.push(Number.isNaN(c) ? 'Merkezde veri yok.' : `Merkezde ${layer.fmt(c)}.`);
    if (max && min) {
      parts.push(`${formatKm(P.rangeKm)} içinde en yüksek ${layer.fmt(max.v)}, ${compass8(max.bearing)} yönünde ${formatKm(max.km)} uzakta.`);
      parts.push(`En düşük ${layer.fmt(min.v)}, ${compass8(min.bearing)} yönünde ${formatKm(min.km)} uzakta.`);
    } else parts.push('Radar alanında veri yok.');
    if (cov < 0.999) parts.push(`Alanın yüzde ${Math.round(cov * 100)}'inde veri var.`);
  }
  return parts.join(' ');
}

/** Tek ışın açıklaması (←/→ ile elle yön çevirirken). */
export function describeBeam(layer: RadarLayer, vals: Float32Array, P: RadarParams, b: number, lang: 'tr' | 'en' = 'tr'): string {
  const en = lang === 'en';
  const br = bearingOf(b, P.beams);
  const third = Math.max(1, Math.round(P.rings / 3));
  const pick = (k0: number, k1: number) => { const v = groupMean(vals, P, b, 1, k0, k1).mean; return Number.isNaN(v) ? (en ? 'no data' : 'veri yok') : layer.fmt(v); };
  const near = pick(0, third), mid = pick(third, P.rings - third), far = pick(P.rings - third, P.rings);
  return en ? `${compass8(br, 'en')}, ${Math.round(br)} degrees. Near ${near}, middle ${mid}, far ${far}.`
    : `${compass8(br)}, ${Math.round(br)} derece. Yakın ${near}, orta ${mid}, uzak ${far}.`;
}
