// "Meteorolog" için NASA GMAO GEOS-FP tahmini → statik dosya (uygulama internetsiz çalışır).
// Kaynak: NASA GMAO GEOS-FP, NCCS OPeNDAP (GrADS Data Server) — herkese açık, giriş gerekmez:
//   https://opendap.nccs.nasa.gov/dods/GEOS-5/fp/0.25_deg/fcast/
// En yeni 00Z çalıştırması (10 güne kadar) → 7 gün (çalıştırma daha azını veriyorsa o kadar) × günde 4 saat (00/06/12/18 UTC)
// × t2m, u10m, v10m (slv) · prectot, precsno, preccon (flx) · cldtot (rad); 2° × 2.5° seyreltilmiş ızgara (91 × 144).
// Not: bu sunucu birden çok zaman adımlı istekte zaman aşımına uğruyor (504) → zaman adımı başına ayrı istek.
// Çıktı: public/data/forecast.bin (int16 LE, [adım][değişken][91·144]) + public/data/forecast_meta.json
// Kullanım: node scripts/forecast.mjs   (npm run forecast)
import fs from 'node:fs';

const B = 'https://opendap.nccs.nasa.gov/dods/GEOS-5/fp/0.25_deg/fcast';
const HOURS = [0, 6, 12, 18], MAX_DAYS = 7, PAR = 4;
const SETS = [
  { coll: 'tavg1_2d_slv_Nx', vars: ['t2m', 'u10m', 'v10m'] },
  { coll: 'tavg1_2d_flx_Nx', vars: ['prectot', 'precsno', 'preccon'] },
  { coll: 'tavg1_2d_rad_Nx', vars: ['cldtot'] },
];
// gerçek birime çevirme + int16 kodlama ölçeği (değer = q / scale)
const VARS = {
  t2m: { unit: '°C', conv: (x) => x - 273.15, scale: 100, long: '2 m hava sıcaklığı' },
  u10m: { unit: 'm/s', conv: (x) => x, scale: 100, long: '10 m rüzgâr (doğu bileşeni)' },
  v10m: { unit: 'm/s', conv: (x) => x, scale: 100, long: '10 m rüzgâr (kuzey bileşeni)' },
  prectot: { unit: 'mm/saat', conv: (x) => x * 3600, scale: 100, long: 'toplam yağış (saatlik ortalama)' },
  precsno: { unit: 'mm/saat', conv: (x) => x * 3600, scale: 100, long: 'kar yağışı (su eşdeğeri)' },
  preccon: { unit: 'mm/saat', conv: (x) => x * 3600, scale: 100, long: 'konvektif (sağanak) yağış' },
  cldtot: { unit: '0–1', conv: (x) => x, scale: 10000, long: 'toplam bulutluluk' },
};
const ORDER = SETS.flatMap((s) => s.vars);
const NLAT = 91, NLON = 144, NP = NLAT * NLON, MISSING = -32768;

const get = async (url, tries = 3) => {
  for (let k = 1; k <= tries; k++) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(90000) }); if (r.ok) return await r.text(); throw new Error(`HTTP ${r.status}`); }
    catch (e) { if (k === tries) throw new Error(`${url.slice(0, 120)}…: ${e.message}`); await new Promise((r) => setTimeout(r, 2000 * k)); }
  }
};

// 1) en yeni 00Z çalıştırması ve uzunluğu
const listing = await get(`${B}/tavg1_2d_slv_Nx/`);
const runs = [...new Set([...listing.matchAll(/tavg1_2d_slv_Nx\.(\d{8})_00\b/g)].map((m) => m[1]))].sort();
if (!runs.length) throw new Error('00Z çalıştırması bulunamadı');
let run, nT = 0;
for (const r of runs.reverse()) { // en yeniden geriye: tam yayımlanmış olanı al
  const info = await get(`${B}/tavg1_2d_slv_Nx/tavg1_2d_slv_Nx.${r}_00.info`);
  const m = info.match(/time = 0\.\.(\d+)/); const n = m ? +m[1] + 1 : 0;
  if (n >= 24) { run = r; nT = n; break; }
}
if (!run) throw new Error('kullanılabilir 00Z çalıştırması yok');
const days = Math.min(MAX_DAYS, Math.floor(nT / 24));
const steps = []; for (let d = 0; d < days; d++) for (const h of HOURS) steps.push(d * 24 + h); // tavg1: k. adım = 00Z + k saat … +1 saat ortalaması
const runIso = `${run.slice(0, 4)}-${run.slice(4, 6)}-${run.slice(6, 8)}T00:00:00Z`;
console.log(`çalıştırma ${run}_00Z · ${nT} saatlik adım → ${days} gün × ${HOURS.length} saat = ${steps.length} adım × ${ORDER.length} değişken`);

// 2) çek: zaman adımı başına, veri seti başına bir istek (değişkenler birlikte)
const out = new Int16Array(steps.length * ORDER.length * NP).fill(MISSING);
const parse = (txt, vars) => {
  const res = {}; let cur = null;
  for (const line of txt.split('\n')) {
    const h = line.match(/^([a-z0-9]+), \[/); if (h) { cur = vars.includes(h[1]) ? h[1] : null; if (cur) res[cur] = new Float64Array(NP).fill(NaN); continue; }
    if (!cur) continue;
    const r = line.match(/^\[0\]\[(\d+)\], (.*)$/); if (!r) continue;
    const j = +r[1]; r[2].split(',').forEach((v, i) => { const x = +v; res[cur][j * NLON + i] = Math.abs(x) > 1e14 ? NaN : x; });
  }
  return res;
};
const jobs = []; steps.forEach((k, si) => SETS.forEach((s) => jobs.push({ k, si, s })));
let done = 0; const t0 = Date.now();
const worker = async () => {
  while (jobs.length) {
    const { k, si, s } = jobs.shift();
    const q = s.vars.map((v) => `${v}[${k}:${k}][0:8:720][0:8:1151]`).join(',');
    const txt = await get(`${B}/${s.coll}/${s.coll}.${run}_00.ascii?${q}`);
    const res = parse(txt, s.vars);
    for (const v of s.vars) {
      const a = res[v]; if (!a) throw new Error(`${s.coll} ${v} adım ${k}: değişken yanıtta yok`);
      const vi = ORDER.indexOf(v), V = VARS[v], off = (si * ORDER.length + vi) * NP;
      for (let p = 0; p < NP; p++) { const x = a[p]; if (!Number.isNaN(x)) out[off + p] = Math.max(-32767, Math.min(32767, Math.round(V.conv(x) * V.scale))); }
    }
    if (++done % 12 === 0) console.log(`  ${done}/${steps.length * SETS.length} istek · ${Math.round((Date.now() - t0) / 1000)} sn`);
  }
};
await Promise.all(Array.from({ length: PAR }, worker));

// 3) yaz
fs.writeFileSync('public/data/forecast.bin', Buffer.from(out.buffer));
const meta = {
  source: 'NASA GMAO GEOS-FP (Goddard Earth Observing System — Forward Processing), NCCS OPeNDAP',
  url: `${B}/`, run: runIso, runLabel: `${run}_00Z`, fetchedAt: new Date().toISOString(),
  daysAvailable: days, daysRequested: MAX_DAYS, hoursUtc: HOURS, steps: steps.map((k) => new Date(Date.parse(runIso) + k * 3600e3).toISOString()),
  note: 'Saatlik ortalamalar (tavg1): her adım o saatten başlayan 1 saatin ortalaması. Günlük yağış = 4 örneğin ortalama hızı × 24 saat (tahmini). Model tahmini; resmi uyarı değildir.',
  grid: { nLat: NLAT, nLon: NLON, lat0: -90, dLat: 2, lon0: -180, dLon: 2.5, order: '[adım][değişken][enlem(güneyden) × 144 + boylam]' },
  encoding: 'int16 little-endian; değer = q / scale; -32768 = veri yok',
  vars: ORDER.map((v) => ({ id: v, unit: VARS[v].unit, scale: VARS[v].scale, long: VARS[v].long })),
};
fs.writeFileSync('public/data/forecast_meta.json', JSON.stringify(meta, null, 1));
console.log(`yazıldı: public/data/forecast.bin (${(fs.statSync('public/data/forecast.bin').size / 1048576).toFixed(2)} MB) + forecast_meta.json · ${days} gün · ${Math.round((Date.now() - t0) / 1000)} sn`);
