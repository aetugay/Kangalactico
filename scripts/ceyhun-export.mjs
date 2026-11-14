// Ceyhun'un paketinden (sürüm 3) YALNIZCA denetimden "UYGUN" çıkan katmanları statik dosyalara aktarır (API kullanılmaz;
// canlı API hâlâ sürüm 2'yi veriyor → uygulamada API yedeği sürüm 3'e geçene kadar KAPALI).
// Girdi : referans/v3/meta.json, monthly_cube.bin [15,12,12960], daily_CO2.bin [365,12960] (git'e girmez)
// Çıktı : public/data/m24/meta.json, monthly.bin ([katman][ay][12960] int16 LE, 0..1000, -1 = eksik), co2_daily.bin ([365][12960])
// Denetim: node scripts/audit-ceyhun.mjs referans/v3 → data/audit_ceyhun_v3.json; özet: data/audit_ceyhun.md ("v3 denetimi")
import fs from 'node:fs';

const DIR = process.argv[2] ?? 'referans/v3';
const M = JSON.parse(fs.readFileSync(`${DIR}/meta.json`, 'utf8'));
if (M.surum !== 3) throw new Error(`sürüm 3 bekleniyordu, gelen: ${M.surum}`);
const G = M.grid, NP = G.n_points, NLON = G.n_lon;
// katman sırası cube_offset_index'ten
const ORDER = Object.entries(M.layers).sort((a, b) => a[1].cube_offset_index - b[1].cube_offset_index).map(([k]) => k);
const cube = new Int16Array(fs.readFileSync(`${DIR}/monthly_cube.bin`).buffer.slice(0));
if (cube.length !== ORDER.length * 12 * NP) throw new Error('küp boyu tutmuyor');

// UYGUN katmanlar; adlar kanıttaki GERÇEK kaynağa göre (paketteki anahtar adı yanıltıcıysa düzeltildi).
// transform 'log' → log1p ters dönüşümü (meta'da yazmıyor; AOD ve yağış küresel ortalamaları yalnız log1p ile makul — v2 denetimi).
const KEEP = {
  CO2: { id: 'co2_24', tr: 'Atmosferik CO₂ (sütun ortalaması, aylık ort.)', en: 'Atmospheric CO₂ (column average, monthly mean)', unit: 'ppm', nasa: 'SVS 5115, 5110, 5119 (OCO-2 / GEOS CO₂)', daily: true },
  TEMP: { id: 't2m_24', tr: '2 m hava sıcaklığı', en: '2 m air temperature', unit: '°C', nasa: 'SVS 5147 (GEOS-FP T2M), 5191 (MERRA-2)' },
  LST: { id: 'ts_24', tr: 'Yüzey deri sıcaklığı (kara + deniz)', en: 'Surface skin temperature (land + sea)', unit: '°C', nasa: 'konu: SVS 5147', note: 'Uydu LST değil; MERRA-2 deri sıcaklığı (TS). 2 m hava sıcaklığıyla r = 0.999.' },
  O3: { id: 'o3_24', tr: 'Toplam sütun ozonu', en: 'Total column ozone', unit: 'DU', nasa: 'konu: NASA Ozone Watch; ürün ailesi MERRA-2: SVS 4960, 5191', note: 'v3\'te gerçek veri: Ekim\'de Antarktika ozon deliği, Mart\'ta Arktik maksimumu görülüyor (v2\'de enleme bağlı formüldü).' },
  AOD: { id: 'aod_24', tr: 'Aerosol optik derinliği (550 nm)', en: 'Aerosol optical depth (550 nm)', unit: '', nasa: 'konu: SVS 5669 (GEOS aerosoller), Air Quality 40529' },
  SO2: { id: 'so2_24', tr: 'Yüzey SO₂ kütle derişimi', en: 'Surface SO₂ mass concentration', unit: 'µg/m³', nasa: 'konu: SVS 4810 (SO₂); ürün ailesi MERRA-2' },
  ALBEDO: { id: 'albedo_24', tr: 'Yüzey albedosu (yansıtma oranı)', en: 'Surface albedo', unit: '0–1', nasa: 'konu EIC\'de doğrudan yok; ürün ailesi MERRA-2' },
  SST: { id: 'sst_24', tr: 'Açık su yüzeyi (deri) sıcaklığı', en: 'Open-water skin temperature', unit: '°C', nasa: 'SVS 5101, 5176 (MUR SST), 3912 (ECCO2)' },
  SEAICE: { id: 'seaice_24', tr: 'Deniz buzu oranı', en: 'Sea-ice fraction', unit: '%', nasa: 'SVS 5046, 5064, 5099, 5382 (deniz buzu)', note: 'Karadaki 0 değerleri "veri yok" yapıldı.' },
  IMERG: { id: 'precip_24', tr: 'Kara üstü toplam yağış', en: 'Total precipitation over land', unit: 'mm/gün', nasa: 'konu: SVS 4285, 4897 (IMERG), 5149', note: 'Paketteki anahtar "IMERG"; gerçek kaynak MERRA-2 model yağışı PRECTOTLAND (yalnız kara), IMERG uydu ürünü değil.' },
  GRACE: { id: 'twland_24', tr: 'Kara su depolaması: 2024 ortalamasından aylık fark', en: 'Land water storage: monthly departure from 2024 mean', unit: 'kg/m²', nasa: 'konu: GRACE (SVS 4637, 5003) — bu katman GRACE DEĞİL', note: 'Paketteki anahtar "GRACE"; gerçek kaynak MERRA-2 TWLAND (model). Değerler her hücrenin 2024 ortalamasına göre fark (denetimde doğrulandı: hücre 12-ay ortalaması ≈ 0). 1 kg/m² = 1 mm su.' },
  SMAP: { id: 'gwettop_24', tr: 'Üst toprak nemi (MERRA-2 GWETTOP)', en: 'Topsoil wetness (MERRA-2 GWETTOP)', unit: '0–1', nasa: 'konu: SMAP toprak nemi (SVS 4950 vb.) — bu katman SMAP uydusu DEĞİL, model', note: 'Paketteki anahtar "SMAP"; gerçek kaynak MERRA-2 GWETTOP (model üst toprak nemliliği, 0 = kuru, 1 = doygun; özgün birim "1", boyutsuz). DÜZELTME: pakette deniz hücreleri 1.0 dolgu değeriyle gelmişti; aynı MERRA-2 lnd dosyasının kara tanımına (PRECTOTLAND/TWLAND/LAI boş olan hücreler) göre "veri yok" yapıldı → denizde sessiz.' },
  NDVI: { id: 'lai_24', tr: 'Yaprak alanı indeksi', en: 'Leaf area index', unit: 'm²/m²', nasa: 'konu: SVS 5544 (NDVI) — bu katman NDVI DEĞİL', note: 'Paketteki anahtar "NDVI"; gerçek kaynak MERRA-2 LAI (model yaprak alanı), uydu NDVI değil.' },
};
// KAPALI (uygulamada yok): CO, FIRE (BCCMASS) — gerekçe data/audit_ceyhun.md "Düzeltmeler"
const yearOf = (g) => { const m = g.match(/\.(\d{4})\d{2}\.nc4$/) ?? g.match(/_(\d{4})\d{4}_/); return m ? +m[1] : null; };
const shortOf = (g, fallback) => { const m = g.match(/tavgM_2d_(slv|aer|chm|rad|ocn|lnd)_Nx/); return m ? `M2TMNX${m[1].toUpperCase()}` : fallback; };

const Lm = JSON.parse(fs.readFileSync('public/data/land_mask.json', 'utf8'));
const bits = new Uint8Array(Buffer.from(Lm.data, 'base64'));
const isLand = (lat, lon) => { const i = ((Math.floor(((lon + 180) / 360) * Lm.w) % Lm.w) + Lm.w) % Lm.w, j = Math.max(0, Math.min(Lm.h - 1, Math.floor(((90 - lat) / 180) * Lm.h))); const c = j * Lm.w + i; return (bits[c >> 3] >> (c & 7) & 1) === 1; };

const keepIds = ORDER.filter((k) => KEEP[k]);
const out = new Int16Array(keepIds.length * 12 * NP);
let masked = 0, smapMasked = 0;
keepIds.forEach((k, ni) => {
  const li = M.layers[k].cube_offset_index;
  for (let m = 0; m < 12; m++) for (let p = 0; p < NP; p++) {
    let v = cube[(li * 12 + m) * NP + p];
    // SMAP (GWETTOP) düzeltmesi: aynı lnd dosyasında kara dışı (PRECTOTLAND = -1) hücreler deniz dolgusu 1.0 → -1
    if (k === 'SMAP' && cube[(M.layers.IMERG.cube_offset_index * 12 + m) * NP + p] === -1) { if (v !== -1) smapMasked++; v = -1; }
    if (k === 'SEAICE' && v === 0) { const lat = G.lat0 + Math.floor(p / NLON) * G.dlat, lon = G.lon0 + (p % NLON) * G.dlon; if (isLand(lat, lon)) { v = -1; masked++; } }
    out[(ni * 12 + m) * NP + p] = v;
  }
});
fs.mkdirSync('public/data/m24', { recursive: true });
fs.writeFileSync('public/data/m24/monthly.bin', Buffer.from(out.buffer));
fs.copyFileSync(`${DIR}/daily_CO2.bin`, 'public/data/m24/co2_daily.bin');

const idOf = Object.fromEntries(keepIds.map((k) => [k, KEEP[k].id]));
const presets = Object.entries(M.presets ?? {}).map(([key, p]) => {
  const all = Object.keys(p.katmanlar);
  return { key, ad: p.ad.replace(/^\p{Extended_Pictographic}\s*/u, ''), layers: all.filter((k) => KEEP[k]).map((k) => idOf[k]), removed: all.filter((k) => !KEEP[k]) };
});
const dailyStart = M.layers.CO2.gunluk?.baslangic ?? '2021-01-01';
const meta = {
  surum: 3, year: 2024,
  months: M.aylik_kup.aylar ?? ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
  grid: { nLat: G.n_lat, nLon: G.n_lon, lat0: G.lat0, dLat: G.dlat, lon0: G.lon0, dLon: G.dlon, cell: '2° × 2.5°', order: 'indeks = i_lat·144 + i_lon (i_lat güneyden)' },
  encoding: 'int16 little-endian; q ∈ 0..1000; -1 = veri yok. Gerçek değer: linear → vmin + q/1000·(vmax−vmin); log → expm1(log1p(vmin) + q/1000·(log1p(vmax)−log1p(vmin)))',
  files: { monthly: 'monthly.bin', monthlyShape: [keepIds.length, 12, NP], co2Daily: 'co2_daily.bin', co2DailyShape: [365, NP], co2DailyStart: dailyStart,
    co2DailyNote: `Günlük CO₂ ${dailyStart.slice(0, 4)} yılına ait (OCO2_GEOS_L3CO2_DAY; 365 gün). Ekip OCO-2 ${dailyStart.slice(0, 4)} paketinin 1 Ocak'ıyla r = 0.997.` },
  clipped: !!M.uc_degerler_kirpildi_mi,
  clipping: M.uc_degerler_kirpildi_mi ? 'Uç değerler kırpılmış.' : 'Sürüm 3: uç değer kırpması yok (denetimde doğrulandı: Sahra Temmuz 2 m sıcaklığı ort. 34 °C, en çok 40 °C).',
  provenance: 'Ceyhun (Kangalactico) NASA GES DISC NetCDF4 dosyalarından üretti (paket sürüm 3). Yalnız denetimden UYGUN çıkan katmanlar. API yedeği sürüm 3\'e geçene kadar kapalı.',
  presets,
  layers: keepIds.map((k, i) => {
    const L = M.layers[k], kan = L.kanit ?? {};
    return { index: i, src: k, ...KEEP[k], product: shortOf(kan.ornek_granul_dosyasi ?? '', kan.nasa_koleksiyon), variable: kan.netcdf_degiskeni,
      year: yearOf(kan.ornek_granul_dosyasi ?? '') ?? 2024, transform: L.transform === 'log' ? 'log1p' : 'linear', vmin: L.vmin, vmax: L.vmax, signed: !!L.signed, sourceLabel: L.ad,
      kanit: { nasa_koleksiyon: kan.nasa_koleksiyon, netcdf_degiskeni: kan.netcdf_degiskeni, nasa_long_name: kan.nasa_long_name, orijinal_birim: kan.orijinal_birim, ornek_granul_dosyasi: kan.ornek_granul_dosyasi, dosya_sayisi: kan.dosya_sayisi } };
  }),
};
fs.writeFileSync('public/data/m24/meta.json', JSON.stringify(meta, null, 1));
const sz = (f) => (fs.statSync(f).size / 1048576).toFixed(2) + ' MB';
console.log('katmanlar:', keepIds.map((k) => `${k}→${KEEP[k].id} (${meta.layers.find((l) => l.src === k).year})`).join(', '));
console.log('presetler:', presets.map((p) => `${p.ad}: ${p.layers.join('+')}${p.removed.length ? ' (çıkarıldı: ' + p.removed.join(', ') + ')' : ''}`).join(' | '));
console.log('monthly.bin', sz('public/data/m24/monthly.bin'), '| co2_daily.bin', sz('public/data/m24/co2_daily.bin'), '| deniz buzu: karada', masked, 'hücre "yok" | toprak nemi: denizde', smapMasked, 'hücre-ay "yok"');
