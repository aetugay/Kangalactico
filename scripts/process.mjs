// Aşama 4 — İşlem hattı (tekrar çalıştırılabilir). Kullanım:
//   node scripts/process.mjs            → hepsi
//   node scripts/process.mjs 3912 5147  → seçilenler (ayrıca: cities)
// Girdi: raw/<id>/ (scripts/download.mjs), public/data/<id>_colorscale.json (scripts/colorscales.mjs),
//        data/calibration.json (scripts/calibrate.mjs).
// Çıktı: public/data/<id>.json — kompakt: değerler 8-bit nicemlenmiş, base64 (255 = veri yok).
//   Çözme: v = offset + q * scale  (q < 255). Hücre (i,j): lon = lonL + (i+0.5)·360/W, lat = latT − (j+0.5)·180/H.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readFrame, readFrames, probe } from './lib/raster.mjs';
import { pixelToLonLat, lonLatToPixel, FULL, haversineKm } from './lib/geo.mjs';

const OUT = 'public/data';
const GW = 360, GH = 180; // 1° ızgara
const FPS = 2;
const CAL = JSON.parse(fs.readFileSync('data/calibration.json', 'utf8'));
const LOG = JSON.parse(fs.readFileSync('raw/download_log.json', 'utf8'));
const cs = (id) => JSON.parse(fs.readFileSync(`${OUT}/${id}_colorscale.json`, 'utf8'));
const downloadedAt = (file) => LOG.filter((l) => l.file.replace(/\\/g, '/').endsWith(path.basename(file))).map((l) => l.at).pop() || null;

const CREDIT = {
  3912: "NASA's Scientific Visualization Studio. Visualizations by Greg Shirah (NASA/GSFC). Scientists: Hong Zhang, Dimitris Menemenlis (ECCO2)",
  5147: "NASA's Scientific Visualization Studio / NASA GMAO (GEOS-FP)",
  5544: "NASA's Scientific Visualization Studio",
  5011: "NASA's Scientific Visualization Studio. Visualizations by Michala Garrison (SSAI)",
  5313: "NASA's Scientific Visualization Studio. Visualizations by Kel Elkins (USRA). Black Marble",
  5669: "NASA's Scientific Visualization Studio. Visualizations by Joseph V. Ardizzone (NASA/GSFC), Helen-Nicole Kostis (STC). Scientific consulting by Lesley Ott (NASA/GSFC)",
  4950: "NASA's Scientific Visualization Studio. Visualizations by Kel Elkins (USRA)",
  5196: "NASA's Scientific Visualization Studio. Visualizations by AJ Christensen (SSAI). Scientific consulting by Lesley Ott (NASA/GSFC)",
};
// 5147 ve 5544 kredi satırları API main_credits'ten alınıp yazılır (aşağıda svsCredit).
function svsCredit(id) {
  try {
    const j = JSON.parse(fs.readFileSync(`data/svs_api/${id}.json`, 'utf8'));
    const parts = Object.entries(j.main_credits || {}).map(([k, v]) => `${k} ${v.map((p) => `${p.name} (${p.employer})`).join(', ')}`);
    return ["NASA's Scientific Visualization Studio", ...parts].join('. ');
  } catch { return CREDIT[id]; }
}

// ---------- yardımcılar
function makeLUT(steps, distFn, maxDist) {
  // 6-bit nicemlenmiş RGB → en yakın adım indeksi (yoksa -1). 262144 giriş.
  const lut = new Int16Array(1 << 18);
  for (let r = 0; r < 64; r++) for (let g = 0; g < 64; g++) for (let b = 0; b < 64; b++) {
    const c = [r * 4 + 2, g * 4 + 2, b * 4 + 2];
    let best = -1, bd = maxDist;
    for (let k = 0; k < steps.length; k++) { const d = distFn(c, steps[k].rgb); if (d < bd) { bd = d; best = k; } }
    lut[(r << 12) | (g << 6) | b] = best;
  }
  return lut;
}
const rgbDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Kroma (yön) uzaklığı: parlaklıktan bağımsız; çizgileri siyah üstüne solarak çizilmiş görseller için (3912). */
const chromaDist = (a, b) => {
  const na = Math.hypot(...a) || 1, nb = Math.hypot(...b) || 1;
  const cos = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (na * nb);
  return Math.acos(Math.min(1, cos)) * 180 / Math.PI; // derece
};
/** Piksel → hücre indeksi tablosu (bölge + sınırlar; maske dışı = -1). */
function cellMap(w, h, region, bounds, excludeRects = []) {
  const m = new Int32Array(w * h).fill(-1);
  const W = region.x1 - region.x0;
  for (let y = 0; y < h; y++) for (let x = region.x0; x < region.x1; x++) {
    if (excludeRects.some((r) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1)) continue;
    const { lon, lat } = pixelToLonLat(x - region.x0, y, W, h, bounds);
    let L = ((lon + 180) % 360 + 360) % 360 - 180;
    const i = Math.min(GW - 1, Math.floor((L + 180) / 360 * GW)), j = Math.min(GH - 1, Math.max(0, Math.floor((90 - lat) / 180 * GH)));
    m[y * w + x] = j * GW + i;
  }
  return m;
}
function quantize(vals, vmin, vmax) {
  const q = new Uint8Array(vals.length);
  const sc = (vmax - vmin) / 254;
  for (let i = 0; i < vals.length; i++) q[i] = Number.isNaN(vals[i]) ? 255 : Math.max(0, Math.min(254, Math.round((vals[i] - vmin) / sc)));
  return { q, scale: sc, offset: vmin };
}
const b64 = (u8) => Buffer.from(u8.buffer, u8.byteOffset, u8.length).toString('base64');
function writeJSON(id, obj) {
  const f = `${OUT}/${id}.json`;
  fs.writeFileSync(f, JSON.stringify(obj));
  const kb = fs.statSync(f).size / 1024;
  console.log(`  → ${f} ${kb > 1024 ? (kb / 1024).toFixed(2) + ' MB' : kb.toFixed(0) + ' KB'}`);
}
const GRID = { w: GW, h: GH, lonL: -180, lonR: 180, latT: 90, latB: -90, cellDeg: 1, order: 'satır-öncelikli, kuzeyden güneye, batıdan doğuya' };

/** Standart video → ızgara işlemi: her pikseli değere çevir, hücrede ortala. */
async function gridVideo({ file, region, bounds, exclude = [], pixelValue, minCount = 1, fps = FPS, keep = () => true }) {
  const info = probe(file);
  const cmap = cellMap(info.w, info.h, region, bounds, exclude);
  const frames = [], times = [], srcFrames = [];
  let k = 0;
  await readFrames(file, { fps, size: [info.w, info.h] }, (img) => {
    const t = k / fps, src = Math.round(t * info.fps); k++;
    if (!keep(src)) return;
    const sum = new Float64Array(GW * GH), cnt = new Uint32Array(GW * GH);
    const d = img.data;
    for (let p = 0, n = info.w * info.h; p < n; p++) {
      const c = cmap[p]; if (c < 0) continue;
      const v = pixelValue(d[3 * p], d[3 * p + 1], d[3 * p + 2]);
      if (v === null) continue;
      sum[c] += v; cnt[c]++;
    }
    const vals = new Float32Array(GW * GH);
    for (let c = 0; c < vals.length; c++) vals[c] = cnt[c] >= minCount ? sum[c] / cnt[c] : NaN;
    frames.push(vals); times.push(+t.toFixed(3)); srcFrames.push(src);
  });
  return { info, frames, times, srcFrames };
}
function packFrames(frames, vmin, vmax) {
  const all = new Uint8Array(frames.length * GW * GH);
  let sc = 0, off = 0, valid = 0;
  frames.forEach((f, i) => { const { q, scale, offset } = quantize(f, vmin, vmax); all.set(q, i * GW * GH); sc = scale; off = offset; for (const v of q) if (v !== 255) valid++; });
  return { data: b64(all), quant: { bits: 8, nodata: 255, scale: +sc.toPrecision(6), offset: vmin }, validFraction: +(valid / all.length).toFixed(4) };
}
/** Karekök kodlama (çoğu değeri karanlık olan parlaklık katmanları için): q = round(√(v/max)·254). */
function packSqrt(frames, vmax) {
  const all = new Uint8Array(frames.length * GW * GH);
  let valid = 0;
  frames.forEach((f, i) => { for (let c = 0; c < f.length; c++) { const v = f[c]; const q = Number.isNaN(v) ? 255 : Math.max(0, Math.min(254, Math.round(Math.sqrt(Math.max(0, v) / vmax) * 254))); all[i * GW * GH + c] = q; if (q !== 255) valid++; } });
  return { data: b64(all), quant: { bits: 8, nodata: 255, encoding: 'sqrt', max: vmax }, validFraction: +(valid / all.length).toFixed(4) };
}
function rangeOf(frames) { let lo = Infinity, hi = -Infinity; for (const f of frames) for (const v of f) if (!Number.isNaN(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } return [lo, hi]; }
const cellOf = (lat, lon) => Math.min(GH - 1, Math.floor((90 - lat) / 180 * GH)) * GW + Math.min(GW - 1, Math.floor((lon + 180) / 360 * GW));

// ---------- veri setleri
const JOBS = {};

// 3912 — ECCO2 SST (çizgiler siyah üstüne, soluk izler) → kroma eşleme
JOBS[3912] = async () => {
  const C = cs(3912);
  const lut = makeLUT(C.steps, chromaDist, 12); // ≤12° renk açısı
  const file = 'raw/3912/ecco2_sst_flow.mp4';
  const r = await gridVideo({ file, region: { x0: 0, x1: 2048 }, bounds: FULL, minCount: 2, fps: 1, // boyut için 1 kare/sn (kullanıcı isteği)
    pixelValue: (R, G, B) => { const mx = Math.max(R, G, B); if (mx < 70 || mx - Math.min(R, G, B) < 40) return null; const k = lut[((R >> 2) << 12) | ((G >> 2) << 6) | (B >> 2)]; return k < 0 ? null : C.steps[k].v; } });
  const [lo, hi] = rangeOf(r.frames);
  writeJSON(3912, { id: '3912', title: 'Global Sea Surface Currents and Temperature', titleTr: 'Küresel deniz yüzeyi akıntıları ve sıcaklığı (ECCO2)', kind: 'grid',
    projection: 'equirectangular', grid: GRID, unit: '°C', quantity: 'deniz yüzeyi sıcaklığı (model)',
    frames: { count: r.frames.length, fps: 1, t: r.times, sourceFrame: r.srcFrames, sourceFps: r.info.fps, dateRange: ['2007-03-25T12:00Z', '2008-03-03T12:00Z'],
      dates: null, datesNote: 'Kare başına tarih API\'de yok (yalnız aralık). Eşit aralık varsayılmadı.' },
    valueRange: [+lo.toFixed(2), +hi.toFixed(2)], scaleRange: [C.min, C.max], ...packFrames(r.frames, C.min, C.max),
    calibration: { bounds: FULL, maxErrPx: 1, maxErrKm: 19.4, ref: 'data/calibration.json#3912' },
    method: 'Her piksel: akış çizgisi rengi (parlaklık≥70, doygunluk≥40) → renk skalasına KROMA (renk açısı ≤12°) ile eşlenir (çizgi izleri siyaha doğru solduğu için parlaklıktan bağımsız). Hücre = ≥2 geçerli pikselin ortalaması. Kara (gri) ve çizgi arası (siyah) = veri yok.',
    source: { page: 'https://svs.gsfc.nasa.gov/3912/', file: 'https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/ecco2_sst_flow.mp4', colorscale: '3912_colorscale.json', downloadedAt: downloadedAt(file) },
    credit: CREDIT[3912], notes: ['ECCO2 model çıktısı (gözlem değil).', 'Deniz değeri yalnızca akış çizgilerinin geçtiği hücrelerde var; seyrek.'] });
};

// 5147 — GEOS-FP T2M, saatlik; logo + tarih kutusu maskelenir
JOBS[5147] = async () => {
  const C = cs(5147);
  const lut = makeLUT(C.steps, rgbDist, 30);
  const file = 'raw/5147/MC01_stage3_GMAO_near_surface_temperature_2048x1024_en.mp4';
  const exclude = [{ x0: 0, x1: 352, y0: 0, y1: 76 }, { x0: 0, x1: 502, y0: 938, y1: 1024 }]; // NASA/GMAO logosu, tarih kutusu
  const r = await gridVideo({ file, region: { x0: 0, x1: 2048 }, bounds: FULL, exclude,
    pixelValue: (R, G, B) => { const k = lut[((R >> 2) << 12) | ((G >> 2) << 6) | (B >> 2)]; return k < 0 ? null : C.steps[k].v; } });
  const t0 = Date.UTC(2026, 9, 30, 9, 0, 0); // kare 0 = 30 Eki 2026 05:00 EDT = 09:00 UTC (karelerden okundu), saatlik
  const dl = downloadedAt(file);
  const dates = r.srcFrames.map((n) => new Date(t0 + n * 3600e3).toISOString().replace(':00.000Z', 'Z'));
  const forecast = r.srcFrames.map((n) => t0 + n * 3600e3 > Date.parse(dl));
  const [lo, hi] = rangeOf(r.frames);
  writeJSON(5147, { id: '5147', title: 'GEOS-FP Near-Surface Temperature', titleTr: 'Yüzeye yakın hava sıcaklığı (GEOS-FP, 2 m)', kind: 'grid',
    projection: 'equirectangular', grid: GRID, unit: '°C', quantity: 'yüzeye yakın hava sıcaklığı T2M',
    frames: { count: r.frames.length, fps: FPS, t: r.times, sourceFrame: r.srcFrames, sourceFps: r.info.fps, dates, forecastAtDownload: forecast,
      datesNote: 'Tarihler kare üstündeki etiketten okundu (kare 0, 1, 2, 24, 100, 200, 300, 340, 355, 364–371 doğrulandı): saatlik. forecastAtDownload=true → indirme anında gelecek, yani kesin TAHMİN; daha önceki karelerin analiz/tahmin ayrımı bilinmiyor.' },
    valueRange: [+lo.toFixed(2), +hi.toFixed(2)], scaleRange: [C.min, C.max], ...packFrames(r.frames, C.min, C.max),
    calibration: { bounds: FULL, maxErrPx: 1, method: 'görsel (Samsun/Tokyo/NY); Lagos, Sidney ölçülemedi', ref: 'data/calibration.json#extra.5147' },
    method: 'Her piksel en yakın renk skalası adımına (RGB uzaklık ≤30) eşlenir; hücre = ortalama. Logo (sol üst) ve tarih kutusu (sol alt) maskelendi → o hücrelerin bir kısmı boş.',
    source: { page: 'https://svs.gsfc.nasa.gov/5147/', file: 'https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005147/MC01_stage3_GMAO_near_surface_temperature_2048x1024_en.mp4', colorscale: '5147_colorscale.json', downloadedAt: dl },
    credit: svsCredit(5147), notes: C.notes });
};

// 5544 — NDVI göreli; okyanus mavisi + kar/buz (r≥250) = veri yok
JOBS[5544] = async () => {
  const C = cs(5544);
  const lut = makeLUT(C.steps, rgbDist, 45);
  const file = 'raw/5544/nrt_ndvi_equi_2048p30.mp4';
  const r = await gridVideo({ file, region: { x0: 0, x1: 4096 }, bounds: FULL,
    pixelValue: (R, G, B) => { if (B > R + 40 && B > G + 10) return null; if (R >= 250) return null; const k = lut[((R >> 2) << 12) | ((G >> 2) << 6) | (B >> 2)]; return k < 0 ? null : C.steps[k].v; } });
  const [lo, hi] = rangeOf(r.frames);
  writeJSON(5544, { id: '5544', title: 'Near Real-Time NDVI', titleTr: 'Bitki örtüsü (NDVI, yakın gerçek zamanlı)', kind: 'grid',
    projection: 'equirectangular', grid: GRID, unit: null, quantity: 'NDVI — GÖRELİ 0 (Low) … 1 (High)',
    frames: { count: r.frames.length, fps: FPS, t: r.times, sourceFrame: r.srcFrames, sourceFps: r.info.fps, dateRange: ['indirmeden önceki ~2.5 yıl (API)', downloadedAt(file)], dates: null,
      datesNote: 'Tarih damgasız sürüm indirildi; kare başına tarih bilinmiyor. Tarihli sürüm (nrt_ndvi_equi_w_dates_2048p30.mp4, 58.8 MB) indirilirse okunabilir.' },
    valueRange: [+lo.toFixed(3), +hi.toFixed(3)], scaleRange: [0, 1], ...packFrames(r.frames, 0, 1),
    calibration: { bounds: FULL, maxErrPx: 1, note: 'kalibrasyon referansı', ref: 'data/calibration.json#5544-oz' },
    method: 'Okyanus (mavi) ve kar/buz (R≥250, skalada yok) maskelendi; kalan piksel en yakın skala adımına (RGB ≤45). Hücre = ortalama.',
    source: { page: 'https://svs.gsfc.nasa.gov/5544/', file: 'https://svs.gsfc.nasa.gov/vis/a000000/a005500/a005544/nrt_ndvi_equi_2048p30.mp4', colorscale: '5544_colorscale.json', downloadedAt: downloadedAt(file) },
    credit: svsCredit(5544), notes: C.notes });
};

// 5313 — gece ışıkları: yıllık seri (parlaklık) + değişim haritası (göreli −1..+1). Sol kopya kullanılır.
JOBS[5313] = async () => {
  const file = 'raw/5313/nightlights_flat_series_and_change_wZooms_13_EIC_2160p30_h265.mp4';
  const L = CAL.recommendedBounds['5313'].left;
  const region = { x0: L.x0, x1: L.x1 }, bounds = { lonL: L.lonL, lonR: L.lonR, latT: L.latT, latB: L.latB };
  // Kare → bölüm (yıl etiketi geçişleri ölçüldü: 15,33,51,69,86,104,122,139,157,175,193)
  const cuts = [0, 15, 33, 51, 69, 86, 104, 122, 139, 157, 175, 193, 284];
  const yearOf = (n) => { for (let k = 0; k < 12; k++) if (n >= cuts[k] && n < cuts[k + 1]) return 2012 + k; return null; };
  const phase = (n) => (n < 284 ? 'year' : n < 300 ? 'fade' : n <= 630 ? 'change' : 'zoom');
  const exclude = [{ x0: 3700, x1: 3840, y0: 1150, y1: 1300 }]; // gömülü skala çubuğunun sol kopyaya taşan kısmı
  // yıl kareleri: parlaklık (ortalama luma), değişim kareleri: göreli değişim
  const C = cs(5313);
  const norm = C.steps.map((s) => { const m = Math.max(...s.rgb); return { v: s.v, rgb: s.rgb.map((c) => (c / m) * 255) }; });
  const lutC = makeLUT(norm, rgbDist, 40);
  const luma = (R, G, B) => 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const info = probe(file);
  const cmap = cellMap(info.w, info.h, region, bounds, exclude);
  const change = [], series = [];
  const out = { frames: [], times: [], src: [], phase: [], year: [] };
  let k = 0;
  // Sivas pikseli (sol kopya) — örnek seri için
  const sv = lonLatToPixel(37.0179, 39.7477, region.x1 - region.x0, info.h, bounds);
  await readFrames(file, { fps: FPS, size: [info.w, info.h] }, (img) => {
    const t = k / FPS, n = Math.round(t * info.fps); k++;
    const ph = phase(n); if (ph !== 'change') { out.phase.push(ph); return; } // yıl kareleri ayrı geçişte (aşağıda)
    const sum = new Float64Array(GW * GH), cnt = new Uint32Array(GW * GH), d = img.data;
    for (let p = 0, N = info.w * info.h; p < N; p++) {
      const c = cmap[p]; if (c < 0) continue;
      const R = d[3 * p], G = d[3 * p + 1], B = d[3 * p + 2];
      if (ph === 'year') { sum[c] += luma(R, G, B); cnt[c]++; }
      else { const m = Math.max(R, G, B); if (m < 40) continue; const s = 255 / m; const kk = lutC[((Math.min(255, R * s) >> 2) << 12) | ((Math.min(255, G * s) >> 2) << 6) | (Math.min(255, B * s) >> 2)]; if (kk < 0) continue; sum[c] += C.steps[kk].v; cnt[c]++; }
    }
    const vals = new Float32Array(GW * GH);
    for (let c = 0; c < vals.length; c++) vals[c] = cnt[c] ? sum[c] / cnt[c] : NaN;
    if (ph === 'change') change.push(vals);
    out.phase.push(ph);
  });
  // Yıl katmanları: 2 kare/sn örnek YETERSİZ (yıl başına 1–2 kare; H.265 anahtar kare gürültüsü yıl farkı kadar büyük).
  // Bu yüzden 0..283 arasındaki TÜM kareler okunur, her yılın kareleri (geçiş karesi ve bir öncesi hariç) ortalanır.
  const LW = region.x1 - region.x0;
  const cmapL = cellMap(LW, info.h, { x0: 0, x1: LW }, bounds, exclude.map((r) => ({ ...r, x0: r.x0 - region.x0, x1: r.x1 - region.x0 })));
  const ysum = {}, ycnt = {}, sivasSum = {}, sivasN = {};
  await readFrames(file, { select: 'lt(n,284)', crop: { x: region.x0, y: 0, w: LW, h: info.h } }, (img, n) => {
    if (cuts.includes(n) || cuts.includes(n + 1)) return; // yıl değişim karesi ve hemen öncesi atlanır
    const y = yearOf(n); if (!y) return;
    const S = (ysum[y] = ysum[y] || new Float64Array(GW * GH)), K = (ycnt[y] = ycnt[y] || new Uint32Array(GW * GH));
    const d = img.data;
    for (let p = 0, N = LW * info.h; p < N; p++) { const c = cmapL[p]; if (c < 0) continue; S[c] += luma(d[3 * p], d[3 * p + 1], d[3 * p + 2]); K[c]++; }
    let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const p = (Math.floor(sv.y) + dy) * LW + Math.floor(sv.x) + dx; s += luma(d[3 * p], d[3 * p + 1], d[3 * p + 2]); }
    sivasSum[y] = (sivasSum[y] || 0) + s / 9; sivasN[y] = (sivasN[y] || 0) + 1;
  });
  const yearList = Object.keys(ysum).map(Number).sort();
  for (const y of yearList) series.push({ year: y, sivasLuma3x3: +(sivasSum[y] / sivasN[y]).toFixed(2), frames: sivasN[y] });
  const yearLayers = yearList.map((y) => { const v = new Float32Array(GW * GH); for (let c = 0; c < v.length; c++) v[c] = ycnt[y][c] ? ysum[y][c] / ycnt[y][c] : NaN; return v; });
  const years = Object.fromEntries(yearList.map((y) => [y, { length: sivasN[y] }]));
  const changeLayer = (() => { const v = new Float32Array(GW * GH); for (let c = 0; c < v.length; c++) { let s = 0, m = 0; for (const f of change) if (!Number.isNaN(f[c])) { s += f[c]; m++; } v[c] = m ? s / m : NaN; } return v; })();
  const [, hiY] = rangeOf(yearLayers);
  const sivasCell = cellOf(39.7477, 37.0179);
  writeJSON(5313, { id: '5313', title: 'Change in Night Lights between 2012 and 2023 - EIC Version', titleTr: 'Gece ışıkları 2012–2023', kind: 'grid-layers',
    projection: 'equirectangular (kaynak: 16:9 gerilmiş, 11.4° kaydırılmış; kalibrasyonla 1° ızgaraya yeniden örneklendi)', grid: GRID,
    layers: {
      years: { list: yearList, unit: null, quantity: 'ortalama parlaklık (luma 0–255) — GÖRELİ, renk skalası yok', framesPerYear: yearList.map((y) => years[y].length), ...packSqrt(yearLayers, Math.ceil(hiY)),
        note: 'Her yılın tüm video kareleri ortalandı (geçiş kareleri hariç). Karekök kodlama: v = max·(q/254)² — karanlık değerlerde ince çözünürlük.' },
      change: { years: [2012, 2023], unit: null, quantity: 'ışık değişimi −1 (lights out) … +1 (new lights) — GÖRELİ', colorscale: '5313_colorscale.json', samples: change.length, ...packFrames([changeLayer], -1, 1) },
    },
    sivasSeries: series,
    timeline: { fps: FPS, phase: out.phase, yearCuts: cuts, note: 'Video kareleri: 0–283 yıllık seri (büyütmesiz), 284–299 geçiş, 300–630 değişim haritası (gömülü skala), 640–1299 büyütme pencereli tekrar (coğrafi olarak geçersiz, ATLANDI).' },
    calibration: { bounds, region, maxErrPx: 1.41, maxErrKm: 12.2, ref: 'data/calibration.json#5313-sol' },
    source: { page: 'https://svs.gsfc.nasa.gov/5313/', file: 'https://svs.gsfc.nasa.gov/vis/a000000/a005300/a005313/nightlights_flat_series_and_change_wZooms_13_EIC_2160p30_h265.mp4', downloadedAt: downloadedAt(file) },
    credit: CREDIT[5313], sivasCell });
};

// 5669 — aerosoller: tür etiketi + tür başına yoğunluk (göreli)
JOBS[5669] = async () => {
  const C = cs(5669);
  const file = 'raw/5669/Aerosols_2025-08-19T20_00_00_1920x1080.png';
  const img = readFrame(file);
  const cmap = cellMap(img.w, img.h, { x0: 0, x1: img.w }, FULL);
  // Arka plan: koyu okyanus ~(10,20,19), kara gri ~(45,47,47). Aerosol = arka plan üstüne eklenen renk.
  const cats = C.categories.map((c) => ({ id: c.id, rgb: c.rgb, n: Math.hypot(...c.rgb) }));
  const T = cats.length;
  const sum = Array.from({ length: T }, () => new Float64Array(GW * GH)), cnt = new Uint32Array(GW * GH);
  const tagCount = Array.from({ length: T + 1 }, () => new Uint32Array(GW * GH));
  for (let p = 0, N = img.w * img.h; p < N; p++) {
    const c = cmap[p]; if (c < 0) continue;
    const R = img.data[3 * p], G = img.data[3 * p + 1], B = img.data[3 * p + 2];
    cnt[c]++;
    // arka planı çıkar (iki adaydan koyu olanı = okyanus; gri = kara) — kalan vektörün yönüne göre tür
    const bg = (Math.max(R, G, B) - Math.min(R, G, B) < 12 && R > 35 && R < 80) ? [45, 47, 47] : [10, 20, 19];
    const v = [Math.max(0, R - bg[0]), Math.max(0, G - bg[1]), Math.max(0, B - bg[2])];
    const mag = Math.hypot(...v);
    if (mag < 25) { tagCount[T][c]++; continue; } // belirgin aerosol yok
    // Gri (doygunluk < 14): kara yüzeyi, buz ya da şehir ışığı → aerosol değil (ilk sürümde deniz tuzu sanılıyordu)
    if (Math.max(R, G, B) - Math.min(R, G, B) < 14) { tagCount[T][c]++; continue; }
    let best = -1, bc = 0.9; // kosinüs ≥ 0.9 (≈25°)
    for (let k = 0; k < T; k++) {
      if (cats[k].id === 'dust' && !(v[0] > v[1] + 10)) continue; // toz lilası R>G; mavimsi okyanus girdapları R<G
      const cs_ = (v[0] * cats[k].rgb[0] + v[1] * cats[k].rgb[1] + v[2] * cats[k].rgb[2]) / (mag * cats[k].n); if (cs_ > bc) { bc = cs_; best = k; }
    }
    if (best < 0) { tagCount[T][c]++; continue; }
    tagCount[best][c]++;
    sum[best][c] += Math.min(1, mag / cats[best].n); // göreli yoğunluk 0..1
  }
  const layers = {};
  cats.forEach((k, i) => { const v = new Float32Array(GW * GH); for (let c = 0; c < v.length; c++) v[c] = cnt[c] ? sum[i][c] / cnt[c] : NaN; layers[k.id] = { ...packFrames([v], 0, 1) }; });
  const tag = new Uint8Array(GW * GH); // baskın tür indeksi; T = yok
  for (let c = 0; c < tag.length; c++) { let b = T, bv = 0; for (let k = 0; k <= T; k++) if (tagCount[k][c] > bv) { bv = tagCount[k][c]; b = k; } tag[c] = b; }
  const share = cats.map((k, i) => { let s = 0; for (let c = 0; c < tag.length; c++) if (tag[c] === i) s++; return { id: k.id, cellsDominant: s }; });
  writeJSON(5669, { id: '5669', title: 'GEOS Aerosols (2025)', titleTr: 'Aerosoller (GEOS) — 19 Ağustos 2025 20:00 UTC', kind: 'categorical-layers',
    projection: 'equirectangular (kaynak 1920x1080, 16:9’a gerilmiş tam küre)', grid: GRID, date: '2025-08-19T20:00Z',
    categories: cats.map((k, i) => ({ index: i, id: k.id, label: C.categories[i].label, rgb: k.rgb })), noneIndex: T,
    tag: b64(tag), tagNote: 'hücredeki piksellerin en çoğunun türü; noneIndex = belirgin aerosol yok', dominantShare: share,
    layers, layersNote: 'Tür başına GÖRELİ yoğunluk 0..1 (renk parlaklığı / skala kutusu rengi), birim YOK. Renk skalası miktar vermiyor.',
    method: 'Her piksel: gri (doygunluk<14: kara, buz, şehir ışığı) → yok; arka plan (okyanus (10,20,19) ya da kara (45,47,47)) çıkarılır; kalan renk vektörü 4 tür rengine kosinüs ≥0.9 ile atanır (toz için ayrıca R>G+10); büyüklük < 25 → yok. Hücre = piksel ortalaması.',
    limits: ['Türler haritada üst üste toplanıyor; iki tür karıştığında baskın olan seçilir.', 'Karadaki şehir ışıkları (beyaz) çoğunlukla "yok" ya da deniz tuzu olarak sınıflanabilir.', 'Okyanus girdapları açık mavi-beyaz: deniz tuzu ile karışabilir.'],
    calibration: { bounds: FULL, maxErrPx: 1.09, maxErrKm: 19.0, method: 'şehir ışığı merkezi', ref: 'data/calibration.json#extra.5669' },
    source: { page: 'https://svs.gsfc.nasa.gov/5669/', file: 'https://svs.gsfc.nasa.gov/vis/a000000/a005600/a005669/Aerosols_2025-08-19T20_00_00_1920x1080.png', colorscale: '5669_colorscale.json', downloadedAt: downloadedAt(file) },
    credit: CREDIT[5669] });
};

// 5011 — yıldırım: medyan arka plan + kareler arası ani sarı parlamalar → olay listesi
JOBS[5011] = async () => {
  const file = 'raw/5011/iss_lightning_sos_2048x1024.mp4';
  const info = probe(file);
  const cmap = cellMap(info.w, info.h, { x0: 0, x1: info.w }, FULL);
  const isYellow = (R, G, B) => R > 120 && G > 100 && B < 110 && R - B > 70;
  let prev = null, k = 0;
  const events = [], activity = [], counts = [];
  await readFrames(file, { fps: FPS, size: [info.w, info.h] }, (img) => {
    const t = k / FPS; k++;
    const cur = new Uint16Array(GW * GH);
    const d = img.data;
    for (let p = 0, N = info.w * info.h; p < N; p++) { const c = cmap[p]; if (c >= 0 && isYellow(d[3 * p], d[3 * p + 1], d[3 * p + 2])) cur[c]++; }
    let tot = 0; for (const v of cur) tot += v;
    activity.push(tot);
    if (prev) {
      let ne = 0;
      for (let c = 0; c < cur.length; c++) if (cur[c] >= 3 && cur[c] >= 2 * prev[c] + 2) { // ani artış: en az 3 sarı piksel ve öncekinin 2 katından fazla
        const j = Math.floor(c / GW), i = c % GW;
        events.push([+t.toFixed(2), +(90 - j - 0.5).toFixed(1), +(-180 + i + 0.5).toFixed(1), cur[c]]); ne++;
      }
      counts.push(ne);
    }
    prev = cur;
  });
  writeJSON(5011, { id: '5011', title: 'Lightning Events Detected from the ISS 2017-2023', titleTr: 'ISS’ten görülen yıldırımlar 2017–2023', kind: 'events',
    projection: 'equirectangular', grid: GRID,
    events: { fields: ['t (video saniyesi)', 'lat (hücre merkezi)', 'lon (hücre merkezi)', 'şiddet (hücredeki sarı piksel sayısı, 2048x1024 kopyada)'], count: events.length, list: events },
    activity: { fps: FPS, note: 'her örnek karede toplam sarı piksel (küresel etkinlik)', values: activity },
    eventsPerSample: counts,
    time: { videoSeconds: +(info.frames / info.fps).toFixed(2), dateRange: ['2017-03', '2023-07'], dates: null, note: 'Videoda tarih etiketi YOK; kare→tarih eşlemesi bilinmiyor. 10 günlük kayan pencere (API).' },
    method: 'Kaynak 4096x2048 → 2048x1024 kopya (ffmpeg area). 2 kare/sn; sarı piksel (R>120, G>100, B<110, R−B>70) 1° hücrelerde sayılır. Olay = hücrede ≥3 sarı piksel VE önceki örneğin 2 katı+2’den fazla.',
    calibration: { bounds: FULL, maxErrPx: 1.41, note: 'NY maskede 8 px, görsel ≤1 px', ref: 'data/calibration.json#5011' },
    source: { page: 'https://svs.gsfc.nasa.gov/5011/', file: 'https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005011/iss_lightning_sos_yearly_07312023_2048p60.mp4', downloadedAt: downloadedAt('iss_lightning_sos_yearly_07312023_2048p60.mp4') },
    credit: CREDIT[5011], notes: ['ISS yörüngesi ~±52° enlem; kuşak dışı karartılmış, yıldırım yok.'] });
};

// Küre videoları: coğrafi dönüşüm YOK → ekran ızgarası (192x108)
async function screenGrid(id, file, C, opts) {
  const SW = 192, SH = 108;
  const steps = opts.steps || C.steps;
  const lut = opts.luma ? null : makeLUT(steps, rgbDist, opts.maxDist);
  const frames = [], times = [];
  let k = 0;
  const info = probe(file);
  const sx = info.w / SW, sy = info.h / SH;
  await readFrames(file, { fps: FPS, size: [info.w, info.h] }, (img) => {
    const t = k / FPS; k++;
    const sum = new Float64Array(SW * SH), cnt = new Uint32Array(SW * SH), d = img.data;
    for (let y = 0; y < info.h; y++) { if (opts.skip?.(0, y) === 'row') continue; for (let x = 0; x < info.w; x++) {
      if (opts.skip?.(x, y)) continue;
      const p = y * info.w + x, R = d[3 * p], G = d[3 * p + 1], B = d[3 * p + 2];
      let val;
      if (opts.luma) val = (0.2126 * R + 0.7152 * G + 0.0722 * B) / 255; // yalnızca parlaklık
      else { const kk = lut[((R >> 2) << 12) | ((G >> 2) << 6) | (B >> 2)]; if (kk < 0) continue; val = steps[kk].v; }
      const c = Math.floor(y / sy) * SW + Math.floor(x / sx); sum[c] += val; cnt[c]++;
    } }
    const v = new Float32Array(SW * SH); for (let c = 0; c < v.length; c++) v[c] = cnt[c] ? sum[c] / cnt[c] : NaN;
    frames.push(v); times.push(+t.toFixed(2));
  });
  const all = new Uint8Array(frames.length * SW * SH);
  let qd; frames.forEach((f, i) => { qd = quantize(f, opts.vmin, opts.vmax); all.set(qd.q, i * SW * SH); });
  return { screen: { w: SW, h: SH, note: 'EKRAN ızgarası — coğrafi konum DEĞİL (küre + hareketli kamera)' }, frames: { count: frames.length, fps: FPS, t: times }, data: b64(all), quant: { bits: 8, nodata: 255, scale: +qd.scale.toPrecision(6), offset: opts.vmin } };
}
JOBS[4950] = async () => {
  const C = cs(4950);
  const file = 'raw/4950/GEDI_global_w_colorbar_1080p60.mp4';
  const r = await screenGrid(4950, file, C, { steps: C.variants['0to50'].steps, maxDist: 25, vmin: 0, vmax: 50, skip: (x, y) => y > 900 && x < 560 }); // ekrandaki renk skalası (sol alt) hariç
  writeJSON(4950, { id: '4950', title: 'GEDI Forest Height', titleTr: 'Orman yüksekliği (GEDI)', kind: 'screen-grid', projection: 'küre (3B, abartılı yükseklik, hareketli kamera)', unit: 'm', ...r,
    method: 'Ekrandaki piksel 0to50 skalasına (RGB ≤25) eşlenir; ekran 192x108 hücrede ortalanır.',
    limits: ['Işıklandırma/gölge rengi değiştirir → metre değeri GÜVENİLMEZ, yalnızca kaba göreli.', 'Üç GEDI skalası aynı renk geçişini kullanıyor (bkz. 4950_colorscale.json).', 'Veri aralığı API’de çelişkili (2018–2019 / 2019–2020).'],
    source: { page: 'https://svs.gsfc.nasa.gov/4950/', file: 'https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_1080p60.mp4', colorscale: '4950_colorscale.json', downloadedAt: downloadedAt(file) }, credit: CREDIT[4950] });
};
JOBS[5196] = async () => {
  const C = cs(5196);
  const file = 'raw/5196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4';
  // İlk deneme: skalanın opak kısmına RGB≤30 eşleme → hücrelerin yalnızca %0.15’i eşleşti (nokta bulutu parlama/ışıkla çiziliyor).
  // Bu yüzden yalnızca PARLAKLIK (göreli) kullanılır.
  const r = await screenGrid(5196, file, C, { luma: true, vmin: 0, vmax: 1 });
  writeJSON(5196, { id: '5196', title: 'DYAMOND Global Carbon Dioxide', titleTr: 'Küresel CO₂ (DYAMOND, Ocak–Mart 2020)', kind: 'screen-grid', projection: 'küre (3B nokta bulutu, yörüngede dönen kamera)', unit: null, ...r,
    method: 'Ekran pikseli PARLAKLIĞI (luma/255) 192x108 hücrede ortalanır. Renk→ppm eşlemesi denendi, başarısız (%0.15 eşleşme) → kullanılmadı.',
    limits: ['ppm değeri BİLİNMİYOR (renk skalasında sayı yok) → göreli 0..1.', 'Opaklık da veri taşıyor; düşük değerler saydam → eşlenemez.', 'Coğrafi konum yok.'],
    source: { page: 'https://svs.gsfc.nasa.gov/5196/', file: 'https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4', colorscale: '5196_colorscale.json', downloadedAt: downloadedAt(file) }, credit: CREDIT[5196] });
};

// Şehirler — GeoNames cities15000 (CC BY 4.0)
JOBS.cities = async () => {
  const dir = 'raw/geonames', zip = `${dir}/cities15000.zip`, txt = `${dir}/cities15000.txt`;
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(txt)) {
    if (!fs.existsSync(zip)) {
      const r = await fetch('https://download.geonames.org/export/dump/cities15000.zip', { headers: { 'User-Agent': 'EarthEar-data/0.1' } });
      if (!r.ok) throw new Error('GeoNames ' + r.status);
      fs.writeFileSync(zip, Buffer.from(await r.arrayBuffer()));
    }
    const tarBin = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'unzip';
    const u = spawnSync(tarBin, process.platform === 'win32' ? ['-xf', 'cities15000.zip'] : ['-o', 'cities15000.zip'], { cwd: dir });
    if (u.status !== 0) throw new Error('unzip: ' + u.stderr);
  }
  const rows = fs.readFileSync(txt, 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t'));
  // geonameid, name, asciiname, alternatenames, lat, lon, fclass, fcode, cc, cc2, admin1, admin2, admin3, admin4, population, ...
  const list = rows.map((c) => [c[1], c[8], +(+c[4]).toFixed(3), +(+c[5]).toFixed(3), +c[14]]).sort((a, b) => b[4] - a[4]);
  // Türkçe adı (alternatenames içinde ayrı dil etiketi yok) → ascii adı arama için ayrıca
  const ascii = rows.reduce((m, c) => { if (c[2] !== c[1]) m[c[1] + '|' + c[8]] = c[2]; return m; }, {});
  const out = { source: 'GeoNames cities15000 (nüfus ≥ 15000 veya başkent)', url: 'https://download.geonames.org/export/dump/cities15000.zip', license: 'CC BY 4.0 — GeoNames (geonames.org)', downloadedAt: new Date(fs.statSync(zip).mtimeMs).toISOString(),
    fields: ['ad', 'ülke (ISO-2)', 'enlem', 'boylam', 'nüfus'], count: list.length, cities: list, asciiNames: ascii };
  writeJSON('cities', out);
};


// Kara maskesi (kıyı çizgisi çizimi için) — SVS 5544 NDVI karesinden (okyanus tek renk mavi; kalibrasyon referansı).
// 2048x1024 (0.18°), her bit: 1 = kara (Antarktika/Grönland buzu dahil). Çıktı: public/data/land_mask.json
JOBS.land = async () => {
  const file = 'raw/5544/nrt_ndvi_equi_2048p30.mp4';
  const img = readFrame(file, { frame: 929 });
  const W = 2048, H = 1024, sx = img.w / W, sy = img.h / H; // 0.18° — küre üstünde pürüzsüz kıyı
  const bits = new Uint8Array((W * H) / 8);
  let land = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    let n = 0, l = 0;
    for (let y = Math.floor(j * sy); y < Math.floor((j + 1) * sy); y++) for (let x = Math.floor(i * sx); x < Math.floor((i + 1) * sx); x++) {
      const p = (y * img.w + x) * 3, R = img.data[p], G = img.data[p + 1], B = img.data[p + 2];
      n++; if (!(B > R + 40 && B > G + 10)) l++;
    }
    if (l * 2 >= n) { const c = j * W + i; bits[c >> 3] |= 1 << (c & 7); land++; }
  }
  writeJSON('land_mask', { w: W, h: H, bounds: FULL, encoding: 'bit c = j·w + i (j kuzeyden, i batıdan); bayt c>>3, bit c&7; 1 = kara', landFraction: +(land / (W * H)).toFixed(4),
    data: b64(bits), source: { page: 'https://svs.gsfc.nasa.gov/5544/', file: 'nrt_ndvi_equi_2048p30.mp4 kare 929', note: 'Okyanus mavisi = deniz; geri kalan = kara/buz. Yalnızca kıyı çizgisi çizimi için.' },
    credit: "NASA's Scientific Visualization Studio (SVS 5544, NDVI görselinden türetilmiş kara maskesi)" });
};

// ---------- çalıştır
const want = process.argv.slice(2);
const ids = want.length ? want : ['3912', '5147', '5544', '5313', '5669', '5011', '4950', '5196', 'cities', 'land'];
for (const id of ids) {
  if (!JOBS[id]) { console.log('bilinmeyen', id); continue; }
  const t0 = Date.now();
  console.log(`▶ ${id}`);
  await JOBS[id]();
  console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)} sn)`);
}
