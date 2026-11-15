// OSCAR akıntı katmanı koordinat denetimi (referans/data, Ceyhun 2026-11-15).
// Ham noktalara olası koordinat hatalarını uygular; her deneme için kara oranı + bilinen akıntıların yerinde olup olmadığı ölçülür.
// Kullanım: node scripts/audit-oscar.mjs → data/audit_oscar.json
import fs from 'node:fs';

const K = JSON.parse(fs.readFileSync('referans/data/jukebox_okyanus_akintilari_kure_12ay.json', 'utf8'));
const months = Object.keys(K.aylik_kure_katmanlari);
const m = new Map();
for (const mo of months) for (const p of K.aylik_kure_katmanlari[mo].noktalar) { const k = p.lat + ',' + p.lon; if (!m.has(k)) m.set(k, { lat: p.lat, lon: p.lon, v: [] }); m.get(k).v.push(+p.deger); }
const raw = [...m.values()].map((x) => ({ lat: x.lat, lon: x.lon, v: x.v.reduce((s, y) => s + y, 0) / x.v.length }));

const land = JSON.parse(fs.readFileSync('public/data/land_50m.json', 'utf8'));
const b = Buffer.from(land.data, 'base64'), a = new Int16Array(b.buffer, b.byteOffset, b.length / 2);
const rings = land.starts.map((s, i) => { const e = i + 1 < land.starts.length ? land.starts[i + 1] : land.points; const r = []; for (let k = s; k < e; k++) r.push([a[2 * k] / 100, a[2 * k + 1] / 100]); return r; });
const bbox = rings.map((r) => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of r) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return [x0, x1, y0, y1]; });
const inR = (r, x, y) => { let c = false; for (let i = 0, k = r.length - 1; i < r.length; k = i++) { const [xi, yi] = r[i], [xk, yk] = r[k]; if ((yi > y) !== (yk > y) && x < (xk - xi) * (y - yi) / (yk - yi) + xi) c = !c; } return c; };
const isLand = (lat, lon) => { let c = false; rings.forEach((r, i) => { const [x0, x1, y0, y1] = bbox[i]; if (lon >= x0 && lon <= x1 && lat >= y0 && lat <= y1 && inR(r, lon, lat)) c = !c; }); return c; };
const wrap = (lo) => ((((lo + 180) % 360) + 360) % 360) - 180;
const hav = (la1, lo1, la2, lo2) => { const R = Math.PI / 180, x = Math.sin((la2 - la1) * R / 2) ** 2 + Math.cos(la1 * R) * Math.cos(la2 * R) * Math.sin((lo2 - lo1) * R / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };

// bilinen akıntılar (yaklaşık konum; OSCAR'da 5° hücrede beklenen: güçlü akıntı > 0,25 m/s) ve sakin girdap merkezleri (< 0,15)
const STRONG = [['Gulf Stream', 38, -70], ['Kuroshio', 35, 142], ['Agulhas', -38, 25], ['Antarktik Çevre (55°G, 0°)', -55, 0], ['Antarktik Çevre (55°G, 90°D)', -55, 90], ['Antarktik Çevre (55°G, 150°B)', -55, -150], ['Güney Ekvator (0°, 120°B)', 0, -120], ['Güney Ekvator (0°, 160°B)', 0, -160], ['Somali (8°K, 52°D)', 8, 52]];
const CALM = [['K. Pasifik girdabı', 28, -150], ['Sargasso', 28, -55], ['G. Pasifik girdabı', -28, -120], ['G. Hint girdabı', -28, 80]];
const near = (pts, la, lo) => { let best = null, bd = 400; for (const p of pts) { const d = hav(la, lo, p.lat, p.lon); if (d < bd) { bd = d; best = p; } } return best; };

const TRIES = [
  ['kimlik (olduğu gibi)', (p) => p],
  ['boylam 0–360 → −180–180 (+180° kaydırma)', (p) => ({ ...p, lon: wrap(p.lon + 180) })],
  ['boylam +2,5° (yarım hücre)', (p) => ({ ...p, lon: wrap(p.lon + 2.5) })],
  ['boylam −2,5° (yarım hücre)', (p) => ({ ...p, lon: wrap(p.lon - 2.5) })],
  ['enlem +2,5° (yarım hücre)', (p) => ({ ...p, lat: p.lat + 2.5 })],
  ['enlem −2,5° (yarım hücre)', (p) => ({ ...p, lat: p.lat - 2.5 })],
  ['enlem ters (−enlem)', (p) => ({ ...p, lat: -p.lat })],
  ['enlem ters + boylam +180°', (p) => ({ lat: -p.lat, lon: wrap(p.lon + 180), v: p.v })],
  ['boylam +180° + yarım hücre (+2,5°)', (p) => ({ ...p, lon: wrap(p.lon + 182.5) })],
];
const rows = [];
for (const [name, fn] of TRIES) {
  const pts = raw.map(fn), landN = pts.filter((p) => isLand(p.lat, p.lon)).length;
  const s = STRONG.map(([n, la, lo]) => { const p = near(pts, la, lo); return { n, v: p ? +p.v.toFixed(3) : null, ok: !!p && p.v > 0.25 }; });
  const c = CALM.map(([n, la, lo]) => { const p = near(pts, la, lo); return { n, v: p ? +p.v.toFixed(3) : null, ok: !!p && p.v < 0.15 }; });
  rows.push({ deneme: name, kara_orani: +(landN / pts.length).toFixed(3), guclu_yerinde: s.filter((x) => x.ok).length + '/' + s.length, sakin_yerinde: c.filter((x) => x.ok).length + '/' + c.length, guclu: s, sakin: c });
}
fs.writeFileSync('data/audit_oscar.json', JSON.stringify({ nokta: raw.length, aylar: `${months[0]}…${months[months.length - 1]}`, denemeler: rows }, null, 1));
console.log(`ham nokta ${raw.length} (12 ay ortalaması)\n`);
console.log('| Deneme | Karaya düşen | Güçlü akıntı yerinde | Sakin girdap yerinde |\n|---|---|---|---|');
for (const r of rows) console.log(`| ${r.deneme} | %${(r.kara_orani * 100).toFixed(1)} | ${r.guclu_yerinde} | ${r.sakin_yerinde} |`);
console.log('\nAyrıntı (kimlik):'); for (const x of [...rows[0].guclu, ...rows[0].sakin]) console.log(`  ${x.n}: ${x.v ?? 'yok (400 km içinde hücre yok)'} ${x.ok ? '✓' : '✗'}`);
