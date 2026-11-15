// VERİDEN DOĞAN MÜZİK — doğa seslerinin altında yumuşak zemin. Saf hesap (Node testinde de çalışır).
// Kurallar: rastgelelik yok; aynı veri → aynı müzik; veri yoksa o katmanın müziği susar; her radar turu bir cümle.
//  - RUH HALİ: radar alanının "zorlanma"sı (toz, duman, sık şimşek, aşırı sıcak/soğuk) → majör pentatonik (sakin) ↔ minör (gergin)
//  - TEMPO/YOĞUNLUK: toplam yoğunluk → kaç ışında bir nota (seyrek ↔ sık)
//  - IŞIN: o yöndeki BASKIN ses dünyası → çalgı; değeri → akor derecesi; yön → stereo; uzaklık → kısıklık
import { bearingOf, groupMean, gainFor, panFor, type FrameData } from './radar.ts';
import { WORLD_OF, type World } from './worlds.ts';

export type Instr = 'harp' | 'tremolo' | 'pad' | 'timpani' | 'marimba' | 'pulse' | 'celesta' | 'drone';
export interface Mood { stress: number; minor: boolean; energy: number; every: number }
export interface MusicEvent { beam: number; instr: Instr; world: World; freqs: number[]; gain: number; pan: number; durBeams: number; minor: boolean; t: number }

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
/** Dünyanın "zorlanma" katkısı (0..1) ve "rahatlık" katkısı; v gerçek değer, t küresel 0..1. */
function stressOf(w: World, v: number, t: number): number {
  switch (w) {
    case 'dust': case 'smoke': case 'volcano': return t;
    case 'thunder': return t;
    case 'heat': return Math.max(clamp((v - 30) / 12), clamp((-5 - v) / 25));   // aşırı sıcak / soğuk
    case 'ocean': return clamp((2 - v) / 6) * 0.6;                              // buzlu deniz biraz gergin
    case 'forest': return clamp(0.35 - t);                                       // çıplak arazi hafif gergin, orman rahat
    default: return 0;
  }
}
/** Radar alanının ruh hali: alanın tüm hücrelerinden (veri olanlar). */
export function moodOf(F: FrameData): Mood {
  let sMax = 0, sSum = 0, n = 0, eSum = 0, forestT = 0;
  for (const { layer, vals } of F.layers) {
    const w = WORLD_OF[layer.id]; if (!w) continue;
    let s = 0, e = 0, c = 0;
    for (const v of vals) { if (Number.isNaN(v)) continue; const t = gainFor(v, layer, 'global'); s += stressOf(w, v, t); e += t; c++; }
    if (!c) continue;
    const sm = s / c; sMax = Math.max(sMax, sm); sSum += sm; eSum += e / c; n++;
    if (w === 'forest') forestT = e / c;
  }
  if (!n) return { stress: 0, minor: false, energy: 0, every: 4 };
  const calm = clamp((forestT - 0.5) / 0.5);                               // zengin orman = sağlıklı → gerilimi azaltır
  const stress = +clamp(0.6 * sMax + 0.4 * (sSum / n) - 0.25 * calm).toFixed(3), energy = +clamp(eSum / n).toFixed(3);
  return { stress, minor: stress >= 0.4, energy, every: energy > 0.66 ? 1 : energy > 0.33 ? 2 : 4 };
}

// Ölçek: A minör / C majör (aynı notalar; ruh hali kök ve dereceleri değiştirir). Müzik 220–880 Hz bölgesinde (doğa sesleri: uğultular altta, hışırtılar üstte).
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const MAJOR = [[60, 64, 67], [65, 69, 72], [67, 71, 74], [57, 60, 64]];   // I IV V vi (C)
const MINOR = [[57, 60, 64], [62, 65, 69], [64, 67, 71], [53, 57, 60]];   // i iv v VI (Am)
const INSTR: Record<World, Instr> = { ocean: 'harp', smoke: 'tremolo', dust: 'pad', thunder: 'timpani', forest: 'marimba', city: 'pulse', spray: 'harp', volcano: 'drone', heat: 'drone', current: 'harp' };

/** b. ışında müzik: baskın dünya (yakın yarıda en yüksek t) → çalgı + akor. Veri yoksa nota yok. */
export function musicEvents(F: FrameData, b: number, mood: Mood): MusicEvent[] {
  if (b % mood.every !== 0) return [];
  const { P } = F; let best: { w: World; v: number; t: number; far: number } | null = null;
  for (const { layer, vals } of F.layers) {
    const w = WORLD_OF[layer.id]; if (!w) continue;
    const near = groupMean(vals, P, b, mood.every, 0, Math.ceil(P.rings / 2)), far = groupMean(vals, P, b, mood.every, Math.ceil(P.rings / 2), P.rings);
    const v = Number.isNaN(near.mean) ? far.mean : near.mean; if (Number.isNaN(v)) continue;
    const t = gainFor(v, layer, 'global');
    const gate = w === 'dust' || w === 'smoke' || w === 'spray' || w === 'volcano' ? 0.07 : w === 'thunder' ? 0.01 : w === 'city' ? 0.17 : -1;
    if (t < gate) continue;
    const score = w === 'heat' || w === 'ocean' ? 0.35 + 0.3 * t : t; // sıcaklık/deniz her yerde var: baskınlıkta biraz geri
    if (!best || score > best.t) best = { w, v, t: score, far: Number.isNaN(near.mean) ? 1 : 0 };
  }
  if (!best) return [];
  let instr = INSTR[best.w];
  if (best.w === 'heat') instr = best.v < 8 ? 'celesta' : best.v > 22 ? 'drone' : 'harp';
  if (best.w === 'ocean' && best.v < 8) instr = 'celesta';                    // soğuk deniz = cam/çelesta, seyrek // soğuk = çelesta (cam), sıcak = alçak drone, ılık = yumuşak arp
  const chords = mood.minor ? MINOR : MAJOR;
  const deg = Math.min(3, Math.floor(clamp(best.t) * 4));                 // değer → akor derecesi
  const ch = chords[deg];
  const oct = instr === 'timpani' || instr === 'drone' ? -24 : instr === 'celesta' ? 12 : 0;
  const freqs = (instr === 'timpani' ? [ch[0]] : instr === 'tremolo' ? [ch[0] - 12, ch[0]] : ch).map((m) => midi(m + oct));
  const bearing = bearingOf(b + (mood.every - 1) / 2, P.beams);
  // kazanç × √(every/2): seyrek müzikte nota biraz güçlü, sık müzikte yumuşak → ortalama düzey sabit
  return [{ beam: b, instr, world: best.w, freqs, gain: +(0.32 * (0.55 + 0.45 * clamp(best.t)) * (best.far ? 0.55 : 1) * Math.sqrt(mood.every / 2)).toFixed(4), pan: panFor(bearing) * 0.8, durBeams: mood.every * 1.4, minor: mood.minor, t: +clamp(best.t).toFixed(3) }];
}

/** Hava durumu müziği (günün verisinden): güneşli → parlak majör; yağmurlu → yumuşak minör piyano; karlı → seyrek çelesta; fırtınalı → gerilimli yaylı + timpani. */
export function weatherMusic(d: { tMean: number; precipMm: number; snowMm: number; wind: number; thunderChance: boolean; cloud: number }) {
  const storm = d.thunderChance || d.wind > 12, snow = d.snowMm >= 0.5, rain = d.precipMm - d.snowMm >= 0.5;
  const kind: 'sunny' | 'rain' | 'snow' | 'storm' | 'cloudy' = storm ? 'storm' : snow ? 'snow' : rain ? 'rain' : d.cloud < 0.4 ? 'sunny' : 'cloudy';
  const minor = kind === 'rain' || kind === 'storm' || kind === 'snow';
  const ch = (minor ? MINOR : MAJOR)[Math.min(3, Math.floor(clamp((d.tMean + 10) / 45) * 4))];  // sıcaklık → akor derecesi
  const instr: Instr = kind === 'snow' ? 'celesta' : kind === 'storm' ? 'tremolo' : 'harp';
  const notesPerSec = kind === 'snow' ? 0.8 : kind === 'storm' ? 2 : 1.4 + clamp(d.wind / 10);
  return { kind, minor, instr, freqs: ch.map((m) => midi(m + (instr === 'celesta' ? 12 : 0))), notesPerSec: +notesPerSec.toFixed(2), timpani: kind === 'storm' };
}
