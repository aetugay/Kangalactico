// VERİDEN DOĞAN MÜZİK sınaması: node scripts/test-music.mjs  (npm run test:music)
import fs from 'node:fs';
import { sampleLayer, localRange, DEFAULTS } from '../src/lib/radar.ts';
import { moodOf, musicEvents } from '../src/lib/music.ts';
import { TemperatureSource, SstSource, AerosolSource, NdviSource, LightsSource, LightningSource } from '../src/lib/layers.ts';

let fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? '✓' : '✗'} ${msg}`); if (!ok) fail++; };
const frame = (layers, center, rangeKm = 2000) => { const P = { center, rangeKm, ...DEFAULTS }; return { P, mode: 'bilim', scale: 'global', sound: 'both', layers: layers.map((layer) => { const vals = sampleLayer(layer, P); return { layer, vals, local: localRange(vals) }; }) }; };
const phrase = (F) => { const m = moodOf(F); return { mood: m, ev: Array.from({ length: F.P.beams }, (_, b) => musicEvents(F, b, m)).flat() }; };
const synth = (fn, id = 'dust', min = 0, max = 0.6) => ({ id, label: id, instrument: '', unit: null, min, max, baseHz: 0, when: '', sample: fn, fmt: (v) => `${v}` });
const C = { lat: 39.75, lon: 37.02 };

console.log('1) Sabit veri → sabit müzik; veri yok → müzik yok');
{
  const a = phrase(frame([synth(() => 0.2)], C)), b = phrase(frame([synth(() => 0.2)], C));
  check(a.ev.length > 0 && JSON.stringify(a) === JSON.stringify(b), `sabit toz: ${a.ev.length} nota, iki çalıştırma bit bit aynı`);
  check(new Set(a.ev.map((e) => JSON.stringify(e.freqs))).size === 1, 'sabit veri → hep aynı akor');
  check(phrase(frame([synth(() => NaN)], C)).ev.length === 0, 'veri yok → müzik yok');
  check(phrase(frame([synth(() => 0.01)], C)).ev.length === 0, 'eşik altı (yok denecek kadar az toz) → müzik yok');
  const lo = phrase(frame([synth(() => 0.05 * 0.6 + 0.07)], C)).mood, hi = phrase(frame([synth(() => 0.55)], C)).mood;
  check(!lo.minor && hi.minor && hi.every < lo.every, `az toz → majör, seyrek (her ${lo.every} ışında); çok toz → minör, sık (her ${hi.every} ışında)`);
}
console.log('2) Gerçek veri (2000 km radar, tüm 6 ses dünyası açık)');
const read = (f) => JSON.parse(fs.readFileSync(`public/data/${f}`, 'utf8'));
const temp = new TemperatureSource(read('5147.json'), read('5147_colorscale.json')), sst = new SstSource(read('3912.json'), read('3912_colorscale.json'));
const aer = new AerosolSource(read('5669.json')), ndvi = new NdviSource(read('5544.json'), read('5544_colorscale.json'));
const lights = new LightsSource(read('5313.json')), lightning = new LightningSource(read('5011.json'));
const ALL = [...aer.radarLayers('tr'), lightning.radarLayer('tr'), sst.radarLayer(0, 'tr'), lights.radarLayer(lights.years.length - 1, 'tr'), ndvi.radarLayer(ndvi.frames - 1, 'tr'), temp.radarLayer(temp.frames - 1, 'tr')];
const rows = [];
for (const [name, p, rangeKm] of [['Sahra', { lat: 23, lon: 12 }, 2000], ['Amazon', { lat: -3.1, lon: -60 }, 2000], ['Orta Afrika', { lat: -1.5, lon: 26 }, 2000], ['Kuzey Atlantik', { lat: 55, lon: -30 }, 500]]) {
  const { mood, ev } = phrase(frame(ALL, p, rangeKm));
  const count = {}; for (const e of ev) count[e.instr] = (count[e.instr] ?? 0) + 1;
  const top = Object.entries(count).sort((a, b) => b[1] - a[1]);
  rows.push({ name, mood, top, n: ev.length });
  console.log(`  ${name.padEnd(15)} gerilim ${mood.stress} → ${mood.minor ? 'MİNÖR (gergin)' : 'majör (aydınlık)'} · yoğunluk ${mood.energy} → her ${mood.every} ışında · ${ev.length} nota · çalgılar: ${top.map(([k, v]) => `${k} ${v}`).join(', ')}`);
}
const R = Object.fromEntries(rows.map((r) => [r.name, r]));
check(R['Sahra'].mood.minor && R['Sahra'].top[0][0] === 'pad', 'Sahra: toz yüksek → gerilimli (minör), baskın çalgı havadar pad');
check(!R['Amazon'].mood.minor && R['Amazon'].top.some(([k]) => k === 'marimba'), 'Amazon: aydınlık (majör), marimba var');
check(R['Orta Afrika'].top.some(([k]) => k === 'timpani'), 'Orta Afrika: şimşek → timpani');
check(R['Kuzey Atlantik'].top[0][0] === 'celesta', 'Kuzey Atlantik: soğuk deniz → çelesta (seyrek)');
console.log(fail ? `\n${fail} kontrol BAŞARISIZ` : '\nTüm müzik kontrolleri geçti');
process.exit(fail ? 1 : 0);
