// Ceyhun'un veri paketi denetimi (referans/, git'e girmez).
// Kullanım: node scripts/audit-ceyhun.mjs [klasör]   (varsayılan referans/v3; v2 için: referans)
// Çıktı: data/audit_ceyhun_v<sürüm>.json (tablo için ham ölçümler). Değer UYDURMAZ: dönüşümü belirsiz olan her şey ayrı işaretlenir.
import fs from 'node:fs';

const DIR = process.argv[2] ?? 'referans/v3';
const M = JSON.parse(fs.readFileSync(`${DIR}/meta.json`, 'utf8'));
const VER = M.surum ?? 2;
const G = M.grid; const NP = G.n_points, NLAT = G.n_lat, NLON = G.n_lon;
// katman sırası: v3'te her katmanın cube_offset_index'i; yoksa katman_sirasi
const L = M.layers && Object.values(M.layers).every((x) => Number.isInteger(x.cube_offset_index))
  ? Object.entries(M.layers).sort((a, b) => a[1].cube_offset_index - b[1].cube_offset_index).map(([k]) => k)
  : M.aylik_kup.katman_sirasi;
if (L.join() !== M.aylik_kup.katman_sirasi.join()) console.warn('UYARI: cube_offset_index sırası katman_sirasi ile farklı');
const cube = new Int16Array(fs.readFileSync(`${DIR}/monthly_cube.bin`).buffer.slice(0));
if (cube.length !== L.length * 12 * NP) throw new Error(`küp boyu ${cube.length} ≠ ${L.length}×12×${NP}`);
const dailyCO2 = new Int16Array(fs.readFileSync(`${DIR}/daily_CO2.bin`).buffer.slice(0));
const dailyFIRE = fs.existsSync(`${DIR}/daily_FIRE.bin`) ? new Int16Array(fs.readFileSync(`${DIR}/daily_FIRE.bin`).buffer.slice(0)) : null;
const q = (layer, month, p) => cube[(layer * 12 + month) * NP + p];
const latOf = (p) => G.lat0 + Math.floor(p / NLON) * G.dlat, lonOf = (p) => G.lon0 + (p % NLON) * G.dlon;

/** Normalize (0..1000) → gerçek birim. linear: kesin. log: iki yorum (log10 ve log1p) — hangisi olduğu meta'da YOK. */
function phys(meta, qq) {
  const t = qq / 1000, a = meta.vmin, b = meta.vmax;
  if (meta.transform === 'linear') return { lin: a + t * (b - a) };
  const v1 = a > 0 ? Math.exp(Math.log(a) + t * (Math.log(b) - Math.log(a))) : NaN;          // log
  const v2 = Math.expm1(Math.log1p(a) + t * (Math.log1p(b) - Math.log1p(a)));                 // log1p
  return { log: v1, log1p: v2 };
}

const out = { grid: G, layers: {} };
// --- katman başına
for (let li = 0; li < L.length; li++) {
  const id = L[li], meta = M.layers[id];
  let miss = 0, n = 0, qmin = 1e9, qmax = -1e9;
  const sums = { lin: 0, log: 0, log1p: 0 }; let cnt = 0;
  let landN = 0, seaN = 0;
  const monthMeans = [];
  for (let m = 0; m < 12; m++) {
    let s = 0, c = 0;
    for (let p = 0; p < NP; p++) {
      const v = q(li, m, p); n++;
      if (v === -1) { miss++; continue; }
      if (v < qmin) qmin = v; if (v > qmax) qmax = v;
      const ph = phys(meta, v); for (const k of Object.keys(ph)) sums[k] += ph[k]; cnt++;
      s += v; c++;
    }
    monthMeans.push(c ? s / c : NaN);
  }
  // aylar arası değişim: noktaların ay-ay ortalama mutlak farkı (normalize birimde)
  let dsum = 0, dc = 0, constPts = 0, validPts = 0;
  for (let p = 0; p < NP; p++) {
    let allSame = true, any = false;
    for (let m = 1; m < 12; m++) { const a = q(li, m - 1, p), b = q(li, m, p); if (a === -1 || b === -1) continue; any = true; dsum += Math.abs(b - a); dc++; if (Math.abs(b - a) > 3) allSame = false; }
    if (any) { validPts++; if (allSame) constPts++; }
  }
  const mean = Object.fromEntries(Object.entries(sums).filter(([k]) => meta.transform === 'linear' ? k === 'lin' : k !== 'lin').map(([k, s]) => [k, +(s / cnt).toPrecision(5)]));
  out.layers[id] = { ad: meta.ad, birim: meta.birim, kaynak: meta.kaynak, transform: meta.transform, vmin: meta.vmin, vmax: meta.vmax,
    eksikOran: +(miss / n).toFixed(4), qmin, qmax, ortalama: mean, aylikOrtQ: monthMeans.map((x) => +x.toFixed(1)),
    ayArasiOrtFarkQ: +(dsum / dc).toFixed(2), neredeyseSabitNoktaOran: +(constPts / validPts).toFixed(3) };
}

// --- kopya taraması: tüm katman çiftleri (aynı hücrelerde birebir eşitlik oranı + korelasyon)
const dup = [];
for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) {
  let eq = 0, both = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (let i = 0; i < 12 * NP; i++) {
    const x = cube[a * 12 * NP + i], y = cube[b * 12 * NP + i];
    if (x === -1 || y === -1) continue; both++; if (x === y) eq++;
    sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y;
  }
  const r = (both * sab - sa * sb) / Math.sqrt((both * saa - sa * sa) * (both * sbb - sb * sb));
  if (eq / both > 0.5 || r > 0.97) dup.push({ a: L[a], b: L[b], birebirEsitOran: +(eq / both).toFixed(4), r: +r.toFixed(4), ortakNokta: both });
}
out.kopyalar = dup;

// --- günlük seriler: gerçek günlük mü, aylıktan ara değer mi? (ikinci fark ~0 → doğrusal ara değer)
function dailyCheck(arr, name) {
  let linDays = 0, total = 0, exactZero = 0;
  const rnd = [];
  for (let p = 0; p < NP; p += 37) {
    for (let d = 1; d < 364; d++) {
      const a = arr[(d - 1) * NP + p], b = arr[d * NP + p], c = arr[(d + 1) * NP + p];
      if (a === -1 || b === -1 || c === -1) continue;
      total++; const dd = Math.abs(a - 2 * b + c); if (dd <= 1) linDays++; if (dd === 0) exactZero++;
    }
  }
  // aylık küp ile ilişki: günlük serinin ay ortalaması aylık değere eşit mi?
  const li = L.indexOf(name); let mdiff = 0, mc = 0;
  const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // 2024 artık yıl
  for (let p = 0; p < NP; p += 37) { let d0 = 0; for (let m = 0; m < 12; m++) { let s = 0, c = 0; for (let d = d0; d < d0 + days[m]; d++) { const v = arr[d * NP + p]; if (v !== -1) { s += v; c++; } } d0 += days[m]; const mv = q(li, m, p); if (c && mv !== -1) { mdiff += Math.abs(s / c - mv); mc++; } } }
  return { ikinciFarkSifiraYakinOran: +(linDays / total).toFixed(3), ikinciFarkTamSifirOran: +(exactZero / total).toFixed(3), gunlukAyOrt_vs_aylik_ortMutlakFarkQ: +(mdiff / mc).toFixed(2) };
}
out.gunluk = { CO2: dailyCheck(dailyCO2, 'CO2'), ...(dailyFIRE && L.includes('FIRE') ? { FIRE: dailyCheck(dailyFIRE, 'FIRE') } : {}) };

// --- bağımsız mekânsal karşılaştırma (bizim NASA kaynaklı ızgaralarımızla)
function corr(xs, ys) { let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0; for (let i = 0; i < xs.length; i++) { const x = xs[i], y = ys[i]; if (!Number.isFinite(x) || !Number.isFinite(y)) continue; n++; sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y; } return n > 10 ? { r: +((n * sab - sa * sb) / Math.sqrt((n * saa - sa * sa) * (n * sbb - sb * sb))).toFixed(3), n } : null; }
const ours = (file) => JSON.parse(fs.readFileSync(`public/data/${file}`, 'utf8'));
const b64 = (s) => new Uint8Array(Buffer.from(s, 'base64'));
function oursAt(J, layerObj, frame, lat, lon) { // 1° ızgara hücresi
  const bytes = layerObj._bytes || (layerObj._bytes = b64(layerObj.data)); const W = 360, H = 180;
  const i = Math.min(W - 1, Math.floor(lon + 180)), j = Math.min(H - 1, Math.floor(90 - lat)); const qv = bytes[frame * W * H + j * W + i];
  if (qv === 255) return NaN; const Q = layerObj.quant; return Q.encoding === 'sqrt' ? Q.max * (qv / 254) ** 2 : Q.offset + qv * Q.scale;
}
const cmp = {};
if (L.includes('NIGHTLIGHTS')) { // NIGHTLIGHTS vs SVS 5313 Black Marble 2023 parlaklığı (bizim ızgara)
  const J = ours('5313.json'); const Y = J.layers.years; const fr = Y.list.indexOf(2023);
  const li = L.indexOf('NIGHTLIGHTS'); const xs = [], ys = [];
  for (let p = 0; p < NP; p++) { const v = q(li, 0, p); if (v === -1) continue; const o = oursAt(J, Y, fr, latOf(p), lonOf(p)); xs.push(v); ys.push(o); }
  cmp.NIGHTLIGHTS_vs_SVS5313_2023 = corr(xs, ys);
  // ayrıca okyanus üstünde (bizim ızgarada parlaklık ~0) NIGHTLIGHTS ne diyor?
  let ocean = [], land = []; for (let k = 0; k < xs.length; k++) (ys[k] < 3 ? ocean : land).push(xs[k]);
  cmp.NIGHTLIGHTS_karanlikHucrelerdeOrtQ = ocean.length ? +(ocean.reduce((a, b) => a + b, 0) / ocean.length).toFixed(1) : null;
  cmp.NIGHTLIGHTS_isikliHucrelerdeOrtQ = land.length ? +(land.reduce((a, b) => a + b, 0) / land.length).toFixed(1) : null;
}
{ // CO2 2024 Ocak vs ekip OCO-2 2021 Ocak (mekânsal desen)
  const J = ours('co2_2021_grid.json'); const g = J.grid; const li = L.indexOf('CO2'); const xs = [], ys = [];
  for (let p = 0; p < NP; p++) { const v = q(li, 0, p); if (v === -1) continue; const lat = latOf(p), lon = lonOf(p);
    const k = Math.round((lat - g.lat0) / g.dLat), i = ((Math.round((lon - g.lon0) / g.dLon) % g.nLon) + g.nLon) % g.nLon;
    if (k < 0 || k >= g.nLat) continue; xs.push(v); ys.push(400 + J.values[0][k * g.nLon + i] / 100); }
  cmp.CO2_2024Ocak_vs_OCO2_2021Ocak = corr(xs, ys);
}
{ // SST vs SVS 3912 ECCO2 (2007, farklı yıl — yalnız desen)
  const J = ours('3912.json'); const li = L.indexOf('SST'); const xs = [], ys = [];
  for (let p = 0; p < NP; p++) { const v = q(li, 0, p); if (v === -1) continue; xs.push(M.layers.SST.vmin + v / 1000 * (M.layers.SST.vmax - M.layers.SST.vmin)); ys.push(oursAt(J, J, 0, latOf(p), lonOf(p))); }
  cmp.SST_vs_SVS3912 = corr(xs, ys);
}
{ // TEMP vs SVS 5147 GEOS-FP T2M (Kasım 2026, farklı zaman — yalnız desen)
  const J = ours('5147.json'); const li = L.indexOf('TEMP'); const xs = [], ys = [];
  for (let p = 0; p < NP; p++) { const v = q(li, 10, p); if (v === -1) continue; xs.push(M.layers.TEMP.vmin + v / 1000 * (M.layers.TEMP.vmax - M.layers.TEMP.vmin)); ys.push(oursAt(J, J, 0, latOf(p), lonOf(p))); }
  cmp.TEMP_Kasim_vs_SVS5147 = corr(xs, ys);
}
out.karsilastirma = cmp;

// --- kara/deniz kapsamı (SVS 5544 kara maskesiyle): IMERG/SMAP/GRACE kara-yalnız mı, SST/CHL deniz-yalnız mı, LST her yerde mi?
{
  const Lm = JSON.parse(fs.readFileSync('public/data/land_mask.json', 'utf8')); const bits = b64(Lm.data);
  const isLand = (lat, lon) => { const i = ((Math.floor(((lon + 180) / 360) * Lm.w) % Lm.w) + Lm.w) % Lm.w, j = Math.max(0, Math.min(Lm.h - 1, Math.floor(((90 - lat) / 180) * Lm.h))); const c = j * Lm.w + i; return (bits[c >> 3] >> (c & 7) & 1) === 1; };
  for (const id of L) {
    const li = L.indexOf(id); let lv = 0, lt = 0, sv = 0, st = 0;
    for (let p = 0; p < NP; p++) { const land = isLand(latOf(p), lonOf(p)); const ok = q(li, 0, p) !== -1; if (land) { lt++; if (ok) lv++; } else { st++; if (ok) sv++; } }
    out.layers[id].karaKapsam = +(lv / lt).toFixed(3); out.layers[id].denizKapsam = +(sv / st).toFixed(3);
  }
}
// ================= v3 ek kontrolleri =================
const physV = (meta, qq) => { if (qq < 0) return NaN; const t = qq / 1000, a = meta.vmin, b = meta.vmax;
  return meta.transform === 'linear' ? a + t * (b - a) : Math.expm1(Math.log1p(a) + t * (Math.log1p(b) - Math.log1p(a))); }; // log → log1p (v2 denetimi)
for (let li = 0; li < L.length; li++) {
  const id = L[li], meta = M.layers[id], o = out.layers[id];
  // kırpma: uçlarda yığılma (q = 0 ya da 1000) oranı
  let z = 0, top = 0, valid = 0; for (let i = 0; i < 12 * NP; i++) { const v = cube[li * 12 * NP + i]; if (v < 0) continue; valid++; if (v === 0) z++; if (v === 1000) top++; }
  o.ucYigilma = { q0: +(z / valid).toFixed(4), q1000: +(top / valid).toFixed(4) };
  // enlem-yalnız mı: her ay için enlem ortalaması modelinin açıkladığı varyans (R²)
  let ssTot = 0, ssRes = 0;
  for (let m = 0; m < 12; m++) {
    const rowMean = new Float64Array(NLAT), rowN = new Float64Array(NLAT); let gs = 0, gn = 0;
    for (let p = 0; p < NP; p++) { const v = q(li, m, p); if (v < 0) continue; const k = Math.floor(p / NLON); rowMean[k] += v; rowN[k]++; gs += v; gn++; }
    for (let k = 0; k < NLAT; k++) rowMean[k] = rowN[k] ? rowMean[k] / rowN[k] : 0;
    const gm = gs / gn;
    for (let p = 0; p < NP; p++) { const v = q(li, m, p); if (v < 0) continue; ssTot += (v - gm) ** 2; ssRes += (v - rowMean[Math.floor(p / NLON)]) ** 2; }
  }
  o.enlemR2 = +(1 - ssRes / ssTot).toFixed(4);
  // fiziksel istatistik (gerçek birim; log → log1p)
  const vals = []; for (let i = 0; i < 12 * NP; i++) { const v = cube[li * 12 * NP + i]; if (v >= 0) vals.push(physV(meta, v)); }
  vals.sort((a, b) => a - b); const pc = (x) => +vals[Math.floor(x * (vals.length - 1))].toPrecision(5);
  o.fiziksel = { min: pc(0), p02: pc(0.02), medyan: pc(0.5), p98: pc(0.98), max: pc(1), ort: +(vals.reduce((a, b) => a + b, 0) / vals.length).toPrecision(5) };
  const k = meta.kanit ?? {};
  o.kanitEksik = ['nasa_koleksiyon', 'netcdf_degiskeni', 'nasa_long_name', 'orijinal_birim', 'ornek_granul_dosyasi'].filter((x) => !k[x]);
  o.kanit = k;
}
// granül adı ↔ koleksiyon ↔ değişken uyumu (MERRA-2 dosya adlandırması ve o dosyadaki bilinen değişkenler)
const MERRA = { slv: ['M2TMNXSLV', ['T2M', 'TS', 'TO3', 'T10M', 'QV2M', 'PS', 'SLP', 'U10M', 'V10M']], aer: ['M2TMNXAER', ['TOTEXTTAU', 'SO2SMASS', 'BCCMASS', 'DUCMASS', 'SSSMASS', 'SO4SMASS', 'OCCMASS']],
  chm: ['M2TMNXCHM', ['COSC', 'COCL']], rad: ['M2TMNXRAD', ['ALBEDO', 'SWGDN', 'LWGNT']], ocn: ['M2TMNXOCN', ['TSKINWTR', 'FRSEAICE']], lnd: ['M2TMNXLND', ['GWETTOP', 'GWETROOT', 'PRECTOTLAND', 'TWLAND', 'LAI', 'SNOMAS']] };
for (const id of L) {
  const k = M.layers[id].kanit ?? {}, g = k.ornek_granul_dosyasi ?? '', o = out.layers[id];
  const mm = g.match(/^MERRA2_(\d)00\.tavgM_2d_(slv|aer|chm|rad|ocn|lnd)_Nx\.(\d{4})(\d{2})\.nc4$/);
  const oco = g.match(/^oco2_GEOS_L3CO2_day_(\d{4})(\d{2})(\d{2})_B\w+\.nc4$/);
  if (mm) { const [short, vars] = MERRA[mm[2]]; o.granul = { gecerliAd: true, yil: +mm[3], gercekKisaAd: short, koleksiyonAdiAyni: k.nasa_koleksiyon === short, koleksiyonOneki: (k.nasa_koleksiyon ?? '').startsWith(short), degiskenBuDosyada: vars.includes(k.netcdf_degiskeni) }; }
  else if (oco) o.granul = { gecerliAd: true, yil: +oco[1], gercekKisaAd: 'OCO2_GEOS_L3CO2_DAY', koleksiyonAdiAyni: k.nasa_koleksiyon === 'OCO2_GEOS_L3CO2_DAY', degiskenBuDosyada: k.netcdf_degiskeni === 'XCO2' };
  else o.granul = { gecerliAd: false };
}
// soruya özel ölçümler (bölge ortalaması ve en büyüğü, gerçek birim)
const at = (id, m, lat0, lat1, lon0, lon1) => { const li = L.indexOf(id), meta = M.layers[id]; let s = 0, c = 0, mx = -Infinity;
  for (let p = 0; p < NP; p++) { const la = latOf(p), lo = lonOf(p); if (la < lat0 || la > lat1 || lo < lon0 || lo > lon1) continue; const v = physV(meta, q(li, m, p)); if (Number.isNaN(v)) continue; s += v; c++; mx = Math.max(mx, v); }
  return { ort: +(s / c).toFixed(2), max: +mx.toFixed(2), n: c }; };
const v3 = {};
if (L.includes('TEMP')) { v3.Sahra_Temmuz_T2M = at('TEMP', 6, 18, 30, -5, 30); v3.Sahra_Temmuz_TS = L.includes('LST') ? at('LST', 6, 18, 30, -5, 30) : null; }
if (L.includes('O3')) { v3.O3_Ocak_tropik = at('O3', 0, -20, 20, -180, 180); v3.O3_Ekim_Antarktika = at('O3', 9, -89, -65, -180, 180); v3.O3_Mart_Arktik = at('O3', 2, 65, 89, -180, 180); }
if (L.includes('CO')) { v3.CO_Agustos_OrtaAfrika = at('CO', 7, -15, 5, 10, 35); v3.CO_Ocak_GuneyPasifik = at('CO', 0, -50, -30, -150, -100); v3.CO_Ocak_DoguCin = at('CO', 0, 28, 40, 105, 122); }
if (L.includes('FIRE')) { v3.BC_Agustos_OrtaAfrika = at('FIRE', 7, -15, 5, 10, 35); v3.BC_Ocak_GuneyPasifik = at('FIRE', 0, -50, -30, -150, -100); }
if (L.includes('GRACE')) { const li = L.indexOf('GRACE'); let pos = 0, neg = 0; for (let i = 0; i < 12 * NP; i++) { const v = cube[li * 12 * NP + i]; if (v < 0) continue; const x = physV(M.layers.GRACE, v); if (x > 0) pos++; else if (x < 0) neg++; } v3.GRACE_isaret = { pozitif: pos, negatif: neg }; }
// günlük CO2: hangi yıl? ekip OCO-2 2021 paketinin 1 Ocak'ı (co2_2021_grid ay 0 = ayın 1. günü) ile karşılaştır
{ const J = ours('co2_2021_grid.json'), g = J.grid, meta = M.layers.CO2; const xs = [], ys = []; let maxd = 0;
  for (let p = 0; p < NP; p++) { const v = dailyCO2[p]; if (v < 0) continue; const lat = latOf(p), lon = lonOf(p);
    const kk = Math.round((lat - g.lat0) / g.dLat), ii = ((Math.round((lon - g.lon0) / g.dLon) % g.nLon) + g.nLon) % g.nLon; if (kk < 0 || kk >= g.nLat) continue;
    const a = meta.vmin + v / 1000 * (meta.vmax - meta.vmin), b = 400 + J.values[0][kk * g.nLon + ii] / 100; xs.push(a); ys.push(b); maxd = Math.max(maxd, Math.abs(a - b)); }
  v3.gunlukCO2_gun1_vs_ekip2021_1Ocak = { ...corr(xs, ys), maxFarkPpm: +maxd.toFixed(2) };
  v3.gunlukCO2_baslangic = M.layers.CO2.gunluk?.baslangic ?? null; }
out.v3 = v3; out.surum = VER; out.presets = M.presets ?? null;
const outFile = `data/audit_ceyhun_v${VER}.json`;
fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log('yazıldı:', outFile);

