// "Herhangi bir yer" sorgusu — public/data/*.json üzerinden. Arayüzün yapacağını Node'da sınar.
// Kullanım: node scripts/query.mjs Sivas        |  node scripts/query.mjs 39.75 37.02
import fs from 'node:fs';
import { haversineKm } from './lib/geo.mjs';

const D = (id) => JSON.parse(fs.readFileSync(`public/data/${id}.json`, 'utf8'));
const W = 360, H = 180;
const cellOf = (lat, lon) => Math.min(H - 1, Math.floor((90 - lat) / 180 * H)) * W + Math.min(W - 1, Math.floor((lon + 180) / 360 * W));
const center = (c) => ({ lat: 90 - Math.floor(c / W) - 0.5, lon: -180 + (c % W) + 0.5 });
const decode = (L, frame = 0) => { const b = Buffer.from(L.data, 'base64'); return (c) => { const q = b[frame * W * H + c]; if (q === 255) return null; return L.quant.encoding === 'sqrt' ? L.quant.max * (q / 254) ** 2 : L.quant.offset + q * L.quant.scale; }; };
/** En yakın değerli hücre (verilen karede). */
function nearestValid(get, lat, lon, maxKm = 1500) {
  let best = null;
  const j0 = Math.floor((90 - lat) / 180 * H), R = Math.ceil(maxKm / 111) + 1;
  for (let j = Math.max(0, j0 - R); j <= Math.min(H - 1, j0 + R); j++) for (let i = 0; i < W; i++) {
    const c = j * W + i, v = get(c); if (v === null) continue;
    const p = center(c), d = haversineKm(lat, lon, p.lat, p.lon);
    if (d <= maxKm && (!best || d < best.km)) best = { c, ...p, km: +d.toFixed(0), v };
  }
  return best;
}

let [a, b] = process.argv.slice(2);
let place;
if (b !== undefined) place = { name: `${a},${b}`, lat: +a, lon: +b };
else {
  const C = D('cities');
  const hit = C.cities.find((x) => x[0].toLowerCase() === a.toLowerCase()) || C.cities.find((x) => (C.asciiNames[`${x[0]}|${x[1]}`] || '').toLowerCase() === a.toLowerCase());
  if (!hit) throw new Error('şehir bulunamadı: ' + a);
  place = { name: `${hit[0]} (${hit[1]})`, lat: hit[2], lon: hit[3], pop: hit[4] };
}
const out = { place };
const c0 = cellOf(place.lat, place.lon);

// 3912 deniz yüzeyi sıcaklığı: her karede en yakın değerli deniz hücresi
{
  const j = D('3912'); const hits = [];
  for (let f = 0; f < j.frames.count; f++) { const n = nearestValid(decode(j, f), place.lat, place.lon); if (n) hits.push({ f, ...n }); }
  const byCell = {}; for (const h of hits) (byCell[h.c] = byCell[h.c] || []).push(h);
  const top = Object.values(byCell).sort((x, y) => y.length - x.length)[0];
  const vals = hits.map((h) => h.v);
  out['3912_SST'] = { unit: '°C', note: 'ECCO2 model, 2007-03-25 → 2008-03-03; kendi hücresinde deniz yoksa her karede en yakın değerli deniz hücresi',
    framesWithValue: `${hits.length}/${j.frames.count}`, mostFrequentNearest: top && { lat: top[0].lat, lon: top[0].lon, km: top[0].km, frames: top.length, mean: +(top.reduce((s, h) => s + h.v, 0) / top.length).toFixed(2) },
    nearestKmRange: hits.length ? [Math.min(...hits.map((h) => h.km)), Math.max(...hits.map((h) => h.km))] : null,
    valueRange: vals.length ? [+Math.min(...vals).toFixed(2), +Math.max(...vals).toFixed(2)] : null,
    first5: hits.slice(0, 5).map((h) => ({ t: j.frames.t[h.f], lat: h.lat, lon: h.lon, km: h.km, v: +h.v.toFixed(2) })) };
}
// 5147 hava sıcaklığı (kendi hücresi)
{
  const j = D('5147'); const s = [];
  for (let f = 0; f < j.frames.count; f++) { const v = decode(j, f)(c0); s.push(v === null ? null : +v.toFixed(1)); }
  const ok = s.filter((v) => v !== null);
  out['5147_T2M'] = { unit: '°C', cell: center(c0), first: { date: j.frames.dates[0], v: s[0] }, last: { date: j.frames.dates.at(-1), v: s.at(-1), forecast: j.frames.forecastAtDownload.at(-1) }, range: ok.length ? [Math.min(...ok), Math.max(...ok)] : null };
}
// 5544 NDVI göreli
{ const j = D('5544'); const v0 = decode(j, 0)(c0), v1 = decode(j, j.frames.count - 1)(c0); out['5544_NDVI_goreli'] = { first: v0 && +v0.toFixed(3), last: v1 && +v1.toFixed(3), note: 'GÖRELİ 0..1, tarih bilinmiyor' }; }
// 5313 gece ışıkları
{
  const j = D('5313'); const Y = j.layers.years;
  const yrs = Y.list.map((y, k) => ({ year: y, cellMeanLuma: (() => { const v = decode(Y, k)(c0); return v === null ? null : +v.toFixed(2); })() }));
  const sv = {}; for (const s of j.sivasSeries) (sv[s.year] = sv[s.year] || []).push({ v: s.sivasLuma3x3, frames: s.frames });
  const ch = decode(j.layers.change, 0)(c0);
  out['5313_isiklar'] = { unit: 'parlaklık (luma 0–255), GÖRELİ', cellMeanByYear: yrs,
    pixel3x3ByYear: place.name.startsWith('Sivas') ? Object.entries(sv).map(([y, a]) => ({ year: +y, mean: a[0].v, frames: a[0].frames })) : 'yalnızca Sivas için kaydedildi',
    change2012to2023: ch === null ? null : +ch.toFixed(3) };
}
// 5669 aerosol
{ const j = D('5669'); const t = Buffer.from(j.tag, 'base64')[c0]; out['5669_aerosol'] = { date: j.date, dominant: t === j.noneIndex ? 'yok' : j.categories[t].id, layers: Object.fromEntries(Object.entries(j.layers).map(([k, L]) => [k, (() => { const v = decode(L)(c0); return v === null ? null : +v.toFixed(3); })()])) }; }
// 5011 yıldırım olayları (±2° içinde)
{ const j = D('5011'); const ev = j.events.list.filter((e) => Math.abs(e[1] - place.lat) <= 2 && Math.abs(e[2] - place.lon) <= 2); out['5011_yildirim'] = { within2deg: ev.length, firstTimes: ev.slice(0, 5).map((e) => e[0]), note: 'tarih bilinmiyor; t = video saniyesi' }; }

console.log(JSON.stringify(out, null, 1));
