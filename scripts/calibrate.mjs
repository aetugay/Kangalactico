// Aşama 3 — düz haritaların lat/lon ↔ piksel kalibrasyonu.
// Referans: 5544 NDVI (API: equirectangular), okyanus tek renk → temiz kara maskesi.
// Her veri setinin kara maskesi referansa oturtulur (sınırlar ızgara aramasıyla), sonra 5 test noktası
// çevresinde (±WIN px) yerel kayma ölçülür → hata (px, km). Çıktı: data/calibration.json
import fs from 'node:fs';
import { readFrame, readFrames } from './lib/raster.mjs';

import { pixelToLonLat, lonLatToPixel, pixelKm, FULL, TEST_POINTS } from './lib/geo.mjs';

/**
 * Piksel bazında MEDYAN: geçici parlak olayları (yıldırım) ve karartma/geçiş karelerini siler,
 * sabit arka plan haritası kalır. (Minimum denendi: karartma kareleri okyanusu da bozdu.)
 */
async function medianOverFrames(file, fps, w, h) {
  const frames = [];
  await readFrames(file, { fps, size: [w, h] }, (img) => frames.push(Uint8Array.from(img.data)));
  const out = new Uint8Array(w * h * 3), col = new Uint8Array(frames.length);
  for (let i = 0; i < out.length; i++) { for (let k = 0; k < frames.length; k++) col[k] = frames[k][i]; col.sort(); out[i] = col[frames.length >> 1]; }
  console.log('  medyan-kare sayısı', frames.length);
  return { w, h, data: out };
}

const sat = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);
function mask(img, landFn) {
  const m = new Uint8Array(img.w * img.h);
  for (let i = 0; i < m.length; i++) m[i] = landFn(img.data[3 * i], img.data[3 * i + 1], img.data[3 * i + 2]) ? 1 : 0;
  return { w: img.w, h: img.h, m };
}

// --- referans
const refImg = readFrame('raw/5544/nrt_ndvi_equi_2048p30.mp4', { frame: 929 });
const REF = mask(refImg, (r, g, b) => !(b > r + 40 && b > g + 10));
const refAt = (lon, lat) => {
  const { x, y } = lonLatToPixel(lon, lat, REF.w, REF.h, FULL);
  const xi = Math.floor(x), yi = Math.floor(y);
  if (yi < 0 || yi >= REF.h) return -1;
  return REF.m[yi * REF.w + ((xi % REF.w) + REF.w) % REF.w];
};

// Veri setleri. region: görüntüde haritanın kapladığı piksel dikdörtgeni (5313'te iki kopya var).
// latBand: karşılaştırmada kullanılacak enlem bandı (maskenin güvenilir olduğu yer).
const SETS = [
  { id: '3912', file: 'raw/3912/ecco2_sst_flow.mp4', at: { frame: 1000 }, land: (r, g, b) => sat(r, g, b) < 14 && r > 45 && r < 150, regions: [{ x0: 0, x1: 2048 }], latBand: [-85, 85] },
  { id: '5011', file: 'raw/5011/iss_lightning_sos_2048x1024.mp4', at: { medianFps: 0.15 }, land: (r) => r >= 24, regions: [{ x0: 0, x1: 2048 }], latBand: [-45, 45] },
  { id: '5313-sol', file: 'raw/5313/nightlights_flat_series_and_change_wZooms_13_EIC_2160p30_h265.mp4', at: { frame: 60 }, land: (r, g) => r + g >= 4, regions: [{ x0: 0, x1: 3840 }], latBand: [-85, 85] },
  { id: '5313-sag', file: 'raw/5313/nightlights_flat_series_and_change_wZooms_13_EIC_2160p30_h265.mp4', at: { frame: 60 }, land: (r, g) => r + g >= 4, regions: [{ x0: 3840, x1: 7680 }], latBand: [-85, 85] },
  { id: '5544-oz', file: 'raw/5544/nrt_ndvi_equi_2048p30.mp4', at: { frame: 0 }, land: (r, g, b) => !(b > r + 40 && b > g + 10), regions: [{ x0: 0, x1: 4096 }], latBand: [-85, 85] },
];

function score(M, reg, b, band, stride, win) {
  let ok = 0, n = 0;
  const W = reg.x1 - reg.x0;
  const ys = win ? win.y0 : 0, ye = win ? win.y1 : M.h, xs = win ? win.x0 : reg.x0, xe = win ? win.x1 : reg.x1;
  for (let y = Math.max(0, ys); y < Math.min(M.h, ye); y += stride) {
    for (let x = Math.max(reg.x0, xs); x < Math.min(reg.x1, xe); x += stride) {
      const { lon, lat } = pixelToLonLat(x - reg.x0, y, W, M.h, b);
      if (lat < band[0] || lat > band[1]) continue;
      const r = refAt(lon, lat);
      if (r < 0) continue;
      n++;
      if (r === M.m[y * M.w + x]) ok++;
    }
  }
  return n ? ok / n : 0;
}

function fitBounds(M, reg, band) {
  // lonL ∈ [-190,-170], span ∈ [350,370], latT ∈ [70,100], latB ∈ [-100,-70]; kaba → ince
  let best = { s: -1 };
  const grid = (c, r, st) => { const a = []; for (let v = c - r; v <= c + r + 1e-9; v += st) a.push(+v.toFixed(4)); return a; };
  let c = { lonL: -180, span: 360, latT: 90, latB: -90 };
  const area = (reg.x1 - reg.x0) * M.h;
  const strideFor = (n) => Math.max(1, Math.round(Math.sqrt(area / n)));
  for (const [r, st, stride] of [[10, 2.5, strideFor(8000)], [2.5, 0.5, strideFor(30000)], [0.5, 0.1, strideFor(120000)], [0.1, 0.025, strideFor(400000)]]) {
    for (const lonL of grid(c.lonL, r, st)) for (const span of grid(c.span, r, st)) for (const latT of grid(c.latT, r, st)) for (const latB of grid(c.latB, r, st)) {
      const b = { lonL, lonR: lonL + span, latT, latB };
      const s = score(M, reg, b, band, stride);
      if (s > best.s) best = { s, b, lonL, span, latT, latB };
    }
    c = { lonL: best.lonL, span: best.span, latT: best.latT, latB: best.latB };
  }
  return best;
}

function localShift(M, reg, b, band, pt) {
  const W = reg.x1 - reg.x0;
  const WIN = Math.round((7 / 360) * W), MAXS = Math.max(4, Math.round((1.4 / 360) * W));
  const p = lonLatToPixel(pt.lon, pt.lat, W, M.h, b);
  const cx = Math.floor(p.x) + reg.x0, cy = Math.floor(p.y);
  let best = { s: -1, dx: 0, dy: 0 }, s0 = 0;
  for (let dy = -MAXS; dy <= MAXS; dy++) for (let dx = -MAXS; dx <= MAXS; dx++) {
    // maskeyi (dx,dy) kaydırınca referansla uyum
    let ok = 0, n = 0;
    for (let y = cy - WIN; y <= cy + WIN; y++) for (let x = cx - WIN; x <= cx + WIN; x++) {
      const xs = x + dx, ys = y + dy;
      if (ys < 0 || ys >= M.h || xs < reg.x0 || xs >= reg.x1) continue;
      const { lon, lat } = pixelToLonLat(x - reg.x0, y, W, M.h, b);
      if (lat < band[0] || lat > band[1]) continue;
      const r = refAt(lon, lat); if (r < 0) continue;
      n++; if (r === M.m[ys * M.w + xs]) ok++;
    }
    const s = n ? ok / n : 0;
    if (dx === 0 && dy === 0) s0 = s;
    if (s > best.s + 1e-9 || (Math.abs(s - best.s) < 1e-9 && Math.hypot(dx, dy) < Math.hypot(best.dx, best.dy))) best = { s, dx, dy };
  }
  // kıyı yoksa (pencerede hep kara/deniz) kayma ölçülemez
  let land = 0, tot = 0;
  for (let y = cy - WIN; y <= cy + WIN; y++) for (let x = cx - WIN; x <= cx + WIN; x++) { if (y < 0 || y >= M.h || x < reg.x0 || x >= reg.x1) continue; tot++; land += M.m[y * M.w + x]; }
  const frac = land / tot;
  const km = pixelKm(pt.lat, W, M.h, b);
  return { name: pt.name, px: { x: +(p.x + reg.x0).toFixed(1), y: +p.y.toFixed(1) }, dx: best.dx, dy: best.dy, errPx: +Math.hypot(best.dx, best.dy).toFixed(2), errKm: +Math.hypot(best.dx * km.dx, best.dy * km.dy).toFixed(1), kmPerPx: { x: +km.dx.toFixed(2), y: +km.dy.toFixed(2) }, matchAt0: +s0.toFixed(4), matchBest: +best.s.toFixed(4), landFrac: +frac.toFixed(2), measurable: frac > 0.05 && frac < 0.95 };
}

const ONLY = process.argv.slice(2);
const prevOut = fs.existsSync('data/calibration.json') ? JSON.parse(fs.readFileSync('data/calibration.json', 'utf8')) : null;
const out = { generated: new Date().toISOString(), reference: '5544 nrt_ndvi_equi_2048p30.mp4 kare 929 (API: equirectangular), FULL sınırlar varsayıldı', sets: {} };
const cache = {};
if (prevOut && ONLY.length) Object.assign(out.sets, prevOut.sets, prevOut.extra ? {} : {});
if (prevOut?.extra) out.extra = prevOut.extra;
for (const S of SETS) {
  if (ONLY.length && !ONLY.includes(S.id)) continue;
  const key = S.file + JSON.stringify(S.at);
  const img = cache[key] || (cache[key] = S.at.medianFps ? await medianOverFrames(S.file, S.at.medianFps, 2048, 1024) : readFrame(S.file, S.at));
  const M = mask(img, S.land);
  const reg = S.regions[0];
  const fit = fitBounds(M, reg, S.latBand);
  const b = fit.b;
  const sFull = score(M, reg, FULL, S.latBand, Math.max(1, Math.round(Math.sqrt((reg.x1 - reg.x0) * M.h / 400000))));
  const pts = TEST_POINTS.map((pt) => localShift(M, reg, b, S.latBand, pt));
  out.sets[S.id] = { file: S.file, frame: S.at, size: [img.w, img.h], region: reg, latBand: S.latBand,
    bounds: { lonL: +b.lonL.toFixed(3), lonR: +b.lonR.toFixed(3), latT: +b.latT.toFixed(3), latB: +b.latB.toFixed(3) },
    match: +fit.s.toFixed(4), matchIfFull: +sFull.toFixed(4), points: pts };
  console.log(S.id, JSON.stringify(out.sets[S.id].bounds), 'uyum', out.sets[S.id].match, '(FULL varsayımıyla', out.sets[S.id].matchIfFull + ')');
  for (const p of pts) console.log('   ', p.name.padEnd(9), `px(${p.px.x},${p.px.y})`, `kayma(${p.dx},${p.dy})`, `${p.errPx}px ${p.errKm}km`, p.measurable ? '' : `ÖLÇÜLEMEZ (kara oranı ${p.landFrac})`);
}
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/calibration.json', JSON.stringify(out, null, 1));
