// Ters coğrafi kodlama sınaması: node scripts/test-revgeo.mjs (npm run test:revgeo) — 10+ nokta (kara, okyanus, kutup), TR ve EN adlar
import fs from 'node:fs';
import { RevGeo } from '../src/lib/revgeo.ts';
import { Cities, countryName } from '../src/lib/places.ts';
const R = new RevGeo(JSON.parse(fs.readFileSync('public/data/regions.json', 'utf8')));
const cf = JSON.parse(fs.readFileSync('public/data/cities.json', 'utf8')), C = new Cities(cf);
const alias = JSON.parse(fs.readFileSync('public/data/places.json', 'utf8')).cityAliases, trOf = Object.fromEntries(Object.entries(alias).map(([tr, en]) => [en, tr]));
const P = [[-1.5, 24, 'Demokratik Kongo'], [38, -70, 'Atlas'], [-3.1, -60, 'Brezilya'], [20, 5, '^Cezayir(, Nijer sınırına yakın)?$'], [18.74, 7.39, '^Arlit, Nijer$'], [36.2, 36.16, 'Antakya, Türkiye|Türkiye'], [82, 0, 'Arktik'], [39.75, 37.02, 'Türkiye'], [35, 18, 'Akdeniz|İyon'], [-60, 90, 'Güney Okyanusu|Hint Okyanusu'], [0, -150, 'Pasifik'], [43, 34, 'Karadeniz'], [-89, 0, 'Antarktika|Güney Kutbu'], [64.1, -21.9, 'Reykjavík, İzlanda'], [-33.9, 151.2, 'Sydney, Avustralya'], [25, 90, 'Bangladeş|Hindistan']];
let fail = 0; console.log('| Nokta | TR | EN |\n|---|---|---|');
for (const [la, lo, want] of P) {
  const nc = C.landmark({ lat: la, lon: lo }, 300), city = nc ? { tr: trOf[nc.row[0]] ?? nc.row[0], en: nc.row[0], km: nc.km, cc: nc.row[1], country: { tr: countryName(nc.row[1], 'tr'), en: countryName(nc.row[1], 'en') } } : null;
  const n = R.name({ lat: la, lon: lo }, city), ok = !!n && new RegExp(want).test(n.tr);
  if (!ok) fail++;
  console.log(`| ${ok ? '✓' : '✗'} ${la}, ${lo} | ${n?.tr ?? '—'} | ${n?.en ?? '—'} |`);
}
console.log(fail ? `\n${fail} HATA` : '\nTümü geçti'); process.exit(fail ? 1 : 0);
