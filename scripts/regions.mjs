// Ters coğrafi kodlama için bölge dosyası: Natural Earth (kamu malı) 110m admin-0 ülkeleri + 50m deniz/okyanus bölgeleri, TR/EN adlarıyla.
// Girdi : raw/natural_earth/ne_110m_admin_0_countries.geojson, ne_50m_geography_marine_polys.geojson (git'e girmez)
// Çıktı : public/data/regions.json — { countries: [{tr,en,b,r}], marine: [{tr,en,b,r}] }  r: base64 Int16 [lon×100, lat×100…], halkalar arası -32768 ayırıcı
// Kullanım: node scripts/regions.mjs
import fs from 'node:fs';

const C = JSON.parse(fs.readFileSync('raw/natural_earth/ne_110m_admin_0_countries.geojson', 'utf8')).features;
const M = JSON.parse(fs.readFileSync('raw/natural_earth/ne_50m_geography_marine_polys.geojson', 'utf8')).features;
const SEP = -32768;
const title = (s) => s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());
// okyanus adlarını Türkçede daha açık yaz (NE "Büyük Okyanus" kuzey/güney ayırmıyor)
const TR_FIX = { 'North Pacific Ocean': 'Kuzey Pasifik Okyanusu', 'South Pacific Ocean': 'Güney Pasifik Okyanusu', 'North Atlantic Ocean': 'Kuzey Atlas Okyanusu', 'South Atlantic Ocean': 'Güney Atlas Okyanusu', 'Mediterranean Sea': 'Akdeniz', 'Pacific Ocean': 'Pasifik Okyanusu', 'Atlantic Ocean': 'Atlas Okyanusu' };
function pack(geom, step = 0) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
  const out = []; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const poly of polys) for (const ring of poly) {
    if (out.length) out.push(SEP, SEP);
    let last = null;
    for (const [lo, la] of ring) {
      if (step && last && Math.abs(lo - last[0]) + Math.abs(la - last[1]) < step) continue; // sadeleştirme
      out.push(Math.round(lo * 100), Math.round(la * 100)); last = [lo, la];
      x0 = Math.min(x0, lo); x1 = Math.max(x1, lo); y0 = Math.min(y0, la); y1 = Math.max(y1, la);
    }
  }
  return { b: [x0, y0, x1, y1].map((v) => Math.round(v * 100) / 100), r: Buffer.from(new Int16Array(out).buffer).toString('base64') };
}
const countries = C.map((f) => { const p = f.properties; return { tr: p.NAME_TR || p.NAME, en: p.NAME_EN || p.NAME, cc: p.ISO_A2_EH && p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : p.ISO_A2, ...pack(f.geometry) }; });
const marine = M.filter((f) => f.properties.name).map((f) => { const p = f.properties, en = /^[A-Z\s]+$/.test(p.name_en || p.name) ? title(p.name_en || p.name) : (p.name_en || p.name); return { tr: TR_FIX[en] ?? (p.name_tr === 'Büyük Okyanus' ? 'Pasifik Okyanusu' : p.name_tr) ?? en, en, kind: p.featurecla, ...pack(f.geometry, 0.15) }; });
fs.writeFileSync('public/data/regions.json', JSON.stringify({ source: 'Natural Earth 1:110m admin-0 countries + 1:50m marine areas (public domain), naturalearthdata.com', countries, marine }));
console.log('ülke', countries.length, '· deniz/okyanus', marine.length, '→', Math.round(fs.statSync('public/data/regions.json').size / 1024), 'KB');
