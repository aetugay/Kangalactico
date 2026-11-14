// Radar sonifikasyonu — saf hesap (DOM/ses yok; Node testleri de bunu kullanır).
// Caldwell 73 (SVS 13786) yöntemi Dünya'ya uyarlandı:
//   yön (ışın açısı)   → stereo konum (doğu sağ, batı sol)
//   katman / tür        → enstrüman (keman, gitar, arp, çello, çelesta, flüt, marimba)
//   değer               → nota (yüksek değer ince nota) + hafif vurgu
//   uzaklık             → ışını elle çevirirken (←/→) yakın-orta-uzak üç nota
import { destination, compass8, formatKm, type LatLon } from './geo.ts';

export type Timbre = 'co2' | 'temp' | 'sst' | 'black_carbon' | 'dust' | 'sea_salt' | 'sulfate' | 'lightning' | 'ndvi' | 'lights'
  // 2024 aylık NASA katmanları (MERRA-2 / OCO-2; public/data/m24)
  | 'co2_24' | 'so2_24' | 'aod_24' | 't2m_24' | 'ts_24' | 'albedo_24' | 'sst_24' | 'precip_24' | 'seaice_24' | 'o3_24' | 'twland_24' | 'lai_24' | 'gwettop_24';
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

/**
 * Ölçek (Adım 2): değerin 0..1'e nasıl yayıldığı.
 *   local  (varsayılan): bu radar alanındaki en düşük → en pes, en yüksek → en ince nota. Küçük farklar da duyulur.
 *   global: katmanın sabit aralığı. Aynı değer her yerde aynı nota (yerler arası karşılaştırma).
 * Ekran okuyucu her zaman GERÇEK değeri okur; ölçek yalnız sesi etkiler.
 */
export type Scale = 'local' | 'global';
/** Yerel ölçek en az katman aralığının bu kadarını kapsar: neredeyse düz alanda nicemleme gürültüsü 2 oktava şişirilmesin. */
export const MIN_LOCAL_SPAN = 0.02;
/** Ölçeğin gerçek birimdeki alt/üst sınırı. */
export function scaleRange(layer: RadarLayer, scale: Scale, local?: { min: number; max: number }): { lo: number; hi: number } {
  if (scale === 'local' && local && Number.isFinite(local.min) && Number.isFinite(local.max)) {
    let lo = local.min, hi = local.max;
    const minSpan = (layer.max - layer.min) * MIN_LOCAL_SPAN;
    if (hi - lo < minSpan) { const c = (lo + hi) / 2; lo = c - minSpan / 2; hi = c + minSpan / 2; }
    return { lo, hi };
  }
  return { lo: layer.min, hi: layer.max };
}
/** Değer → ölçekteki yeri 0..1 (perde, ritim yoğunluğu, parlaklık ve vurgu bundan). */
export function gainFor(v: number, layer: RadarLayer, scale: Scale, local?: { min: number; max: number }): number {
  if (Number.isNaN(v)) return 0;
  const { lo, hi } = scaleRange(layer, scale, local);
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

/**
 * start: tercih edilen en pes nota (pentaHz indeksi; REG_MIN..REG_MAX'a sıkıştırılır) · every: kaç ışında bir çalar
 * offset: ritim kayması · gate: (aerosol) küresel ölçekte bu eşiğin altı "yok denecek kadar az" → sessiz.
 * Her katman 2 oktav kullanır (Adım 2): bilim = 12 tam ton adımı, hikâye = 10 pentatonik adım.
 */
export interface Part { start: number; every: number; offset: number; gate: number }
export const PARTS: Record<Timbre, Part> = {
  co2: { start: 12, every: 4, offset: 0, gate: -1 },          // keman: uzun yaylı notalar
  temp: { start: 5, every: 2, offset: 0, gate: -1 },          // gitar: sekizlikler
  sst: { start: 13, every: 1, offset: 0, gate: -1 },          // arp: her adım (yalnız deniz üstünde)
  black_carbon: { start: 0, every: 2, offset: 1, gate: 0.07 }, // çello pizzicato
  dust: { start: 20, every: 1, offset: 0, gate: 0.07 },       // çelesta
  sea_salt: { start: 15, every: 4, offset: 2, gate: 0.07 },   // flüt
  sulfate: { start: 10, every: 2, offset: 0, gate: 0.07 },    // marimba
  lightning: { start: 5, every: 1, offset: 0, gate: 0.01 },   // vurmalı: yıldırımlı hücre = çakma (olay yoksa sessiz)
  ndvi: { start: 9, every: 2, offset: 1, gate: -1 },          // marimba
  lights: { start: 15, every: 2, offset: 0, gate: 0.03 },     // çelesta (karanlık = sessiz)
  co2_24: { start: 12, every: 4, offset: 2, gate: -1 },      // keman
  so2_24: { start: 10, every: 2, offset: 1, gate: -1 },      // marimba
  aod_24: { start: 18, every: 2, offset: 0, gate: -1 },      // çelesta
  t2m_24: { start: 5, every: 2, offset: 0, gate: -1 },       // gitar
  ts_24: { start: 3, every: 2, offset: 1, gate: -1 },        // gitar (pes)
  albedo_24: { start: 15, every: 4, offset: 2, gate: -1 },   // flüt
  sst_24: { start: 13, every: 1, offset: 0, gate: -1 },      // arp
  precip_24: { start: 0, every: 2, offset: 1, gate: -1 },    // çello
  seaice_24: { start: 19, every: 4, offset: 0, gate: -1 },   // flüt (tiz)
  o3_24: { start: 16, every: 4, offset: 1, gate: -1 },       // çelesta (uzun aralık)
  twland_24: { start: 2, every: 2, offset: 0, gate: -1 },    // çello
  lai_24: { start: 9, every: 2, offset: 1, gate: -1 },       // marimba
  gwettop_24: { start: 11, every: 1, offset: 0, gate: -1 },  // arp (yalnız karada; denizde veri yok → sessiz)
};
/** Kayıt sınırları (pentaHz indeksi): 5 = C3 (131 Hz; dizüstü hoparlörde de duyulur) … 15 = C5; üstüne 2 oktav → en tiz C7 (2093 Hz). */
export const REG_MIN = 5, REG_MAX = 15;
/** 2 oktav: bilim modunda tam ton adımı sayısı, hikâye modunda pentatonik adım sayısı. */
export const STEPS: Record<Mode, number> = { bilim: 12, hikaye: 10 };
const clampReg = (s: number) => Math.max(REG_MIN, Math.min(REG_MAX, s));
/**
 * Açık katmanların kayıtları (en pes notanın pentaHz indeksi), F.layers sırasıyla.
 * Tek katman (solo): kendi kaydı. Birden çok katman: pesten tize AYRI kayıtlara yayılır
 * (2 katman: C3–C5 ve C5–C7), böylece hem tını hem perde bölgesi farklı olur.
 */
export function registers(ids: Timbre[]): number[] {
  if (ids.length <= 1) return ids.map((id) => clampReg(PARTS[id].start));
  const order = ids.map((id, i) => ({ i, s: PARTS[id].start })).sort((a, b) => a.s - b.s || a.i - b.i);
  const out: number[] = new Array(ids.length);
  order.forEach((o, r) => { out[o.i] = Math.round(REG_MIN + (r * (REG_MAX - REG_MIN)) / (ids.length - 1)); });
  return out;
}
/** Değer → ritim yoğunluğu: düşük değer 1 vuruş, orta 2, yüksek 3 (aynı nota süresi içinde). */
export const hitsFor = (t: number) => (t < 1 / 3 ? 1 : t < 2 / 3 ? 2 : 3);

/** Katman kimliği → ses motorundaki enstrüman (2024 katmanları var olan enstrümanları kullanır). */
export const INSTRUMENT_OF: Partial<Record<Timbre, string>> = {
  co2_24: 'co2', so2_24: 'sulfate', aod_24: 'dust', t2m_24: 'temp', ts_24: 'temp', albedo_24: 'sea_salt', sst_24: 'sst', precip_24: 'black_carbon', ndvi: 'sulfate', lights: 'dust', seaice_24: 'sea_salt', o3_24: 'dust', twland_24: 'black_carbon', lai_24: 'sulfate', gwettop_24: 'sst',
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

/**
 * Değer (0..1) → nota (Hz), 2 oktav. Değer yükseldikçe nota incelir; kromatik değil, dizeye oturtulur:
 *   bilim : tam ton dizisi (eşit 2 yarım tonluk adımlar → perde değerle doğrusal), 13 nota
 *   hikâye: Do majör pentatonik, 11 nota
 * start: kaydın en pes notası (pentaHz indeksi); verilmezse katmanın solo kaydı.
 */
export function noteHz(t: number, part: Part, mode: Mode = 'bilim', start = clampReg(part.start)): number {
  const tt = Math.max(0, Math.min(1, t));
  const step = Math.round(tt * STEPS[mode]);
  return mode === 'bilim' ? pentaHz(start) * Math.pow(2, (2 * step) / 12) : pentaHz(start + step);
}

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

// ---------------- Ses olayları: YALNIZCA veriden (saf fonksiyon; Node testinde de çalışır) ----------------
/** Radarın bir anlık durumu (ses için gereken her şey). */
export interface FrameData {
  P: RadarParams;
  mode: Mode;
  /** Ölçek (varsayılan yerel). Karşılaştırmada yerel ölçek iki yerin birleşik aralığıdır (A ve B aynı ölçekte). */
  scale?: Scale;
  layers: { layer: RadarLayer; vals: Float32Array; local: { min: number; max: number } }[];
  /** Tur başı referans tonları: merkez(ler). Karşılaştırmada önce A sonra B. Verilmezse radarın merkezi. */
  refs?: { tag: string; name: string; center: LatLon }[];
}
/** Bir nota olayı ve onu üreten veri. Her alan veriden türetilir; veriden bağımsız ses olayı yoktur. */
export interface SoundEvent {
  layerId: Timbre; label: string; unit: string | null;
  beam: number; bearing: number;     // ışın ve yönü (derece)
  kmFrom: number; kmTo: number;      // değerin ortalandığı uzaklık aralığı
  value: number;                     // gerçek değer (ölçek dönüşümünden önce)
  valueText: string;                 // ekran okuyucu için gerçek değer metni
  t: number;                         // değerin ölçekteki yeri 0..1
  freq: number; gain: number; pan: number; durBeams: number;
  hits: number;                      // ritim yoğunluğu: nota süresi içinde 1–3 vuruş (değer ↑ → sık)
  bright: number;                    // tını parlaklığı 0..1 (değer ↑ → parlak; alçak geçiren süzgeç)
  ref?: { tag: string; name: string }; // tur başı referans tonu (merkez değeri) ise
}

/** Katmanların kayıtları (F.layers sırasıyla). */
const regsOf = (F: FrameData) => registers(F.layers.map((l) => l.layer.id));

/**
 * b. ışın adımında çalınacak notalar. Kurallar:
 *  - her olay bir veri değerinden (o ışının halkalarındaki ortalama) üretilir;
 *  - veri yoksa (NaN: ızgara dışı, okyanus katmanı karada…) olay YOK → sessizlik;
 *  - aynı veri → aynı olay (rastgelelik yok).
 */
export function beamEvents(F: FrameData, b: number): SoundEvent[] {
  const { P } = F;
  const out: SoundEvent[] = [];
  const regs = regsOf(F), scale = F.scale ?? 'local';
  F.layers.forEach(({ layer, vals, local }, li) => {
    if (WORLD_OF[layer.id]) return; // ses dünyası katmanı: nota değil, worldEvents
    const part = PARTS[layer.id];
    if ((((b - part.offset) % part.every) + part.every) % part.every !== 0) return; // bu katmanın ritim adımı değil
    const { mean } = groupMean(vals, P, b, part.every);
    if (Number.isNaN(mean) || beamCover(vals, P, b, part.every) < 0.5) return; // veri yok (ya da grubun çoğunda yok) → sessizlik
    if (part.gate > 0 && gainFor(mean, layer, 'global') < part.gate) return; // (aerosol) yok denecek kadar az → sessizlik (ölçekten bağımsız)
    const t = gainFor(mean, layer, scale, local);
    const bearing = bearingOf(b + (part.every - 1) / 2, P.beams);
    out.push({ layerId: layer.id, label: layer.label, unit: layer.unit, beam: b, bearing, kmFrom: 0, kmTo: P.rangeKm,
      value: mean, valueText: layer.fmt(mean), t, freq: noteHz(t, part, F.mode, regs[li]), gain: t, pan: panFor(bearing),
      durBeams: part.every * 0.92, hits: hitsFor(t), bright: t });
  });
  return out;
}

/**
 * Tur başı referans tonları (Adım 2): ilk katmanın MERKEZ değeri, aynı ölçek ve kayıtla, ortada (pan 0).
 * Karşılaştırmada önce A sonra B — iki yerin farkı her turda yan yana duyulur. Merkezde veri yoksa ton yok.
 */
export function refEvents(F: FrameData): SoundEvent[] {
  const fi = F.layers.findIndex((l) => !WORLD_OF[l.layer.id]); const first = F.layers[fi];
  if (!first) return [];
  const { layer, local } = first, part = PARTS[layer.id], reg = regsOf(F)[fi], scale = F.scale ?? 'local';
  const refs = F.refs?.length ? F.refs : [{ tag: '', name: '', center: F.P.center }];
  const out: SoundEvent[] = [];
  for (const r of refs) {
    const v = layer.sample(r.center);
    if (Number.isNaN(v)) continue;
    const t = gainFor(v, layer, scale, local);
    out.push({ layerId: layer.id, label: layer.label, unit: layer.unit, beam: -1, bearing: 0, kmFrom: 0, kmTo: 0,
      value: v, valueText: layer.fmt(v), t, freq: noteHz(t, part, F.mode, reg), gain: t, pan: 0, durBeams: 0, hits: 1, bright: t, ref: { tag: r.tag, name: r.name } });
  }
  return out;
}

/**
 * Yerel ölçeğin aralığı: ÇALINAN değerlerin (katmanın ritim adımlarındaki ışın grubu ortalamaları) en düşüğü ve en yükseği.
 * Hücre uçları değil — yoksa ortalamalar ölçeğin ortasına sıkışır ve 2 oktavın yarısı kullanılmaz.
 * extra: ölçeğe katılacak başka değerler (referans tonlarının merkez değerleri), böylece referans da ölçeğin içinde kalır.
 */
export function playedRange(layer: RadarLayer, vals: Float32Array, P: RadarParams, extra: number[] = []): { min: number; max: number; coverage: number } {
  const part = PARTS[layer.id];
  let min = Infinity, max = -Infinity;
  for (const v of extra) if (!Number.isNaN(v)) { if (v < min) min = v; if (v > max) max = v; }
  for (let b = 0; b < P.beams; b++) {
    if ((((b - part.offset) % part.every) + part.every) % part.every !== 0) continue;
    const { mean } = groupMean(vals, P, b, part.every);
    if (Number.isNaN(mean) || beamCover(vals, P, b, part.every) < 0.5) continue;
    if (mean < min) min = mean; if (mean > max) max = mean;
  }
  return { min, max, coverage: localRange(vals).coverage };
}

/** Ölçek açıklaması (ekran + ekran okuyucu): "Karbondioksit: yerel ölçek 411.2 ppm (en pes) – 414.0 ppm (en ince)". */
export function describeScale(layer: RadarLayer, scale: Scale, local: { min: number; max: number } | undefined, lang: 'tr' | 'en' = 'tr'): string {
  const { lo, hi } = scaleRange(layer, scale, local);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return lang === 'en' ? `${layer.label}: no data in the radar area` : `${layer.label}: radar alanında veri yok`;
  return lang === 'en'
    ? `${layer.label}: ${scale === 'local' ? 'local scale' : 'global scale'} ${layer.fmt(lo)} (lowest note) – ${layer.fmt(hi)} (highest note)`
    : `${layer.label}: ${scale === 'local' ? 'yerel ölçek' : 'küresel ölçek'} ${layer.fmt(lo)} (en pes) – ${layer.fmt(hi)} (en ince)`;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** Frekans → nota adı (A4 = 440 Hz), ör. 659.3 → "E5". */
export function noteName(hz: number): string {
  const m = Math.round(69 + 12 * Math.log2(hz / 440));
  return `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
}

/** Canlı gösterge satırı: "Karbondioksit · kuzeydoğu 45° · 0–2000 km ort. → 414.2 ppm → E5 (659 Hz)". */
export function formatEvent(e: SoundEvent, lang: 'tr' | 'en' = 'tr'): string {
  const en = lang === 'en';
  const w = (e as Partial<WorldEvent>).world;
  if (w) return e.ref ? `${en ? 'Center' : 'Merkez'}${e.ref.tag ? ' ' + e.ref.tag : ''}: ${describeWorld(w, e.value, e.t, lang)}` : directionLine(e.bearing, w, e.value, e.t, (e as WorldEvent).band, lang);
  const note = `${noteName(e.freq)} (${Math.round(e.freq)} Hz)`;
  if (e.ref) {
    const who = e.ref.tag ? `${e.ref.tag}${e.ref.name ? ' · ' + e.ref.name : ''}` : (en ? 'center' : 'merkez');
    return `${en ? 'Reference' : 'Referans'} (${who}) · ${e.label} → ${e.valueText} → ${note}`;
  }
  const dir = `${compass8(e.bearing, lang)} ${Math.round(e.bearing)}°`;
  const dist = en ? `${Math.round(e.kmFrom)}–${formatKm(e.kmTo)} avg.` : `${Math.round(e.kmFrom)}–${formatKm(e.kmTo)} ort.`;
  const hits = en ? `${e.hits} ${e.hits === 1 ? 'beat' : 'beats'}` : `${e.hits} vuruş`;
  return `${e.label} · ${dir} · ${dist} → ${e.valueText} → ${note} · ${hits}`;
}
/** Veri olmayan ışın için: "kuzeydoğu 45°: veri yok → ses yok". */
export function formatSilent(bearing: number, lang: 'tr' | 'en' = 'tr'): string {
  return lang === 'en' ? `${compass8(bearing, 'en')} ${Math.round(bearing)}°: no data → silence` : `${compass8(bearing)} ${Math.round(bearing)}°: veri yok → ses yok`;
}

/** Bu adımda çalma sırası gelmiş ama verisi OLMAYAN katmanlar (ör. okyanus katmanı karada) — "sessizlik" göstergesi için. */
export function beamSilences(F: FrameData, b: number): { label: string; bearing: number }[] {
  const out: { label: string; bearing: number }[] = [];
  for (const { layer, vals } of F.layers) {
    const part = PARTS[layer.id];
    if ((((b - part.offset) % part.every) + part.every) % part.every !== 0) continue;
    if (Number.isNaN(groupMean(vals, F.P, b, part.every).mean) || beamCover(vals, F.P, b, part.every) < 0.5) out.push({ label: layer.label, bearing: bearingOf(b + (part.every - 1) / 2, F.P.beams) });
  }
  return out;
}

/** [b, b+count) ışınlarından kaçında (en az bir halkada) veri var — 0..1. Grubun çoğunda veri yoksa nota çalmaz. */
export function beamCover(vals: Float32Array, P: RadarParams, b: number, count: number): number {
  let n = 0;
  for (let i = 0; i < count; i++) {
    const bb = (b + i) % P.beams;
    for (let k = 0; k < P.rings; k++) if (!Number.isNaN(vals[bb * P.rings + k])) { n++; break; }
  }
  return count ? n / count : 0;
}

// ---------------- SES DÜNYALARI: ışın başına yakın / orta / uzak bant olayları (saf; Node testinde de çalışır) ----------------
import { WORLD_OF, WORLD_PART, worldParams, seedOf, describeWorld, directionLine, type World, type WorldParams } from './worlds.ts';
/** Gösterge satırları: ses dünyası olayları katman başına tek satır (en güçlü bant), notalar olduğu gibi. */
export function formatEvents(events: SoundEvent[], lang: 'tr' | 'en' = 'tr'): string[] {
  const best = new Map<string, SoundEvent>(); const out: string[] = [];
  for (const e of events) { if (!(e as Partial<WorldEvent>).world) { out.push(formatEvent(e, lang)); continue; } const k = e.layerId + (e.ref ? 'r' + e.ref.tag : ''); const o = best.get(k); if (!o || e.t > o.t) best.set(k, e); }
  return [...[...best.values()].map((e) => formatEvent(e, lang)), ...out];
}
export interface WorldEvent extends SoundEvent { world: World; band: number; params: WorldParams; seed: number }
/** Halka bantları: [başlangıç, bitiş] (menzil oranı) ve uzaklık (0 merkez … 1 sınır). */
export const WORLD_BANDS: [number, number, number][] = [[0, 0.25, 0.15], [0.25, 0.625, 0.5], [0.625, 1, 0.85]];
export const isWorldLayer = (id: Timbre) => !!WORLD_OF[id];

/** b. ışın adımındaki ses dünyası olayları. Ölçek KÜRESEL; veri yoksa (ya da bandın yarısından azında varsa) o bant sessiz. */
export function worldEvents(F: FrameData, b: number): WorldEvent[] {
  const { P } = F; const out: WorldEvent[] = [];
  for (const { layer, vals } of F.layers) {
    const world = WORLD_OF[layer.id]; if (!world) continue;
    const part = WORLD_PART[world];
    if (b % part.every !== 0) continue;
    const bearing = bearingOf(b + (part.every - 1) / 2, P.beams);
    WORLD_BANDS.forEach(([r0, r1, dist], band) => {
      const k0 = Math.round(r0 * P.rings), k1 = Math.max(k0 + 1, Math.round(r1 * P.rings));
      const { mean, cover } = groupMean(vals, P, b, part.every, k0, k1);
      if (Number.isNaN(mean) || cover < 0.5) return;
      const t = gainFor(mean, layer, 'global');
      if (part.gate > 0 && t < part.gate) return;
      const params = worldParams(world, mean, t, dist);
      out.push({ layerId: layer.id, label: layer.label, unit: layer.unit, beam: b, bearing, kmFrom: r0 * P.rangeKm, kmTo: r1 * P.rangeKm,
        value: mean, valueText: layer.fmt(mean), t, freq: 0, gain: params.level, pan: panFor(bearing) * (0.6 + 0.4 * dist), durBeams: part.every * 1.5,
        hits: 1, bright: t, world, band, params, seed: seedOf(layer.id, b, band, Math.round(mean * 1000)) });
    });
  }
  return out;
}
/** Tur başı: MERKEZ noktanın sesi (uzaklık 0 → en net), her dünya için. Karşılaştırmada A sonra B. */
export function worldRefEvents(F: FrameData): WorldEvent[] {
  const out: WorldEvent[] = [];
  const refs = F.refs?.length ? F.refs : [{ tag: '', name: '', center: F.P.center }];
  refs.forEach((r, ri) => {
    for (const { layer } of F.layers) {
      const world = WORLD_OF[layer.id]; if (!world) continue;
      const v = layer.sample(r.center); if (Number.isNaN(v)) continue;
      const t = gainFor(v, layer, 'global'); if (WORLD_PART[world].gate > 0 && t < WORLD_PART[world].gate) continue;
      const params = worldParams(world, v, t, 0);
      out.push({ layerId: layer.id, label: layer.label, unit: layer.unit, beam: -1, bearing: 0, kmFrom: 0, kmTo: 0, value: v, valueText: layer.fmt(v), t, freq: 0,
        gain: params.level, pan: 0, durBeams: 0, hits: 1, bright: t, world, band: -1, params, seed: seedOf(layer.id, 'ref', ri, Math.round(v * 1000)), ref: { tag: r.tag, name: r.name } });
    }
  });
  return out;
}
