// Aşama 2 indirme listesi. Tekrar çalıştırılabilir: var olan dosyayı (boyutu tutuyorsa) atlar.
// 300 MB üstü dosyayı İNDİRMEZ (kural). Kullanım: node scripts/download.mjs [id ...]
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const MAX = 300 * 1024 * 1024;
const V = 'https://svs.gsfc.nasa.gov/vis/a000000';
const H = { 'User-Agent': 'EarthEar-data/0.1' };
/** 300 MB sınırını aşan ama kullanıcının açıkça onayladığı dosyalar. */
const ALLOW_LARGE = new Set(['iss_lightning_sos_yearly_07312023_2048p60.mp4']);

export const LIST = {
  3912: [
    `${V}/a003900/a003912/ecco2_sst_flow.mp4`,
    `${V}/a003900/a003912/sst_ecco2_cbar.png`,
    `${V}/a003900/a003912/frames/2048x1024_1x1_30p/orig/flat_global_ecco2_2028x1024.23000.tif`,
    `${V}/a003900/a003912/frames/2048x1024_1x1_30p/orig/flat_global_ecco2_2028x1024.27000.tif`,
    `${V}/a003900/a003912/frames/2048x1024_1x1_30p/orig/flat_global_ecco2_2028x1024.31000.tif`,
  ],
  5011: [
    `${V}/a005000/a005011/iss_lightning_preview.jpg`,
    `${V}/a005000/a005011/iss_lightning_sos_yearly_07312023_2048p60.mp4`, // 350.2 MB — kullanıcı onayladı (ALLOW_LARGE)
  ],
  // Madde 7 — kullanıcı seçimi: 5147 + 5544 (günlük güncellenenler: indirme tarihi download_log.json'da)
  5147: [
    `${V}/a005100/a005147/MC01_stage3_GMAO_near_surface_temperature_2048x1024_en.mp4`,
    `${V}/a005100/a005147/NearSurfaceTemperature_colorbar.png`,
    `${V}/a005100/a005147/NearSurfaceTemperature_colorbar_plain.png`,
  ],
  5544: [
    `${V}/a005500/a005544/nrt_ndvi_equi_2048p30.mp4`,
    `${V}/a005500/a005544/NDVI_colorbar.png`,
    `${V}/a005500/a005544/nrt_ndvi_equi_w_dates_2048p30.mp4`, // tarihli sürüm (kullanıcı isteği, 58.8 MB)
  ],
  5669: [
    `${V}/a005600/a005669/Aerosols_2025-08-19T20_00_00_1920x1080.png`,
    `${V}/a005600/a005669/Aerosols_cbar.png`,
  ],
  4950: [
    `${V}/a004900/a004950/GEDI_global_w_colorbar_1080p60.mp4`,
    `${V}/a004900/a004950/GEDI_colorbar_0to40_01.tif`,
    `${V}/a004900/a004950/GEDI_colorbar_0to50_01.tif`,
    `${V}/a004900/a004950/GEDI_colorbar_0to75_01.tif`,
  ],
  5313: [`${V}/a005300/a005313/nightlights_flat_series_and_change_wZooms_13_EIC_2160p30_h265.mp4`],
  5196: [
    `${V}/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4`,
    `${V}/a005100/a005196/dyamondCbar_6-27-2024a.png`,
  ],
};

async function get(id, url) {
  const dir = path.join('raw', String(id));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, url.split('/').pop());
  const h = await fetch(url, { method: 'HEAD', headers: H });
  if (h.status !== 200) return { file, status: `HEAD ${h.status}` };
  const len = +h.headers.get('content-length') || null;
  if (len && len > MAX && !ALLOW_LARGE.has(url.split('/').pop())) return { file, status: `ATLANDI: ${(len / 1e6).toFixed(1)} MB > 300 MB` };
  if (fs.existsSync(file) && len && fs.statSync(file).size === len) return { file, status: 'zaten var', bytes: len };
  const r = await fetch(url, { headers: H });
  if (!r.ok) return { file, status: `GET ${r.status}` };
  await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(file + '.part'));
  fs.renameSync(file + '.part', file);
  const got = fs.statSync(file).size;
  return { file, status: len && got !== len ? `EKSİK ${got}/${len}` : 'indirildi', bytes: got };
}

const want = process.argv.slice(2).map(Number);
const ids = want.length ? want : Object.keys(LIST).map(Number);
const log = [];
for (const id of ids) for (const url of LIST[id] || []) {
  const r = await get(id, url);
  log.push({ id, url, ...r, at: new Date().toISOString() });
  console.log(id, r.status, r.bytes ? (r.bytes / 1e6).toFixed(1) + ' MB' : '', path.basename(r.file));
}
const logFile = path.join('raw', 'download_log.json');
const prev = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : [];
fs.writeFileSync(logFile, JSON.stringify([...prev, ...log], null, 1));
