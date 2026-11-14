// "Meteorolog": NASA GMAO GEOS-FP tahmini (scripts/forecast.mjs → public/data/forecast.bin + forecast_meta.json).
// Saf hesap: nokta değeri, günlük özet, durum sınıflaması, sözlü anlatım. Model tahmini; resmi uyarı değildir.
import type { LatLon } from './geo.ts';

export interface ForecastMeta {
  source: string; url: string; run: string; runLabel: string; fetchedAt: string; daysAvailable: number; daysRequested: number;
  hoursUtc: number[]; steps: string[]; note: string;
  grid: { nLat: number; nLon: number; lat0: number; dLat: number; lon0: number; dLon: number };
  vars: { id: string; unit: string; scale: number; long: string }[];
}
export interface Sample { t: number; wind: number; precip: number; snow: number; conv: number; cloud: number }
export type Cond = 'clear' | 'partly' | 'cloudy' | 'drizzle' | 'rain' | 'heavy' | 'snow' | 'storm';
export interface DaySummary {
  date: string; tMin: number; tMax: number; tMean: number; precipMm: number; snowMm: number; convMm: number; cloud: number; wind: number; windMax: number;
  cond: Cond; thunderChance: boolean;
}

export class Forecast {
  readonly meta: ForecastMeta; readonly data: Int16Array; private vi: Record<string, number>;
  constructor(meta: ForecastMeta, buf: ArrayBuffer) { this.meta = meta; this.data = new Int16Array(buf); this.vi = Object.fromEntries(meta.vars.map((v, i) => [v.id, i])); }
  static async load(base: string): Promise<Forecast> {
    const m = await fetch(`${base}data/forecast_meta.json`); if (!m.ok) throw new Error(`forecast_meta: HTTP ${m.status}`);
    const meta = await m.json() as ForecastMeta;
    const b = await fetch(`${base}data/forecast.bin`); if (!b.ok) throw new Error(`forecast.bin: HTTP ${b.status}`);
    return new Forecast(meta, await b.arrayBuffer());
  }
  get nSteps() { return this.meta.steps.length; }
  /** Çift doğrusal (gerçek birim); veri yoksa NaN. */
  value(step: number, v: string, p: LatLon): number {
    const g = this.meta.grid, NP = g.nLat * g.nLon, NV = this.meta.vars.length, V = this.meta.vars[this.vi[v]];
    const fy = (p.lat - g.lat0) / g.dLat, fx = (p.lon - g.lon0) / g.dLon, y0 = Math.floor(fy), x0 = Math.floor(fx);
    let s = 0, w = 0;
    for (const [dy, dx] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
      const j = Math.max(0, Math.min(g.nLat - 1, y0 + dy)), i = (((x0 + dx) % g.nLon) + g.nLon) % g.nLon;
      const q = this.data[(step * NV + this.vi[v]) * NP + j * g.nLon + i]; if (q === -32768) continue;
      const wt = (dy ? fy - y0 : 1 - (fy - y0)) * (dx ? fx - x0 : 1 - (fx - x0)); s += (q / V.scale) * wt; w += wt;
    }
    return w > 1e-6 ? s / w : NaN;
  }
  sample(step: number, p: LatLon): Sample {
    const u = this.value(step, 'u10m', p), v = this.value(step, 'v10m', p);
    return { t: this.value(step, 't2m', p), wind: Math.hypot(u, v), precip: Math.max(0, this.value(step, 'prectot', p)), snow: Math.max(0, this.value(step, 'precsno', p)), conv: Math.max(0, this.value(step, 'preccon', p)), cloud: this.value(step, 'cldtot', p) };
  }
  /** Şimdiye en yakın adım (tahmin aralığı dışındaysa en yakın uç). */
  nowStep(now = Date.now()): number {
    let best = 0, bd = Infinity; this.meta.steps.forEach((s, i) => { const d = Math.abs(Date.parse(s) + 1800e3 - now); if (d < bd) { bd = d; best = i; } }); return best;
  }
  days(p: LatLon): DaySummary[] {
    const H = this.meta.hoursUtc.length;
    return Array.from({ length: this.meta.daysAvailable }, (_, d) => {
      const ss = Array.from({ length: H }, (_, h) => this.sample(d * H + h, p));
      const mean = (f: (s: Sample) => number) => ss.reduce((a, s) => a + f(s), 0) / ss.length;
      const day: DaySummary = {
        date: this.meta.steps[d * H].slice(0, 10), tMin: Math.min(...ss.map((s) => s.t)), tMax: Math.max(...ss.map((s) => s.t)), tMean: mean((s) => s.t),
        precipMm: mean((s) => s.precip) * 24, snowMm: mean((s) => s.snow) * 24, convMm: mean((s) => s.conv) * 24, cloud: mean((s) => s.cloud),
        wind: mean((s) => s.wind), windMax: Math.max(...ss.map((s) => s.wind)), cond: 'clear', thunderChance: false,
      };
      day.cond = classify(day.precipMm, day.snowMm, day.convMm, day.cloud);
      day.thunderChance = day.convMm >= 5 && day.convMm >= 0.5 * day.precipMm; // konvektif (sağanak) yağış baskın → gök gürültülü sağanak OLASILIĞI
      return day;
    });
  }
  /** Tahmin dosyası kaç saat önce üretildi (çalıştırma saatine göre). */
  ageHours(now = Date.now()) { return (now - Date.parse(this.meta.run)) / 3600e3; }
}

export function classify(precipMm: number, snowMm: number, convMm: number, cloud: number): Cond {
  if (precipMm >= 0.5 && snowMm >= 0.5 * precipMm) return 'snow';
  if (precipMm >= 10 && convMm >= 0.5 * precipMm) return 'storm';
  if (precipMm >= 10) return 'heavy';
  if (precipMm >= 2) return 'rain';
  if (precipMm >= 0.5) return 'drizzle';
  return cloud < 0.3 ? 'clear' : cloud < 0.65 ? 'partly' : 'cloudy';
}
export const COND_ICON: Record<Cond, string> = { clear: '☀️', partly: '⛅', cloudy: '☁️', drizzle: '🌦️', rain: '🌧️', heavy: '🌧️', snow: '❄️', storm: '⛈️' };
const COND_TXT: Record<Cond, [string, string]> = {
  clear: ['açık, güneşli', 'clear, sunny'], partly: ['parçalı bulutlu', 'partly cloudy'], cloudy: ['bulutlu', 'cloudy'], drizzle: ['hafif yağmurlu', 'light rain'],
  rain: ['yağmurlu', 'rainy'], heavy: ['kuvvetli yağış', 'heavy rain'], snow: ['karlı', 'snowy'], storm: ['sağanak yağışlı', 'heavy showers'],
};
export const condText = (c: Cond, lang: 'tr' | 'en' = 'tr') => COND_TXT[c][lang === 'en' ? 1 : 0];
export const windText = (ms: number, lang: 'tr' | 'en' = 'tr') => {
  const en = lang === 'en'; return ms < 3 ? (en ? 'calm wind' : 'rüzgâr hafif') : ms < 8 ? (en ? 'moderate wind' : 'rüzgâr orta') : ms < 14 ? (en ? 'strong wind' : 'rüzgâr kuvvetli') : (en ? 'stormy wind' : 'fırtına şiddetinde rüzgâr');
};
/** Anlık durum (tek adım). */
export function nowCond(s: Sample): Cond { return classify(s.precip * 24, s.snow * 24, s.conv * 24, s.cloud); }

/** Türkçe bulunma eki: Ankara'da, Sivas'ta, İzmir'de, Tokyo'da. */
export function locative(name: string): string {
  const base = name.split(',')[0].trim(), low = base.toLocaleLowerCase('tr-TR');
  const v = [...low].reverse().find((c) => 'aeıioöuü'.includes(c)) ?? 'a';
  const hard = 'çfhkpsşt'.includes(low[low.length - 1]);
  return `${base}'${hard ? 't' : 'd'}${'aıou'.includes(v) ? 'a' : 'e'}`;
}
/** Kullanıcının YEREL günü (YYYY-MM-DD): "Bugün" yerel takvime göre (gün özetleri UTC günüdür; Türkiye için ~3 saat kayma). */
export const localDate = (now = Date.now()) => new Date(now).toLocaleDateString('sv-SE');
const DAYS_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'], DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function dayName(date: string, todayIso: string, lang: 'tr' | 'en' = 'tr'): string {
  const en = lang === 'en', d = new Date(date + 'T12:00:00Z'), t = new Date(todayIso.slice(0, 10) + 'T12:00:00Z');
  const diff = Math.round((d.getTime() - t.getTime()) / 864e5);
  if (diff === 0) return en ? 'Today' : 'Bugün'; if (diff === 1) return en ? 'Tomorrow' : 'Yarın';
  return (en ? DAYS_EN : DAYS_TR)[d.getUTCDay()];
}
export function runLabel(meta: ForecastMeta, lang: 'tr' | 'en' = 'tr') {
  const d = new Date(meta.run);
  return d.toLocaleString(lang === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
}
export const sourceLine = (meta: ForecastMeta, lang: 'tr' | 'en' = 'tr') => (lang === 'en'
  ? `Source: NASA GEOS-FP, ${runLabel(meta, 'en')} run. Model forecast, not an official warning.`
  : `Kaynak: NASA GEOS-FP, ${runLabel(meta, 'tr')} çalıştırması. Model tahmini, resmi uyarı değildir.`);
export const staleLine = (meta: ForecastMeta, ageH: number, lang: 'tr' | 'en' = 'tr') => (ageH <= 24 ? '' : lang === 'en'
  ? `Note: this forecast is from ${runLabel(meta, 'en')}.` : `Dikkat: bu tahmin ${runLabel(meta, 'tr')} tarihlidir.`);

/** Kısa anlatım: şu an + 7 günlük özet + kaynak. */
export function spokenSummary(F: Forecast, name: string, p: LatLon, lang: 'tr' | 'en' = 'tr', now = Date.now()): string {
  const en = lang === 'en', s = F.sample(F.nowStep(now), p);
  if (Number.isNaN(s.t)) return en ? `No forecast data for ${name}.` : `${name} için tahmin verisi yok.`;
  const today = localDate(now), days = F.days(p).filter((d) => d.date >= today);
  const nowTxt = en ? `In ${name} now ${Math.round(s.t)} degrees, ${condText(nowCond(s), 'en')}, ${windText(s.wind, 'en')}.` : `${locative(name)} şu an ${Math.round(s.t)} derece, ${condText(nowCond(s))}, ${windText(s.wind)}.`;
  const rest = days.filter((d) => d.date > today).map((d) => `${dayName(d.date, today, lang)} ${Math.round(d.tMax)} ${en ? 'degrees' : 'derece'}, ${condText(d.cond, lang)}${d.thunderChance ? (en ? ', chance of thunderstorms' : ', gök gürültülü sağanak olasılığı') : ''}`);
  const n = days.length < 7 ? (en ? ` The forecast covers ${days.length} days from today.` : ` Tahmin bugünden itibaren ${days.length} günü kapsıyor.`) : '';
  return `${nowTxt} ${rest.join('; ')}.${n} ${sourceLine(F.meta, lang)} ${staleLine(F.meta, F.ageHours(now), lang)}`.trim();
}
/** "Daha fazla": gün gün ayrıntı. */
export function spokenDetail(F: Forecast, p: LatLon, lang: 'tr' | 'en' = 'tr', now = Date.now()): string {
  const en = lang === 'en', today = localDate(now);
  return F.days(p).filter((d) => d.date >= today).map((d) => en
    ? `${dayName(d.date, today, 'en')}: low ${Math.round(d.tMin)}, high ${Math.round(d.tMax)} degrees, ${condText(d.cond, 'en')}, about ${d.precipMm.toFixed(1)} mm precipitation${d.snowMm >= 0.5 ? `, of which ${d.snowMm.toFixed(1)} mm as snow` : ''}, wind ${Math.round(d.wind)} m/s, gusts up to ${Math.round(d.windMax)}${d.thunderChance ? ', chance of thunderstorms' : ''}.`
    : `${dayName(d.date, today)}: en düşük ${Math.round(d.tMin)}, en yüksek ${Math.round(d.tMax)} derece, ${condText(d.cond)}, yaklaşık ${d.precipMm.toFixed(1)} milimetre yağış${d.snowMm >= 0.5 ? `, bunun ${d.snowMm.toFixed(1)} milimetresi kar` : ''}, rüzgâr saniyede ${Math.round(d.wind)} metre, en çok ${Math.round(d.windMax)}${d.thunderChance ? ', gök gürültülü sağanak olasılığı' : ''}.`).join(' ') + ' ' + sourceLine(F.meta, lang);
}
/** Günün ses sahnesi parametreleri (ses dünyaları motoru): yağmur/kar/rüzgâr/sıcaklık/gök gürültüsü şiddetleri 0..1. */
export function weatherScene(d: { tMean: number; precipMm: number; snowMm: number; convMm: number; wind: number; thunderChance: boolean; cloud: number }) {
  const rainMm = Math.max(0, d.precipMm - d.snowMm);
  return {
    rain: Math.min(1, rainMm / 20),            // 0 kuru … 1 sağanak (≥ 20 mm/gün)
    snow: Math.min(1, d.snowMm / 8),
    wind: Math.min(1, d.wind / 15),
    thunder: d.thunderChance ? Math.min(1, d.convMm / 20) : 0,
    sunnyHot: d.cloud < 0.4 && rainMm < 0.5 ? Math.max(0, Math.min(1, (d.tMean - 18) / 14)) : 0,
    cold: Math.max(0, Math.min(1, (3 - d.tMean) / 15)),
    tMean: d.tMean,
  };
}
