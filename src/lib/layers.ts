// public/data dosyalarından radar katmanları. Tarih/kredi/birim bilgisi dosyanın kendisinden gelir.
import { Layer, type ColorScale, type GridMeta, type Quant } from './grid.ts';
import type { RadarLayer } from './radar.ts';

export interface SourceInfo { id: string; title: string; titleTr: string; credit: string; page: string; when: string; notes: string[] }

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
export function fmtUtc(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2, '0')}:00 UTC`;
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
  dateLabel(f: number) { return fmtUtc(this.file.frames.dates[f]) + (this.file.frames.forecastAtDownload[f] ? ' (tahmin)' : ''); }
  radarLayer(frame: number): RadarLayer {
    return {
      id: 'temp', label: 'Yüzey sıcaklığı', instrument: 'yumuşak telli ses', unit: '°C',
      min: this.cs.min, max: this.cs.max, baseHz: 130.81, when: this.dateLabel(frame),
      sample: (p) => this.layer.sample(frame, p),
      fmt: (v) => `${Math.round(v)} derece`,
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
  monthLabel(m: number) { return `${monthName(m)} 2021 (ayın 1. günü)`; }
  radarLayer(month: number): RadarLayer {
    return {
      id: 'co2', label: 'Karbondioksit (CO₂)', instrument: 'nefes gibi yumuşak ses', unit: 'ppm',
      min: this.range.min, max: this.range.max, baseHz: 196, when: this.monthLabel(month),
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
