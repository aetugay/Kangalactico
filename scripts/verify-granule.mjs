// Ham NASA verisiyle doğrulama: Ceyhun'un paketindeki değerleri GES DISC'teki özgün MERRA-2 granülüyle birkaç noktada karşılaştırır.
// OPeNDAP ".ascii" alt kümesi kullanılır (yalnız birkaç hücre iner; NetCDF/HDF5 kütüphanesi gerekmez).
// GEREKİR: Earthdata hesabı + "NASA GESDISC DATA ARCHIVE" uygulamasının onayı + kullanıcı klasöründe _netrc (Windows) / .netrc.
// Kullanım: node scripts/verify-granule.mjs            (sonuç: data/verify_granule.json)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const DIR = 'referans/v3';
const M = JSON.parse(fs.readFileSync(`${DIR}/meta.json`, 'utf8'));
const cube = new Int16Array(fs.readFileSync(`${DIR}/monthly_cube.bin`).buffer.slice(0));
const G = M.grid, NP = G.n_points, NLON = G.n_lon;
const netrc = ['_netrc', '.netrc'].map((f) => path.join(os.homedir(), f)).find((f) => fs.existsSync(f));
if (!netrc) { console.error('Earthdata girişi yok: kullanıcı klasöründe _netrc ya da .netrc bulunamadı. Adımlar: data/audit_ceyhun.md "Düzeltmeler".'); process.exit(2); }
const cookies = path.join(os.tmpdir(), 'earthear_urs_cookies.txt');

// MERRA-2 ızgarası: enlem −90…90 adım 0.5 (361), boylam −180…179.375 adım 0.625 (576)
const jOf = (lat) => Math.round((lat + 90) / 0.5), iOf = (lon) => ((Math.round((lon + 180) / 0.625) % 576) + 576) % 576;
const GROUP = { FIRE: ['M2TMNXAER', 'aer'], CO: ['M2TMNXCHM', 'chm'], AOD: ['M2TMNXAER', 'aer'], SO2: ['M2TMNXAER', 'aer'] };
const SCALE = { FIRE: 1e6 /* kg m-2 → mg/m² */, CO: 1 /* ppbv */, AOD: 1, SO2: 1e9 /* kg m-3 → µg/m³ */ };
const phys = (L, q) => (q < 0 ? NaN : L.transform === 'linear' ? L.vmin + (q / 1000) * (L.vmax - L.vmin) : Math.expm1(Math.log1p(L.vmin) + (q / 1000) * (Math.log1p(L.vmax) - Math.log1p(L.vmin))));
// noktalar: paket hücre merkezleri (2° × 2.5°); ham değer = o hücreyi kaplayan 0.5° × 0.625° hücrelerin ortalaması
const POINTS = [['Orta Afrika', -7, 21.25, 7], ['Güney Pasifik', -41, -121.25, 0], ['Doğu Çin', 33, 116.25, 0], ['Sahra', 23, 6.25, 6], ['Orta Avrupa', 49, 13.75, 0]];

function fetchBox(id, month, lat, lon) {
  const [coll, grp] = GROUP[id]; const ym = `2024${String(month + 1).padStart(2, '0')}`;
  const v = M.layers[id].kanit.netcdf_degiskeni;
  const j0 = jOf(lat - G.dlat / 2) + 1, j1 = jOf(lat + G.dlat / 2) - 1, i0 = iOf(lon - G.dlon / 2) + 1, i1 = iOf(lon + G.dlon / 2) - 1;
  const url = `https://goldsmr4.gesdisc.eosdis.nasa.gov/opendap/MERRA2_MONTHLY/${coll}.5.12.4/2024/MERRA2_400.tavgM_2d_${grp}_Nx.${ym}.nc4.ascii?${v}[0:0][${j0}:${j1}][${i0}:${i1}]`;
  const txt = execFileSync('curl', ['-s', '-f', '-L', '-n', '--netrc-file', netrc, '-c', cookies, '-b', cookies, url], { encoding: 'utf8', timeout: 60000 });
  const nums = [...txt.split('\n').slice(1).join(' ').matchAll(/-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g)].map((m) => +m[0]);
  // ilk satırlar dizin etiketleri; veri satırları "[0][k], v1, v2…" biçiminde → yalnız virgülden sonrakiler
  const vals = txt.split('\n').filter((l) => /^\[\d+\]\[\d+\],/.test(l)).flatMap((l) => l.split(',').slice(1).map(Number)).filter((x) => Number.isFinite(x) && Math.abs(x) < 1e14);
  return { url, raw: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : NaN, n: vals.length, _all: nums.length };
}

const out = [];
for (const id of ['AOD', 'SO2', 'FIRE', 'CO']) {
  const L = M.layers[id];
  for (const [name, lat, lon, month] of POINTS) {
    const p = Math.round((lat - G.lat0) / G.dlat) * NLON + Math.round((lon - G.lon0) / G.dlon);
    const pkg = phys(L, cube[(L.cube_offset_index * 12 + month) * NP + p]);
    try {
      const r = fetchBox(id, month, lat, lon); const raw = r.raw * SCALE[id];
      out.push({ katman: id, nokta: name, ay: month + 1, paket: +pkg.toPrecision(4), ham: +raw.toPrecision(4), oran: +(pkg / raw).toFixed(3), hamHucre: r.n });
      console.log(`${id.padEnd(4)} ${name.padEnd(13)} ay ${month + 1}: paket ${pkg.toPrecision(4)} · ham ${raw.toPrecision(4)} · oran ${(pkg / raw).toFixed(2)}`);
    } catch (e) { console.error(`${id} ${name}: indirilemedi (${String(e.message).split('\n')[0]}). Earthdata girişi ve GES DISC uygulama onayı gerekli.`); process.exit(3); }
  }
}
fs.writeFileSync('data/verify_granule.json', JSON.stringify(out, null, 1));
console.log('yazıldı: data/verify_granule.json — AOD/SO2 oranı ≈ 1 ise yöntem doğru; FIRE/CO oranı ≈ 1 değilse paket hatalı, ≈ 1 ise beklentimiz yanlış.');
