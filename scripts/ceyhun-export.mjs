// Ceyhun'un 2024 paketinden YALNIZCA denetimden "UYGUN" çıkan katmanları statik dosyalara aktarır (API gerekmez).
// Girdi : referans/meta.json, monthly_cube.bin, daily_CO2.bin (git'e girmez)
// Çıktı : public/data/m24/meta.json, monthly.bin ([katman][ay][12960] int16 LE, 0..1000, -1 = eksik), co2_daily.bin ([365][12960])
// Denetim: scripts/audit-ceyhun.mjs → data/audit_ceyhun.json ve data/audit_ceyhun.md
import fs from 'node:fs';

const M = JSON.parse(fs.readFileSync('referans/meta.json', 'utf8'));
const G = M.grid, NP = G.n_points, NLON = G.n_lon;
const ORDER = M.aylik_kup.katman_sirasi;
const cube = new Int16Array(fs.readFileSync('referans/monthly_cube.bin').buffer.slice(0));

// Gerçek kaynağa göre düzeltilmiş adlar. transform 'log' → log1p ters dönüşümü (meta'da yazmıyor; AOD ve yağış küresel
// ortalamaları yalnız log1p ile fiziksel olarak makul çıkıyor — bkz. data/audit_ceyhun.md).
const KEEP = {
  CO2: { id: 'co2_24', tr: 'Atmosferik CO₂ (sütun ortalaması)', en: 'Atmospheric CO₂ (column average)', product: 'OCO2_GEOS_L3CO2_DAY', variable: 'XCO2', unit: 'ppm', nasa: 'SVS 5115, 5110, 5119 (OCO-2 / GEOS CO₂)', daily: true },
  SO2: { id: 'so2_24', tr: 'Yüzey SO₂ kütle derişimi', en: 'Surface SO₂ mass concentration', product: 'MERRA-2 M2TMNXAER', variable: 'SO2SMASS', unit: 'µg/m³', nasa: 'konu: SVS 4810 (SO₂); ürün ailesi MERRA-2: SVS 4960, 5047, 5191' },
  AOD: { id: 'aod_24', tr: 'Aerosol optik derinliği (550 nm)', en: 'Aerosol optical depth (550 nm)', product: 'MERRA-2 M2TMNXAER', variable: 'TOTEXTTAU', unit: '', nasa: 'konu: SVS 5669 (GEOS aerosoller), Air Quality 40529' },
  TEMP: { id: 't2m_24', tr: '2 m hava sıcaklığı', en: '2 m air temperature', product: 'MERRA-2 M2TMNXSLV', variable: 'T2M', unit: '°C', nasa: 'SVS 5147 (GEOS-FP T2M), 5191 (MERRA-2)' },
  LST: { id: 'ts_24', tr: 'Yüzey deri sıcaklığı (kara + deniz)', en: 'Surface skin temperature (land + sea)', product: 'MERRA-2 M2TMNXSLV', variable: 'TS', unit: '°C', nasa: 'konu: SVS 5147 (yüzey sıcaklığı)', note: 'Uydu LST değil; MERRA-2 deri sıcaklığı. 2 m hava sıcaklığıyla r = 0.999.' },
  ALBEDO: { id: 'albedo_24', tr: 'Yüzey albedosu (yansıtma oranı)', en: 'Surface albedo', product: 'MERRA-2 M2TMNXRAD', variable: 'ALBEDO', unit: '0–1', nasa: 'konu EIC\'de doğrudan yok; ürün ailesi MERRA-2: SVS 4960, 5047, 5191' },
  SST: { id: 'sst_24', tr: 'Deniz yüzeyi (deri) sıcaklığı', en: 'Sea surface skin temperature', product: 'MERRA-2 M2TMNXOCN', variable: 'TSKINWTR', unit: '°C', nasa: 'SVS 5101, 5176 (MUR SST), 3912 (ECCO2)' },
  IMERG: { id: 'precip_24', tr: 'Kara üstü toplam yağış', en: 'Total precipitation over land', product: 'MERRA-2 M2TMNXLND', variable: 'PRECTOTLAND', unit: 'mm/gün', nasa: 'konu: SVS 4285, 4897 (IMERG), 5149 (GEOS-FP yağış)', note: 'Kaynak dosyada "IMERG" yazıyordu; gerçek kaynak MERRA-2 model yağışı (yalnız kara).' },
  SEAICE: { id: 'seaice_24', tr: 'Deniz buzu oranı', en: 'Sea-ice fraction', product: 'MERRA-2 M2TMNXOCN', variable: 'FRSEAICE', unit: '%', nasa: 'SVS 5046, 5064, 5099, 5382 (deniz buzu)', note: 'Karadaki 0 değerleri "veri yok" yapıldı.' },
};

// kara maskesi (SVS 5544'ten) — deniz buzu için karadaki 0'ları "yok" yapmak
const Lm = JSON.parse(fs.readFileSync('public/data/land_mask.json', 'utf8'));
const bits = new Uint8Array(Buffer.from(Lm.data, 'base64'));
const isLand = (lat, lon) => { const i = ((Math.floor(((lon + 180) / 360) * Lm.w) % Lm.w) + Lm.w) % Lm.w, j = Math.max(0, Math.min(Lm.h - 1, Math.floor(((90 - lat) / 180) * Lm.h))); const c = j * Lm.w + i; return (bits[c >> 3] >> (c & 7) & 1) === 1; };

const keepIds = ORDER.filter((k) => KEEP[k]);
const out = new Int16Array(keepIds.length * 12 * NP);
let masked = 0;
keepIds.forEach((k, ni) => {
  const li = ORDER.indexOf(k);
  for (let m = 0; m < 12; m++) for (let p = 0; p < NP; p++) {
    let v = cube[(li * 12 + m) * NP + p];
    if (k === 'SEAICE' && v === 0) { const lat = G.lat0 + Math.floor(p / NLON) * G.dlat, lon = G.lon0 + (p % NLON) * G.dlon; if (isLand(lat, lon)) { v = -1; masked++; } }
    out[(ni * 12 + m) * NP + p] = v;
  }
});
fs.mkdirSync('public/data/m24', { recursive: true });
fs.writeFileSync('public/data/m24/monthly.bin', Buffer.from(out.buffer));
fs.copyFileSync('referans/daily_CO2.bin', 'public/data/m24/co2_daily.bin');

const meta = {
  year: 2024, months: M.aylik_kup.aylar,
  grid: { nLat: G.n_lat, nLon: G.n_lon, lat0: G.lat0, dLat: G.dlat, lon0: G.lon0, dLon: G.dlon, cell: '2° × 2.5°', order: 'indeks = i_lat·144 + i_lon (i_lat güneyden)' },
  encoding: 'int16 little-endian; q ∈ 0..1000; -1 = veri yok. Gerçek değer: linear → vmin + q/1000·(vmax−vmin); log → expm1(log1p(vmin) + q/1000·(log1p(vmax)−log1p(vmin)))',
  files: { monthly: 'monthly.bin', monthlyShape: [keepIds.length, 12, NP], co2Daily: 'co2_daily.bin', co2DailyShape: [365, NP], co2DailyStart: '2024-01-01', co2DailyNote: '2024 artık yıl ama dosyada 365 gün var; ay hizalaması 31 Aralık\'ın eksik olduğunu gösteriyor.' },
  clipping: 'vmin/vmax yaklaşık %2 ve %98 yüzdelikleri; uçlardaki ~%2 değer bu sınırlara kırpılmış (q = 0 / 1000). Sınırdaki değerler ≥ / ≤ olarak gösterilir.',
  provenance: 'Ceyhun (Kangalactico) NASA GES DISC verisinden üretti; denetim: data/audit_ceyhun.md. Yalnız denetimden UYGUN çıkan katmanlar.',
  layers: keepIds.map((k, i) => ({ index: i, src: k, ...KEEP[k], transform: M.layers[k].transform === 'log' ? 'log1p' : 'linear', vmin: M.layers[k].vmin, vmax: M.layers[k].vmax, sourceLabel: M.layers[k].ad })),
};
fs.writeFileSync('public/data/m24/meta.json', JSON.stringify(meta, null, 1));
const sz = (f) => (fs.statSync(f).size / 1048576).toFixed(2) + ' MB';
console.log('katmanlar:', keepIds.join(', '));
console.log('monthly.bin', sz('public/data/m24/monthly.bin'), '| co2_daily.bin', sz('public/data/m24/co2_daily.bin'), '| deniz buzu: karada', masked, 'hücre "yok" yapıldı');
