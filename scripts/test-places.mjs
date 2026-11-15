// Yer bulma kabul testi: node scripts/test-places.mjs  (npm run test:places)
// Uygulamadaki çözümleyicinin AYNISI (src/lib/gazetteer.ts) ile 40+ ifade: bulunan yer + koordinat + beklenen ad.
// Ayrıca: App.tsx sesli komut çözümleyicisinde yer seçme (yazı) penceresi açan çağrı kalmamalı.
import fs from 'node:fs';
import { Gazetteer, goLine } from '../src/lib/gazetteer.ts';

const pf = JSON.parse(fs.readFileSync('public/data/places.json', 'utf8'));
const cf = JSON.parse(fs.readFileSync('public/data/cities.json', 'utf8'));
const G = new Gazetteer(pf, cf.cities, cf.asciiNames ?? {});
// [ifade, beklenen ad (TR ya da EN), beklenen yaklaşık enlem, boylam (±6°)]
const CASES = [
  ["Dünya Kanada'ya git", 'Kanada', 45.4, -75.7], ['dünya kanadaya git', 'Kanada', 45.4, -75.7], ["Japonya'yı aç", 'Japonya', 35.7, 139.7], ['japonyaya git', 'Japonya', 35.7, 139.7],
  ["Almanya'ya götür", 'Almanya', 52.5, 13.4], ["Brezilya'yı göster", 'Brezilya', -15.8, -47.9], ["Mısır'a git", 'Mısır', 30, 31.2], ["Hindistan'a git", 'Hindistan', 28.6, 77.2],
  ["Avustralya'ya git", 'Avustralya', -35.3, 149.1], ["Arjantin'e git", 'Arjantin', -34.6, -58.4], ["Güney Afrika'ya git", 'Güney Afrika', -25.7, 28.2], ["Güney Kore'ye git", 'Güney Kore', 37.6, 127],
  ["Amerika'ya git", 'Amerika', 38.9, -77], ["ABD'ye git", 'Amerika', 38.9, -77], ["İngiltere'ye git", 'Birleşik Krallık', 51.5, -0.1], ["Fransa'yı aç", 'Fransa', 48.9, 2.3],
  ["İtalya'ya git", 'İtalya', 41.9, 12.5], ["Rusya'ya git", 'Rusya', 55.8, 37.6], ["Çin'e git", 'Çin', 39.9, 116.4], ["Meksika'ya git", 'Meksika', 19.4, -99.1],
  ["Kenya'ya git", 'Kenya', -1.3, 36.8], ["Norveç'e git", 'Norveç', 59.9, 10.8], ["İzlanda'ya git", 'İzlanda', 64.1, -21.9], ["Sahra'ya git", 'Sahra', 23, 12],
  ["Amazon'a git", 'Amazon', -3.5, -62], ["Antarktika'ya git", 'Antarktika', -79.8, 35.9], ["Kuzey Kutbu'na git", 'Kuzey Kutbu', 88, 0], ["Pasifik Okyanusu'na git", 'Pasifik Okyanusu', 0, -160],
  ["Avrupa'ya git", 'Avrupa', 50, 15], ["Afrika'yı aç", 'Afrika', 5, 20], ["Roma'ya git", 'Roma', 41.9, 12.5], ["Londra'yı aç", 'Londra', 51.5, -0.1],
  ["Moskova'ya git", 'Moskova', 55.8, 37.6], ["Bağdat'a git", 'Bağdat', 33.3, 44.4], ["Sivas'a git", 'Sivas', 39.7, 37], ['sivasa git', 'Sivas', 39.7, 37],
  ["İstanbul'a git", 'İstanbul', 41, 29], ['istanbula git', 'İstanbul', 41, 29], ['take me to Canada', 'Kanada', 45.4, -75.7], ['go to Tokyo', 'Tokyo', 35.7, 139.7],
  // ek: kesmesiz ekler, yumuşama, eş adlar, ünlü harf farkı
  ['bağdada git', 'Bağdat', 33.3, 44.4], ["Kudüs'e git", 'Kudüs', 31.8, 35.2], ["Tahran'a git", 'Tahran', 35.7, 51.4], ['Kanadayı aç', 'Kanada', 45.4, -75.7], ["Kanada'nın", 'Kanada', 45.4, -75.7],
  ["Türkiye'de", 'Türkiye', 39.9, 32.9], ["Hollanda'ya git", 'Hollanda', 52.4, 4.9], ["Fildişi Sahili'ne git", 'Fildişi Sahili', 6.8, -5.3], ['birleşik devletlere git', 'Amerika', 38.9, -77],
  ['ISTANBUL', 'İstanbul', 41, 29], ['Sivas', 'Sivas', 39.7, 37], ["Atlas Okyanusu'na git", 'Atlas Okyanusu', 25, -40], ['show me Brazil', 'Brezilya', -15.8, -47.9],
];
let fail = 0;
const rows = [];
for (const [q, want, la, lo] of CASES) {
  const r = G.resolve(q), h = r.hit;
  const ok = !!h && (h.tr === want || h.en === want) && Math.abs(h.lat - la) <= 6 && Math.abs(((h.lon - lo + 540) % 360) - 180) <= 6 && (r.intent || r.whole);
  if (!ok) fail++;
  rows.push(`| ${ok ? '✓' : '✗'} | ${q} | ${h ? `${h.tr} (${h.kind})` : '— bulunamadı' + (r.cands.length ? ` · adaylar: ${r.cands.map((c) => c.tr).join(', ')}` : '')} | ${h ? `${h.lat.toFixed(2)}, ${h.lon.toFixed(2)}` : ''} | ${h ? goLine(h, 'tr') : ''} |`);
}
// bulanık öneri: bulunamayan ad → 2 aday
const fz = G.resolve("Kanda'yı aç");
const fzOk = !fz.hit && fz.cands.some((c) => c.tr === 'Kanada');
if (!fzOk) fail++;
rows.push(`| ${fzOk ? '✓' : '✗'} | Kanda'yı aç (yanlış duyulmuş) | — bulunamadı · adaylar: ${fz.cands.map((c) => c.tr).join(', ')} | | (aday önerisi) |`);
const ch = G.choose('birincisi', fz.cands), chOk = ch && ch !== 'no' && ch.tr === fz.cands[0]?.tr; if (!chOk) fail++;
rows.push(`| ${chOk ? '✓' : '✗'} | "birincisi" (aday seçimi) | ${ch && ch !== 'no' ? ch.tr : '—'} | | |`);
// sesli komut yolunda yazı penceresi açılmamalı
const app = fs.readFileSync('src/App.tsx', 'utf8');
const body = app.slice(app.indexOf('const runCommand = '), app.indexOf('const cmdRef = useRef(runCommand)'));
const opens = (body.match(/setPickOpen\(true\)/g) ?? []).length + (body.match(/toTextBox\(/g) ?? []).length;
if (opens) fail++;
// "ne duyuyorum" komutu çözümleyicide (runCommand) tanımlı olmalı
for (const k of ['ne duyuyorum', 'ne caliyor', 'what am i hearing', 'acikla']) if (!body.includes(`'${k}'`)) { fail++; console.log('✗ komut eksik:', k); }
console.log('| | İfade | Bulunan yer | Koordinat | Söylenen |\n|---|---|---|---|---|\n' + rows.join('\n'));
console.log(`\nSesli komut çözümleyicisinde yazı penceresi açan çağrı: ${opens} ${opens ? '✗' : '✓'}`);
console.log(fail ? `\n${fail} HATA` : `\nTümü geçti (${CASES.length + 2} ifade)`);
process.exit(fail ? 1 : 0);
