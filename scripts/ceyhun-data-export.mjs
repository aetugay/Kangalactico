// Ceyhun JSON paketi (referans/data, 2026-11-15) → onaylanan 3 katman: public/data/c5/{currents,lis,gedi}.json
// Onaylananlar: okyanus akıntıları (OSCAR), yıldırım (LIS/OTD klimatoloji), orman yüksekliği (GEDI). Diğerleri EKLENMEZ (bkz. data/audit_ceyhun_data.md).
// 5° hücreler kendi çözünürlüğünde kalır (radar SVS/v3 ızgarasına karıştırılmaz). Kıyıda yanlış ortama düşen hücreler Natural Earth 1:50m kara maskesiyle atılır.
// Kullanım: node scripts/ceyhun-data-export.mjs
import fs from 'node:fs';

const D = 'referans/data', OUT = 'public/data/c5';
fs.mkdirSync(OUT, { recursive: true });
const J = (f) => JSON.parse(fs.readFileSync(`${D}/${f}`, 'utf8'));
// Natural Earth kara poligonları (public/data/land_50m.json; evenodd)
const land = JSON.parse(fs.readFileSync('public/data/land_50m.json', 'utf8'));
const b = Buffer.from(land.data, 'base64'), a = new Int16Array(b.buffer, b.byteOffset, b.length / 2);
const rings = land.starts.map((s, i) => { const e = i + 1 < land.starts.length ? land.starts[i + 1] : land.points; const r = []; for (let k = s; k < e; k++) r.push([a[2 * k] / 100, a[2 * k + 1] / 100]); return r; });
const bbox = rings.map((r) => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of r) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return [x0, x1, y0, y1]; });
const inR = (r, x, y) => { let c = false; for (let i = 0, k = r.length - 1; i < r.length; k = i++) { const [xi, yi] = r[i], [xk, yk] = r[k]; if ((yi > y) !== (yk > y) && x < (xk - xi) * (y - yi) / (yk - yi) + xi) c = !c; } return c; };
const isLand = (lat, lon) => { let c = false; rings.forEach((r, i) => { const [x0, x1, y0, y1] = bbox[i]; if (lon >= x0 && lon <= x1 && lat >= y0 && lat <= y1 && inR(r, lon, lat)) c = !c; }); return c; };
const r3 = (x) => Math.round(x * 1000) / 1000;
const median = (v) => { const s = [...v].sort((x, y) => x - y); return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
/** Aylar boyunca nokta başına toplama (lat,lon anahtarıyla). Yalnız 12 ayın HEPSİNDE bulunan noktalar alınır (eksik ay uydurulmaz). */
function perPoint(K, fn) {
  const months = Object.keys(K.aylik_kure_katmanlari), m = new Map();
  for (const mo of months) for (const p of K.aylik_kure_katmanlari[mo].noktalar) { const k = p.lat + ',' + p.lon; if (!m.has(k)) m.set(k, { lat: p.lat, lon: p.lon, v: [] }); m.get(k).v.push(+p.deger); }
  const all = [...m.values()], full = all.filter((x) => x.v.length === months.length);
  return { months, partial: all.length - full.length, cells: full.map((x) => [x.lat, x.lon, fn(x.v)]) };
}
const write = (id, o) => { fs.writeFileSync(`${OUT}/${id}.json`, JSON.stringify(o)); const v = o.cells.map((c) => c[2]); console.log(`${id}: ${o.cells.length} hücre (${o.dropped} kıyı hücresi atıldı, ${o.partial} eksik aylı nokta alınmadı) · ${Math.min(...v)} … ${Math.max(...v)} ${o.unit} · ${Math.round(fs.statSync(`${OUT}/${id}.json`).size / 1024)} KB`); };

// 1) Okyanus yüzey akıntı hızı — OSCAR L4 FINAL V2.0, √(u²+v²), 12 ayın ortalaması; karaya düşen hücreler atılır
{
  const K = J('jukebox_okyanus_akintilari_kure_12ay.json'), { months, cells, partial } = perPoint(K, (v) => v.reduce((s, x) => s + x, 0) / v.length);
  const keep = cells.filter(([la, lo]) => !isLand(la, lo));
  write('currents', {
    id: 'currents', unit: 'm/s', domain: 'sea', scale: 'linear', min: 0, max: r3(Math.max(...keep.map((c) => c[2]))), cellDeg: 5, resolutionKm: 550, dropped: cells.length - keep.length, partial,
    kanit: { koleksiyon: K.meta.veri_kaynagi, degisken: 'u, v (yüzey akıntısı) → hız = √(u²+v²)', donem: `${months[0]} … ${months[months.length - 1]}`, birim: 'm/s', toplama: '12 aylık ortalama', kaynak_paket: 'Ceyhun, referans/data 2026-11-15' },
    note: { tr: 'Dönemi diğer katmanlardan farklı (2025-02 … 2026-01). Çözünürlük ~550 km (5°); kıyıda karaya düşen hücreler atıldı.', en: 'Period differs from the other layers (2025-02 … 2026-01). Resolution ~550 km (5°); coastal cells falling on land were removed.' },
    cells: keep.map(([la, lo, v]) => [la, lo, r3(v)]),
  });
}
// 2) Yıldırım — LIS/OTD LRMC iklimsel ortalama (çok yıllık klimatoloji, tek yıl DEĞİL): 12 ayın ortalaması × 365 = flaş/km²/yıl
{
  const K = J('jukebox_yildirim_kure_12ay.json'), { months, cells, partial } = perPoint(K, (v) => (v.reduce((s, x) => s + x, 0) / v.length) * 365);
  const pos = cells.map((c) => c[2]).filter((x) => x > 0);
  write('lis', {
    id: 'lis', unit: 'flaş/km²/yıl', domain: 'all', scale: 'log', min: r3(Math.min(...pos)), max: r3(Math.max(...pos)), cellDeg: 5, resolutionKm: 550, dropped: 0, partial,
    kanit: { koleksiyon: 'LIS/OTD Low Resolution Monthly Climatology (lohrmc), NASA GHRC', degisken: 'aylık flaş yoğunluğu (flaş/km²/gün)', donem: `iklimsel ortalama (${months[0]} … ${months[months.length - 1]}; çok yıllık klimatoloji)`, birim: 'flaş/km²/yıl', toplama: '12 klimatoloji ayının ortalaması × 365', kaynak_paket: 'Ceyhun, referans/data 2026-11-15' },
    note: { tr: 'İklimsel ortalama (tek yıl değil). Ölçek gerçek veri aralığından, logaritmik, kırpılmadan (paketin önerdiği 0–0,15 aralığı kullanılmadı). Çözünürlük ~550 km (5°). 0 = ölçülebilir yıldırım yok.', en: 'Climatological mean (not a single year). Scale from the real data range, logarithmic, unclipped (the package’s suggested 0–0.15 range is not used). Resolution ~550 km (5°). 0 = no measurable lightning.' },
    cells: cells.map(([la, lo, v]) => [la, lo, r3(v)]),
  });
}
// 3) Orman kanopi yüksekliği — GEDI L3 V3 rh100: tek, çok yıllık değer (12 ayın ortancası → LAI'den türetilen ±%7 aylık değişim atılır); denize düşen noktalar atılır
{
  const K = J('jukebox_orman_yuksekligi_kure_12ay.json'), { months, cells, partial } = perPoint(K, median);
  const keep = cells.filter(([la, lo]) => isLand(la, lo));
  write('gedi', {
    id: 'gedi', unit: 'm', domain: 'land', scale: 'linear', min: 0, max: r3(Math.max(...keep.map((c) => c[2]))), cellDeg: 5, resolutionKm: 550, latLimit: 51.6, dropped: cells.length - keep.length, partial,
    kanit: { koleksiyon: 'GEDI L3 Gridded Land Surface Metrics V3 (GEDI_L3_LandSurface_Metrics_V3_2525)', degisken: 'rh100_mean (kanopi üst yüksekliği)', donem: 'çok yıllık (GEDI görev dönemi); aylık değişim YOK', birim: 'm', toplama: "paketteki 12 ayın ortancası (paket LAI ile ±%7 'mevsimsel bağlama' eklemişti; atıldı)", kaynak_paket: 'Ceyhun, referans/data 2026-11-15' },
    note: { tr: 'Tek, çok yıllık değer. GEDI yalnız ~51,6° K – 51,6° G arasını ölçer; dışı "veri yok". Denize düşen noktalar atıldı. Çözünürlük ~550 km (5° boylam).', en: 'Single multi-year value. GEDI only measures ~51.6° N – 51.6° S; outside is "no data". Points falling on the sea were removed. Resolution ~550 km (5° longitude).' },
    cells: keep.map(([la, lo, v]) => [la, lo, r3(v)]),
  });
}
