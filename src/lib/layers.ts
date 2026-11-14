// public/data dosyalarından radar katmanları. Tarih/kredi/birim bilgisi dosyanın kendisinden gelir.
import type { LatLon } from './geo.ts';
import { Layer, type ColorScale, type GridMeta, type Quant } from './grid.ts';
import type { RadarLayer } from './radar.ts';

export interface SourceInfo { id: string; title: string; titleTr: string; credit: string; page: string; when: string; notes: string[] }

type Lang = 'tr' | 'en';
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtUtc(iso: string, lang: Lang = 'tr'): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${(lang === 'en' ? MONTHS_EN : MONTHS)[d.getUTCMonth()]} ${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2, '0')}:00 UTC`;
}

// ---------- Yüzey sıcaklığı (SVS 5147, GEOS-FP T2M)
interface TempFile {
  id: string; title: string; titleTr: string; credit: string; grid: GridMeta; data: string; quant: Quant;
  frames: { count: number; dates: string[]; forecastAtDownload: boolean[] };
  source: { page: string; downloadedAt: string }; notes: string[];
}
export class TemperatureSource {
  readonly layer: Layer;
  readonly file: TempFile;
  readonly cs: ColorScale;
  constructor(file: TempFile, cs: ColorScale) { this.file = file; this.cs = cs; this.layer = new Layer(file.grid, file.data, file.quant); }
  get frames() { return this.file.frames.count; }
  dateLabel(f: number, lang: Lang = 'tr') { return fmtUtc(this.file.frames.dates[f], lang) + (this.file.frames.forecastAtDownload[f] ? (lang === 'en' ? ' (forecast)' : ' (tahmin)') : ''); }
  radarLayer(frame: number, lang: Lang = 'tr'): RadarLayer {
    const en = lang === 'en';
    return {
      id: 'temp', label: en ? 'Surface temperature' : 'Yüzey sıcaklığı', instrument: en ? 'guitar' : 'gitar', unit: '°C',
      min: this.cs.min, max: this.cs.max, baseHz: 130.81, when: this.dateLabel(frame, lang),
      sample: (p) => this.layer.sample(frame, p),
      fmt: (v) => `${Math.round(v)} ${en ? 'degrees' : 'derece'}`,
    };
  }
  info(): SourceInfo {
    return { id: '5147', title: this.file.title, titleTr: this.file.titleTr, credit: this.file.credit, page: this.file.source.page,
      when: `${fmtUtc(this.file.frames.dates[0])} – ${this.dateLabel(this.frames - 1)}, saatlik`, notes: this.file.notes };
  }
}

// ---------- CO₂ (OCO-2 GEOS L3, 2021; ekip paketi) — radarın İLK katmanı
import { Co2Grid, Co2Stations, monthName, type Co2GridFile, type Co2StationsFile } from './co2.ts';

/** CO₂ için kendi sıralı paletimiz (NASA renk skalası yok; ekranda ppm lejantı gösterilir). Açık sarı → turuncu → koyu mor. */
const CO2_STOPS: [number, number, number][] = [[255, 247, 188], [254, 196, 79], [236, 112, 20], [180, 40, 90], [84, 20, 110]];
export function co2Color(t: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, t)) * (CO2_STOPS.length - 1), i = Math.min(CO2_STOPS.length - 2, Math.floor(x)), f = x - i;
  const a = CO2_STOPS[i], b = CO2_STOPS[i + 1];
  return [0, 1, 2].map((c) => Math.round(a[c] + (b[c] - a[c]) * f)) as [number, number, number];
}

export class Co2Source {
  readonly grid: Co2Grid;
  readonly stations: Co2Stations;
  readonly range: { min: number; max: number };
  constructor(g: Co2GridFile, s: Co2StationsFile) { this.grid = new Co2Grid(g); this.stations = new Co2Stations(s); this.range = this.grid.yearRange(); }
  get months() { return this.grid.months.length; }
  monthLabel(m: number, lang: Lang = 'tr') { return `${monthName(m, lang)} 2021 ${lang === 'en' ? '(1st of the month)' : '(ayın 1. günü)'}`; }
  radarLayer(month: number, lang: Lang = 'tr'): RadarLayer {
    const en = lang === 'en';
    return {
      id: 'co2', label: en ? 'Carbon dioxide' : 'Karbondioksit', instrument: en ? 'violin' : 'keman', unit: 'ppm',
      min: this.range.min, max: this.range.max, baseHz: 196, when: this.monthLabel(month, lang),
      sample: (p) => this.grid.bilinear(p, month),
      fmt: (v) => `${v.toFixed(1)} ppm`,
    };
  }
  /** Görsel renk: o ayın küresel aralığına göre (gözle fark görünsün). Ses (bilim) sabit yıllık aralığı kullanır. */
  color(v: number, month: number) { const r = this.grid.monthRange(month); return co2Color((v - r.min) / (r.max - r.min)); }
  info(): SourceInfo {
    return { id: 'co2_2021', title: 'OCO-2 GEOS Level 3 Daily CO₂ (OCO2_GEOS_L3CO2_DAY)', titleTr: 'Atmosferik CO₂, 2021', credit: this.grid.f.credit,
      page: '', when: '2021; aylık katmanlar ayın 1. günü, istasyonlar günlük', notes: this.grid.f.notes };
  }
}
export async function loadCo2(base: string) {
  const [g, s] = await Promise.all([json<Co2GridFile>(base, 'co2_2021_grid.json'), json<Co2StationsFile>(base, 'co2_2021_stations.json')]);
  return new Co2Source(g, s);
}

async function json<T>(base: string, name: string): Promise<T> {
  const r = await fetch(`${base}data/${name}`);
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  return r.json() as Promise<T>;
}
export async function loadTemperature(base: string) {
  const [f, cs] = await Promise.all([json<TempFile>(base, '5147.json'), json<ColorScale>(base, '5147_colorscale.json')]);
  return new TemperatureSource(f, cs);
}
export { json as loadJson };

// ---------- Deniz yüzeyi sıcaklığı + akıntılar (SVS 3912, ECCO2 model 2007–2008)
// Görsel: public/media/sst_3912_1024.mp4 (küreye video dokusu). Ses: 3912.json ızgarası, video zamanına göre (1 kare/sn).
interface SstFile {
  title: string; titleTr: string; credit: string; grid: GridMeta; data: string; quant: Quant;
  frames: { count: number; fps: number; t: number[]; dateRange: string[] }; notes: string[];
}
export class SstSource {
  readonly layer: Layer;
  readonly file: SstFile;
  readonly cs: ColorScale;
  constructor(file: SstFile, cs: ColorScale) { this.file = file; this.cs = cs; this.layer = new Layer(file.grid, file.data, file.quant); }
  get frames() { return this.file.frames.count; }
  /** Karenin yaklaşık tarihi (model yılı aralığına eşit yayılmış; kare başına kesin tarih yok). */
  dateLabel(frame: number, lang: Lang = 'tr') {
    const [a, b] = this.file.frames.dateRange.map((d) => new Date(d).getTime());
    const d = new Date(a + ((b - a) * frame) / Math.max(1, this.frames - 1));
    return `≈ ${(lang === 'en' ? MONTHS_EN : MONTHS)[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  /** Video zamanı (sn) → ızgara karesi. */
  frameAt(videoSec: number) { return Math.max(0, Math.min(this.frames - 1, Math.floor(videoSec * this.file.frames.fps))); }
  radarLayer(frame: number, lang: Lang = 'tr'): RadarLayer {
    const en = lang === 'en';
    return {
      id: 'sst', label: en ? 'Ocean temperature' : 'Okyanus sıcaklığı', instrument: en ? 'harp and wave sound' : 'arp ve dalga sesi', unit: '°C',
      min: this.cs.min, max: this.cs.max, baseHz: 220, when: `model, ${this.dateLabel(frame, lang)}`,
      sample: (p) => this.layer.sample(frame, p),
      fmt: (v) => `${Math.round(v)} ${en ? 'degrees sea' : 'derece deniz'}`,
    };
  }
}
export async function loadSst(base: string) {
  const [f, cs] = await Promise.all([json<SstFile>(base, '3912.json'), json<ColorScale>(base, '3912_colorscale.json')]);
  return new SstSource(f, cs);
}

// ---------- Aerosoller (SVS 5669, GEOS, 19 Ağu 2025 20:00 UTC) — 4 tür = 4 enstrüman
interface AerosolFile {
  title: string; credit: string; grid: GridMeta; date: string;
  categories: { index: number; id: string; label: string; rgb: [number, number, number] }[];
  layers: Record<string, { data: string; quant: Quant }>;
}
const AEROSOL_META: Record<string, { label: { tr: string; en: string }; instrument: { tr: string; en: string }; baseHz: number }> = {
  black_carbon: { label: { tr: 'Kara karbon (is, duman)', en: 'Black carbon (soot, smoke)' }, instrument: { tr: 'çello', en: 'cello' }, baseHz: 98 },
  dust: { label: { tr: 'Toz', en: 'Dust' }, instrument: { tr: 'çelesta (çan)', en: 'celesta (bells)' }, baseHz: 523 },
  sea_salt: { label: { tr: 'Deniz tuzu', en: 'Sea salt' }, instrument: { tr: 'flüt', en: 'flute' }, baseHz: 175 },
  sulfate: { label: { tr: 'Sülfat', en: 'Sulfate' }, instrument: { tr: 'marimba', en: 'marimba' }, baseHz: 330 },
};
export class AerosolSource {
  readonly file: AerosolFile;
  readonly layers: Record<string, Layer>;
  constructor(file: AerosolFile) {
    this.file = file;
    this.layers = Object.fromEntries(Object.entries(file.layers).map(([k, L]) => [k, new Layer(file.grid, L.data, L.quant)]));
  }
  /** Dört tür ayrı radar katmanı. Değer GÖRELİ yoğunluk (0..1, renk skalasında miktar yok); şiddet ölçeği 0..0.6. */
  radarLayers(lang: Lang = 'tr'): RadarLayer[] {
    const en = lang === 'en';
    return Object.keys(this.layers).map((id) => {
      const m = AEROSOL_META[id];
      return {
        id: id as RadarLayer['id'], label: m.label[lang], instrument: m.instrument[lang], unit: null, min: 0, max: 0.6, baseHz: m.baseHz,
        when: en ? '19 Aug 2025 20:00 UTC' : '19 Ağu 2025 20:00 UTC', sample: (p) => this.layers[id].sample(0, p),
        fmt: (v) => (v < 0.05 ? (en ? 'almost none' : 'yok denecek kadar az') : `${en ? 'relative density' : 'göreli yoğunluk'} ${Math.round(v * 100)}`),
      };
    });
  }
}
export async function loadAerosols(base: string) { return new AerosolSource(await json<AerosolFile>(base, '5669.json')); }

// ---------- Bitki örtüsü NDVI (SVS 5544, EIC galerisi; yakın gerçek zamanlı) — değer GÖRELİ (renk skalasında sayı yok)
interface GridFramesFile { title: string; titleTr: string; credit: string; grid: GridMeta; data: string; quant: Quant; frames: { count: number; dateRange?: string[]; datesNote?: string } }
export class NdviSource {
  readonly layer: Layer; readonly file: GridFramesFile; readonly cs: ColorScale;
  constructor(file: GridFramesFile, cs: ColorScale) { this.file = file; this.cs = cs; this.layer = new Layer(file.grid, file.data, file.quant); }
  get frames() { return this.file.frames.count; }
  dateLabel(f: number, lang: Lang = 'tr') { return lang === 'en' ? `frame ${f + 1}/${this.frames} (last ~2.5 years; exact date unknown)` : `kare ${f + 1}/${this.frames} (son ~2,5 yıl; kesin tarih bilinmiyor)`; }
  radarLayer(frame: number, lang: Lang = 'tr'): RadarLayer {
    const en = lang === 'en';
    return { id: 'ndvi', label: en ? 'Vegetation (NDVI)' : 'Bitki örtüsü (NDVI)', instrument: en ? 'marimba' : 'marimba', unit: null, min: 0, max: 1, baseHz: 196,
      when: this.dateLabel(frame, lang), sample: (p) => this.layer.sample(frame, p),
      fmt: (v) => `${en ? 'relative vegetation' : 'göreli bitki örtüsü'} ${Math.round(v * 100)}` };
  }
}
export async function loadNdvi(base: string) {
  const [f, cs] = await Promise.all([json<GridFramesFile>(base, '5544.json'), json<ColorScale>(base, '5544_colorscale.json')]);
  return new NdviSource(f, cs);
}

// ---------- Gece ışıkları (SVS 5313, Black Marble 2012–2023) — yıllık ortalama parlaklık, GÖRELİ (renk skalası yok)
interface LightsFile { title: string; titleTr: string; credit: string; grid: GridMeta; layers: { years: { list: number[]; data: string; quant: Quant } } }
export class LightsSource {
  readonly layer: Layer; readonly file: LightsFile; readonly max: number;
  constructor(file: LightsFile) { this.file = file; this.layer = new Layer(file.grid, file.layers.years.data, file.layers.years.quant); this.max = file.layers.years.quant.max ?? 152; }
  get years() { return this.file.layers.years.list; }
  radarLayer(yi: number, lang: Lang = 'tr'): RadarLayer {
    const en = lang === 'en', mx = this.max;
    return { id: 'lights', label: en ? 'Night lights' : 'Gece ışıkları', instrument: en ? 'celesta' : 'çelesta', unit: null, min: 0, max: mx, baseHz: 523,
      when: `${this.years[yi]} · Black Marble`, sample: (p) => this.layer.sample(yi, p),
      fmt: (v) => (v < mx * 0.02 ? (en ? 'dark' : 'karanlık') : `${en ? 'relative brightness' : 'göreli parlaklık'} ${Math.round((v / mx) * 100)}`) };
  }
}
export async function loadLights(base: string) { return new LightsSource(await json<LightsFile>(base, '5313.json')); }

// ---------- Yıldırım (SVS 5011, ISS LIS 2017–2023) — olaylar 1° hücrelere toplanır; radar ışını yıldırımlı hücreden geçince VURMALI ses
interface LightningFile { title: string; titleTr: string; credit: string; grid: GridMeta; events: { count: number; list: [number, number, number, number][] }; time: { dateRange: string[] } }
export class LightningSource {
  readonly file: LightningFile; readonly grid: Float32Array; readonly max: number;
  constructor(file: LightningFile) {
    this.file = file; const { w, h } = file.grid; this.grid = new Float32Array(w * h);
    for (const [, lat, lon, s] of file.events.list) { const i = Math.min(w - 1, Math.floor(lon + 180)), j = Math.min(h - 1, Math.floor(90 - lat)); this.grid[j * w + i] += s; }
    let mx = 0; for (const v of this.grid) if (v > mx) mx = v; this.max = mx;
  }
  /** Hücredeki toplam etkinlik (göreli, log ölçek 0..1). Olay yoksa 0 → ses yok (gate). */
  value(p: LatLon): number { const { w, h } = this.file.grid; const i = Math.min(w - 1, Math.max(0, Math.floor(p.lon + 180))), j = Math.min(h - 1, Math.max(0, Math.floor(90 - p.lat))); const v = this.grid[j * w + i]; return v > 0 ? Math.log1p(v) / Math.log1p(this.max) : 0; }
  radarLayer(lang: Lang = 'tr'): RadarLayer {
    const en = lang === 'en';
    return { id: 'lightning', label: en ? 'Lightning' : 'Yıldırım', instrument: en ? 'percussion (strikes)' : 'vurmalı (çakma)', unit: null, min: 0, max: 1, baseHz: 80,
      when: `${this.file.time.dateRange.join(' – ')} · ISS LIS`, sample: (p) => this.value(p),
      fmt: (v) => (v <= 0 ? (en ? 'no lightning' : 'yıldırım yok') : `${en ? 'relative lightning activity' : 'göreli yıldırım etkinliği'} ${Math.round(v * 100)}`) };
  }
}
export async function loadLightning(base: string) { return new LightningSource(await json<LightningFile>(base, '5011.json')); }

// ---------- Küre görüntüleri (SVS 4950 GEDI, 5196 DYAMOND): EKRAN ızgarası, coğrafi konum YOK → radar değil, "görüntüyü dinle" taraması
export interface ScreenGridFile { id: string; title: string; titleTr: string; credit: string; unit: string | null; screen: { w: number; h: number }; frames: { count: number }; data: string; quant: Quant; limits: string[] }
export class ScreenGrid {
  readonly file: ScreenGridFile; readonly bytes: Uint8Array; readonly cs: ColorScale;
  constructor(file: ScreenGridFile, cs: ColorScale) { this.file = file; this.cs = cs; const b = atob(file.data); this.bytes = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) this.bytes[i] = b.charCodeAt(i); }
  get w() { return this.file.screen.w; } get h() { return this.file.screen.h; } get frames() { return this.file.frames.count; }
  /** Ekran pikseli (x, y) değeri; veri yoksa NaN. */
  at(f: number, x: number, y: number): number { const q = this.bytes[f * this.w * this.h + y * this.w + x]; return q === 255 ? NaN : (this.file.quant.offset ?? 0) + q * (this.file.quant.scale ?? 1); }
}
export async function loadScreenGrid(base: string, id: '4950' | '5196') {
  const [f, cs0] = await Promise.all([json<ScreenGridFile>(base, `${id}.json`), json<ColorScale & { variants?: Record<string, { min: number; max: number }>; default?: string }>(base, `${id}_colorscale.json`)]);
  // 4950: aralık varsayılan varyantta (0–50 m); üst düzeyde min/max yok
  const v = cs0.variants && cs0.default ? cs0.variants[cs0.default] : null;
  const cs: ColorScale = { ...cs0, min: cs0.min ?? v?.min ?? 0, max: cs0.max ?? v?.max ?? 1 };
  return new ScreenGrid(f, cs);
}
