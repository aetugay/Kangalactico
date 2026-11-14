// SES DÜNYALARI (auditory icons) — saf hesap (DOM/ses yok; Node testleri de kullanır).
// Her veri doğada o şeyin kendi sesiyle duyulur: sesin TÜRÜ "ne var"ı, ŞİDDETİ ve SIKLIĞI "ne kadar"ı anlatır.
// Değerler challenge SVS görsellerinden (renk skalası → değer; public/data/*.json). Ölçek KÜRESEL: Sahra hep tozlu, Amazon hep yeşil.
// Uzaklık (0 = merkez, 1 = menzil sınırı) → daha kısık + daha boğuk (alçak geçiren) + gök gürültüsünde gecikme.
import { compass8 } from './geo.ts';
import type { RadarLayer, Timbre } from './radar.ts';

export type World = 'heat' | 'ocean' | 'dust' | 'smoke' | 'spray' | 'volcano' | 'thunder' | 'city' | 'forest';
export const WORLD_OF: Partial<Record<Timbre, World>> = {
  temp: 'heat', sst: 'ocean', dust: 'dust', black_carbon: 'smoke', sea_salt: 'spray', sulfate: 'volcano', lightning: 'thunder', lights: 'city', ndvi: 'forest',
};
/** every: kaç ışında bir yeni ses dokusu (dokular üst üste biner, kesintisiz duyulur) · gate: küresel ölçekte bu eşiğin altı "yok" → sessizlik. */
export const WORLD_PART: Record<World, { every: number; gate: number }> = {
  heat: { every: 2, gate: -1 }, ocean: { every: 2, gate: -1 }, dust: { every: 1, gate: 0.07 }, smoke: { every: 2, gate: 0.07 },
  spray: { every: 2, gate: 0.07 }, volcano: { every: 4, gate: 0.07 }, thunder: { every: 1, gate: 0.01 }, city: { every: 2, gate: 0.03 }, forest: { every: 2, gate: -1 },
};

/** Sentez parametreleri (motor bunları seslendirir). Aynı girdi → aynı parametre (rastgele olaylar da seed'e bağlı). */
export interface WorldParams {
  world: World;
  level: number;      // genel şiddet 0..1 (uzaklık dahil)
  cutoff: number;     // alçak geçiren üst sınır Hz (uzaklıkla düşer: boğuklaşma)
  rate: number;       // ayrık olay sıklığı (olay/sn): kum tanesi, çıtırtı, çakma, kuş, buz çatırtısı
  sharp: number;      // sertlik 0..1 (olayların parlaklığı / atak)
  delay: number;      // sn (yalnız gök gürültüsü: uzaktaki gürleme geç gelir)
  mix: Record<string, number>; // dünyaya özgü karışım (ör. sıcaklık: buz / esinti / ağustos böceği)
}

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
/** v: gerçek değer (katman biriminde) · t: küresel ölçekte 0..1 · dist: 0 merkez … 1 uzak. */
export function worldParams(world: World, v: number, t: number, dist: number): WorldParams {
  const near = 1 - 0.65 * dist;                 // uzakta daha kısık
  const muffle = 1 - 0.75 * dist;               // uzakta daha boğuk
  const p = (level: number, cutoff: number, rate: number, sharp: number, mix: Record<string, number> = {}, delay = 0): WorldParams =>
    ({ world, level: +clamp(level * near).toFixed(4), cutoff: Math.round(Math.max(120, cutoff * muffle)), rate: +rate.toFixed(3), sharp: +clamp(sharp).toFixed(3), delay: +delay.toFixed(3), mix });
  switch (world) {
    case 'dust': return p(0.25 + 0.75 * t, 2200 + 3800 * t, 4 + 40 * t * t, 0.3 + 0.7 * t);                  // kum fırtınası: hışırtı + savrulan taneler
    case 'smoke': return p(0.25 + 0.75 * t, 3000 + 3000 * t, 2 + 22 * t, 0.4 + 0.6 * t);                     // yangın: çıtırtı + alçak uğultu
    case 'spray': return p(0.3 + 0.7 * t, 900 + 2600 * t, 0, 0.2 + 0.6 * t);                                  // dalga serpintisi
    case 'volcano': return p(0.3 + 0.7 * t, 160 + 260 * t, 0, t);                                             // derin volkan uğultusu
    case 'thunder': return p(0.35 + 0.65 * t, 2600 * (1 - 0.85 * dist) + 180, 0.4 + 5 * t, 1 - dist, {}, 0.05 + 0.6 * dist); // gürleme; yakın = sert çatırtı
    case 'city': return p(0.2 + 0.8 * t, 500 + 1500 * t, 0, t, { traffic: clamp(0.3 + 0.7 * t), crowd: clamp((t - 0.2) / 0.8) });
    case 'forest': {                                                                                             // yaprak + kuşlar; çıplak arazi = boş rüzgâr
      const rich = clamp((t - 0.25) / 0.65);
      return p(0.35 + 0.65 * t, 4500 + 3000 * t, 6 * rich * rich, 0.5, { leaves: rich, birds: rich, wind: 1 - rich });
    }
    case 'heat': {                                                                                               // °C: soğuk = buzlu rüzgâr + çatırtı; sıcak = ağustos böcekleri + titreme
      const icy = clamp((5 - v) / 25), hot = clamp((v - 22) / 14), breeze = clamp(1 - icy - hot);
      return p(0.45 + 0.4 * Math.max(icy, hot), 1800 + 5200 * hot + 1200 * icy, 6 * icy, icy, { icy, hot, breeze });
    }
    case 'ocean': {                                                                                              // °C: sıcak = yumuşak tropik dalga; soğuk = sert, buzlu, çatırtılı
      const warm = clamp((v - 4) / 24), cold = 1 - warm, ice = clamp((3 - v) / 5);
      return p(0.55, 450 + 1700 * cold, 5 * ice, cold, { warm, cold, ice });
    }
  }
}

const LEVELS_TR = ['çok hafif', 'hafif', 'orta', 'yoğun', 'çok yoğun'], LEVELS_EN = ['very light', 'light', 'moderate', 'strong', 'very strong'];
const lvl = (t: number, en: boolean) => (en ? LEVELS_EN : LEVELS_TR)[Math.min(4, Math.floor(clamp(t) * 5))];
/** Kısa sözlü tanım: "yoğun kum fırtınası (toz yüksek)". */
export function describeWorld(world: World, v: number, t: number, lang: 'tr' | 'en' = 'tr'): string {
  const en = lang === 'en', L = lvl(t, en);
  switch (world) {
    case 'dust': return en ? `${L} sandstorm (dust)` : `${L} kum fırtınası (toz)`;
    case 'smoke': return en ? `${L} fire crackle (smoke, black carbon)` : `${L} yangın çıtırtısı (duman, kara karbon)`;
    case 'spray': return en ? `${L} sea spray (sea salt)` : `${L} dalga serpintisi (deniz tuzu)`;
    case 'volcano': return en ? `${L} deep volcanic rumble (sulfate)` : `${L} derin volkan uğultusu (sülfat)`;
    case 'thunder': return en ? `${L} thunder (lightning)` : `${L} gök gürültüsü (yıldırım)`;
    case 'city': return t < 0.03 ? (en ? 'dark, quiet' : 'karanlık, sessiz') : en ? `${L} city hum (night lights)` : `${L} şehir uğultusu (gece ışıkları)`;
    case 'forest': return t < 0.25 ? (en ? 'bare land, empty wind' : 'çıplak arazi, boş rüzgâr') : en ? `${L} forest, birds (vegetation)` : `${L} orman, kuşlar (bitki örtüsü)`;
    case 'heat': return v < 5 ? (en ? `icy wind (${Math.round(v)} °C)` : `buzlu rüzgâr (${Math.round(v)} °C)`) : v > 22 ? (en ? `cicadas, hot air (${Math.round(v)} °C)` : `ağustos böcekleri, sıcak hava (${Math.round(v)} °C)`) : (en ? `mild breeze (${Math.round(v)} °C)` : `ılık esinti (${Math.round(v)} °C)`);
    case 'ocean': return v < 3 ? (en ? `icy, crackling waves (${Math.round(v)} °C)` : `buzlu, çatırtılı dalgalar (${Math.round(v)} °C)`) : v > 22 ? (en ? `soft tropical waves (${Math.round(v)} °C)` : `yumuşak tropik dalgalar (${Math.round(v)} °C)`) : (en ? `cool waves (${Math.round(v)} °C)` : `serin dalgalar (${Math.round(v)} °C)`);
  }
}
/** Yön satırı: "Kuzeydoğu: yoğun kum fırtınası (toz) · yakın". */
export function directionLine(bearing: number, world: World, v: number, t: number, band: number, lang: 'tr' | 'en' = 'tr'): string {
  const d = compass8(bearing, lang); const where = lang === 'en' ? ['near', 'middle', 'far'][band] : ['yakın', 'orta', 'uzak'][band];
  return `${d[0].toUpperCase()}${d.slice(1)}: ${describeWorld(world, v, t, lang)} · ${where}`;
}

/** Sesli lejant cümlesi (her dünya). */
export function legendLine(world: World, lang: 'tr' | 'en' = 'tr'): string {
  const en = lang === 'en';
  const T: Record<World, [string, string]> = {
    dust: ['Bu kum fırtınası sesi toz demek. Ne kadar güçlüyse o kadar çok toz var. Önce az, sonra çok.', 'This sandstorm sound means dust. The stronger it is, the more dust. First a little, then a lot.'],
    smoke: ['Bu yangın çıtırtısı duman ve kara karbon demek. Çıtırtı sıklaştıkça duman artar. Önce az, sonra çok.', 'This fire crackle means smoke and black carbon. More crackles, more smoke. First a little, then a lot.'],
    spray: ['Bu dalga serpintisi deniz tuzu demek. Serpinti güçlendikçe havada daha çok tuz var.', 'This sea spray means sea salt. Stronger spray, more salt in the air.'],
    volcano: ['Bu derin uğultu sülfat demek; volkanlar ve kirlilik. Uğultu büyüdükçe sülfat artar.', 'This deep rumble means sulfate, from volcanoes and pollution. A louder rumble, more sulfate.'],
    thunder: ['Bu gök gürültüsü yıldırım demek. Gürlemeler sıklaştıkça şimşek artar. Yakındakiler sert çatırdar, uzaktakiler boğuk gürler.', 'This thunder means lightning. More rumbles, more lightning. Near ones crack sharply, far ones rumble low.'],
    city: ['Bu şehir uğultusu gece ışıkları demek. Işık arttıkça trafik ve kalabalık sesi yoğunlaşır; karanlıkta sessizlik.', 'This city hum means night lights. Brighter places sound busier; dark places are silent.'],
    forest: ['Bu yaprak hışırtısı ve kuş sesleri bitki örtüsü demek. Ne kadar yeşilse o kadar çok kuş; çıplak arazide yalnız rüzgâr.', 'Rustling leaves and birds mean vegetation. The greener, the more birds; bare land is just wind.'],
    heat: ['Bu sıcaklık sesi: soğukta buzlu rüzgâr ve çatırdayan buz, sıcakta ağustos böcekleri. Önce soğuk, sonra sıcak.', 'This is temperature: icy wind and cracking ice when cold, cicadas when hot. First cold, then hot.'],
    ocean: ['Bu dalga sesi deniz sıcaklığı demek: sıcak suda yumuşak dalgalar, soğuk suda sert ve buzlu dalgalar. Önce soğuk, sonra sıcak.', 'These waves mean sea temperature: soft waves in warm water, harsh icy waves in cold water. First cold, then warm.'],
  };
  return T[world][en ? 1 : 0];
}
/** Lejant örnekleri: (v, t) az ve çok. */
export function legendExamples(world: World, layer: RadarLayer): [number, number][] {
  if (world === 'heat') return [[-15, 0], [32, 1]];
  if (world === 'ocean') return [[0, 0], [28, 1]];
  return [[layer.min + 0.15 * (layer.max - layer.min), 0.15], [layer.max, 0.95]];
}

/** FNV-1a: olay seed'i (aynı veri → aynı rastgele dizilim). */
export function seedOf(...parts: (string | number)[]): number {
  let h = 2166136261; const s = parts.join('|');
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
