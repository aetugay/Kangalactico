// Ceyhun'un canlı API'si (sürüm 3) ile bizim statik dosyalarımızın (public/data/m24, referans/v3'ten) aynı veri olup olmadığını sınar.
// Kullanım: node scripts/compare-api.mjs   → data/api_v3_tutarlilik.json
// Karşılaştırılan: (a) API meta (sürüm, katmanlar, vmin/vmax/transform) ↔ referans/v3/meta.json,
//                  (b) /api/point-sonify serileri (q 0..1000) ↔ public/data/m24 (aylık + günlük CO₂) aynı nokta_id'de,
//                  (c) bizde olmayan katmanlar (CO, FIRE) referans/v3 küpüyle.
import fs from 'node:fs';
const B = 'https://jukebox-api-h5ve.onrender.com';
const get = async (p) => { const r = await fetch(B + p, { signal: AbortSignal.timeout(90000) }); if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`); return r.json(); };

const ours = JSON.parse(fs.readFileSync('public/data/m24/meta.json', 'utf8'));
const monthly = new Int16Array(fs.readFileSync('public/data/m24/monthly.bin').buffer.slice(0));
const daily = new Int16Array(fs.readFileSync('public/data/m24/co2_daily.bin').buffer.slice(0));
const ref = JSON.parse(fs.readFileSync('referans/v3/meta.json', 'utf8'));
const refCube = new Int16Array(fs.readFileSync('referans/v3/monthly_cube.bin').buffer.slice(0));
const NP = 12960;

const apiMeta = await get('/api/meta');
const metaCheck = { surum: apiMeta.surum, katmanSayisi: Object.keys(apiMeta.layers ?? apiMeta.katmanlar ?? {}).length, farklar: [] };
for (const [k, L] of Object.entries(ref.layers)) {
  const A = (apiMeta.layers ?? apiMeta.katmanlar)[k];
  if (!A) { metaCheck.farklar.push(`${k}: API'de yok`); continue; }
  for (const f of ['vmin', 'vmax', 'transform', 'cube_offset_index']) if (A[f] !== L[f]) metaCheck.farklar.push(`${k}.${f}: API ${A[f]} ≠ paket ${L[f]}`);
  if (JSON.stringify(A.kanit) !== JSON.stringify(L.kanit)) metaCheck.farklar.push(`${k}.kanit farklı`);
}

const PLACES = [['Sivas', 39.75, 37.02], ['Tokyo', 35.68, 139.69], ['Lagos', 6.45, 3.39], ['Amazon (Manaus)', -3.12, -60.02], ['Svalbard (Longyearbyen)', 78.22, 15.65]];
const rows = [];
for (const [name, lat, lon] of PLACES) {
  const j = await get(`/api/point-sonify?lat=${lat}&lon=${lon}`);
  const p = j.nokta_id;
  const row = { yer: name, nokta_id: p, apiLat: j.lat, apiLon: j.lon, katmanlar: {} };
  for (const [k, s] of Object.entries(j.seriler)) {
    const vals = s.degerler ?? [];
    const o = ours.layers.find((l) => l.src === k);
    let expect, kaynak;
    if (k === 'CO2' && vals.length === 365) { expect = Array.from({ length: 365 }, (_, d) => daily[d * NP + p]); kaynak = 'co2_daily.bin'; }
    else if (o) { expect = Array.from({ length: 12 }, (_, m) => monthly[(o.index * 12 + m) * NP + p]); kaynak = 'monthly.bin'; }
    else if (ref.layers[k]) { const li = ref.layers[k].cube_offset_index; expect = Array.from({ length: 12 }, (_, m) => refCube[(li * 12 + m) * NP + p]); kaynak = 'referans/v3 (uygulamada kapalı)'; }
    else { row.katmanlar[k] = { durum: 'bizde yok' }; continue; }
    if (vals.length !== expect.length) { row.katmanlar[k] = { durum: `uzunluk farklı: API ${vals.length}, biz ${expect.length}`, kaynak }; continue; }
    let diff = 0, maxd = 0, intended = 0;
    vals.forEach((v, i) => {
      let e = expect[i];
      if (k === 'SMAP' && e === -1 && v !== -1) { intended++; return; }          // bizim kaynağa dayalı deniz maskesi (bilinçli fark)
      if (k === 'SEAICE' && e === -1 && v === 0) { intended++; return; }         // karadaki 0 → -1 (bilinçli fark)
      if (v !== e) { diff++; maxd = Math.max(maxd, Math.abs(v - e)); }
    });
    row.katmanlar[k] = { n: vals.length, farkli: diff, enBuyukFarkQ: maxd, bilincliMaskeFarki: intended, kaynak };
  }
  rows.push(row);
  const bad = Object.entries(row.katmanlar).filter(([, v]) => v.farkli > 0 || v.durum);
  console.log(`${name.padEnd(24)} nokta ${p} (${j.lat}, ${j.lon}): ${Object.keys(row.katmanlar).length} seri, ${bad.length ? 'FARK: ' + bad.map(([k, v]) => `${k} ${v.durum ?? v.farkli + ' değer'}`).join('; ') : 'hepsi birebir aynı'}`
    + (Object.values(row.katmanlar).some((v) => v.bilincliMaskeFarki) ? ` (bilinçli maske farkı: ${Object.entries(row.katmanlar).filter(([, v]) => v.bilincliMaskeFarki).map(([k, v]) => `${k} ${v.bilincliMaskeFarki}`).join(', ')})` : ''));
}
console.log('API meta: sürüm', metaCheck.surum, '·', metaCheck.katmanSayisi, 'katman ·', metaCheck.farklar.length ? 'FARK: ' + metaCheck.farklar.join('; ') : 'paket meta.json ile aynı (vmin/vmax/transform/sıra/kanıt)');
fs.writeFileSync('data/api_v3_tutarlilik.json', JSON.stringify({ tarih: new Date().toISOString(), api: B, meta: metaCheck, noktalar: rows }, null, 1));
console.log('yazıldı: data/api_v3_tutarlilik.json');
