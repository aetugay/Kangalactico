// SES DÜNYALARI sınaması: node scripts/test-worlds.mjs  (npm run test:worlds)
// 1) sabit veri → sabit ses (parametre + seed bit bit aynı)  2) farklı veri → farklı ses  3) veri yok → sessizlik
// 4) küresel ölçek: aynı değer her yerde aynı ses  5) uzaklık: uzak bant daha kısık ve boğuk
// 6) gerçek veri tablosu: Sahra, Amazon, Tokyo, Kuzey Atlantik, Orta Afrika → her katmanın değeri ve ses parametreleri
import fs from 'node:fs';
import { worldEvents, worldRefEvents, sampleLayer, localRange, DEFAULTS, gainFor } from '../src/lib/radar.ts';
import { worldParams, describeWorld, WORLD_OF } from '../src/lib/worlds.ts';
import { TemperatureSource, SstSource, AerosolSource, NdviSource, LightsSource, LightningSource } from '../src/lib/layers.ts';

let fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? '✓' : '✗'} ${msg}`); if (!ok) fail++; };
const frame = (layers, center, rangeKm = 2000) => { const P = { center, rangeKm, ...DEFAULTS }; return { P, mode: 'bilim', scale: 'global', layers: layers.map((layer) => { const vals = sampleLayer(layer, P); return { layer, vals, local: localRange(vals) }; }) }; };
const tour = (F) => Array.from({ length: F.P.beams }, (_, b) => worldEvents(F, b).map((e) => ({ id: e.layerId, band: e.band, p: e.params, seed: e.seed, pan: +e.pan.toFixed(5) })));
const synth = (fn, id = 'dust', min = 0, max = 0.6) => ({ id, label: id, instrument: '', unit: null, min, max, baseHz: 0, when: '', sample: fn, fmt: (v) => `${v}` });
const C = { lat: 39.75, lon: 37.02 };

console.log('1) Sabit veri → sabit ses');
{
  const t1 = tour(frame([synth(() => 0.3)], C)), t2 = tour(frame([synth(() => 0.3)], C));
  const ev = t1.flat();
  check(ev.length > 0, `sabit toz verisi ses üretiyor (${ev.length} doku/tur)`);
  check(JSON.stringify(t1) === JSON.stringify(t2), 'iki ayrı çalıştırma bit bit aynı (parametre + seed)');
  const byBand = [0, 1, 2].map((b) => new Set(ev.filter((e) => e.band === b).map((e) => JSON.stringify(e.p))).size);
  check(byBand.every((n) => n === 1), 'her uzaklık bandında tüm yönler aynı parametre (yalnız yön/stereo değişir)');
}
console.log('2) Farklı veri → farklı ses');
{
  const lo = worldParams('dust', 0.06, 0.1, 0), hi = worldParams('dust', 0.54, 0.9, 0);
  check(hi.level > lo.level && hi.rate > lo.rate && hi.cutoff > lo.cutoff, `toz: az ${JSON.stringify([lo.level, lo.rate, lo.cutoff])} < çok ${JSON.stringify([hi.level, hi.rate, hi.cutoff])} (şiddet, sıklık, parlaklık)`);
  const cold = worldParams('heat', -20, 0, 0), hot = worldParams('heat', 35, 1, 0);
  check(cold.mix.icy > 0.9 && cold.mix.hot === 0 && hot.mix.hot > 0.9 && hot.mix.icy === 0, `sıcaklık: −20 °C buz ${cold.mix.icy}, 35 °C ağustos böceği ${hot.mix.hot}`);
  const ow = worldParams('ocean', 28, 1, 0), oc = worldParams('ocean', 0, 0, 0);
  check(oc.cutoff > ow.cutoff && oc.mix.ice > 0 && ow.mix.ice === 0, `okyanus: soğuk daha sert (${oc.cutoff} Hz) ve buzlu, sıcak yumuşak (${ow.cutoff} Hz)`);
}
console.log('3) Veri yok → ses yok');
{
  check(tour(frame([synth(() => NaN)], C)).flat().length === 0, 'her yer NaN → hiç doku yok');
  check(tour(frame([synth(() => 0.01)], C)).flat().length === 0, 'toz eşiğin altında (yok denecek kadar az) → sessizlik');
  check(worldRefEvents(frame([synth(() => NaN)], C)).length === 0, 'merkezde veri yok → merkez sesi yok');
}
console.log('4) Küresel ölçek: aynı değer her yerde aynı ses');
{
  const a = frame([synth((p) => (p.lon > C.lon ? 0.1 : 0.4))], C), b = frame([synth((p) => (p.lon > C.lon ? 0.4 : 0.55))], C);
  const ea = worldEvents(a, 24).find((e) => e.band === 0), eb = worldEvents(b, 8).find((e) => e.band === 0);
  check(ea && eb && JSON.stringify(ea.params) === JSON.stringify(eb.params), `0.4 toz iki farklı çevrede aynı parametre (${JSON.stringify(ea?.params)})`);
}
console.log('5) Uzaklık: uzak daha kısık ve boğuk');
{
  const n = worldParams('city', 100, 0.7, 0.15), f = worldParams('city', 100, 0.7, 0.85);
  check(f.level < n.level && f.cutoff < n.cutoff, `şehir: yakın ${n.level}/${n.cutoff} Hz → uzak ${f.level}/${f.cutoff} Hz`);
  const tn = worldParams('thunder', 0, 0.8, 0.15), tf = worldParams('thunder', 0, 0.8, 0.85);
  check(tf.delay > tn.delay && tf.sharp < tn.sharp, `gök gürültüsü: uzak gecikmeli (${tf.delay} sn) ve boğuk; yakın sert (${tn.sharp})`);
}

console.log('6) Gerçek veri (SVS görsellerinden): her yerin MERKEZ değeri ve ses parametreleri (uzaklık 0)');
const read = (f) => JSON.parse(fs.readFileSync(`public/data/${f}`, 'utf8'));
const temp = new TemperatureSource(read('5147.json'), read('5147_colorscale.json'));
const sst = new SstSource(read('3912.json'), read('3912_colorscale.json'));
const aer = new AerosolSource(read('5669.json'));
const ndvi = new NdviSource(read('5544.json'), read('5544_colorscale.json'));
const lights = new LightsSource(read('5313.json'));
const lightning = new LightningSource(read('5011.json'));
const LAYERS = [...aer.radarLayers('tr'), lightning.radarLayer('tr'), sst.radarLayer(0, 'tr'), lights.radarLayer(lights.years.length - 1, 'tr'), ndvi.radarLayer(ndvi.frames - 1, 'tr'), temp.radarLayer(temp.frames - 1, 'tr')];
const PLACES = [['Sahra (23°K 12°D)', { lat: 23, lon: 12 }], ['Amazon (Manaus)', { lat: -3.1, lon: -60 }], ['Tokyo', { lat: 35.68, lon: 139.69 }], ['Kuzey Atlantik (55°K 30°B)', { lat: 55, lon: -30 }], ['Orta Afrika (Kongo havzası)', { lat: -1.5, lon: 26 }]];
const rows = [];
for (const [name, p] of PLACES) for (const L of LAYERS) {
  const w = WORLD_OF[L.id]; const v = L.sample(p);
  if (Number.isNaN(v)) { rows.push({ yer: name, katman: L.label, deger: 'veri yok', ses: 'sessiz' }); continue; }
  const t = gainFor(v, L, 'global'), pr = worldParams(w, v, t, 0);
  const gate = { dust: 0.07, smoke: 0.07, spray: 0.07, volcano: 0.07, thunder: 0.01, city: 0.17 }[w] ?? -1;
  rows.push({ yer: name, katman: L.label, deger: L.fmt(v), t: +t.toFixed(2), ses: t < gate ? 'sessiz (eşik altı)' : describeWorld(w, v, t, 'tr'), level: pr.level, cutoff: pr.cutoff, rate: pr.rate, sharp: pr.sharp, mix: Object.entries(pr.mix).map(([k, x]) => `${k}=${(+x).toFixed(2)}`).join(' ') });
}
const md = ['| Yer | Katman | Değer | t (küresel) | Ses | şiddet | süzgeç Hz | olay/sn | sertlik | karışım |', '|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.yer} | ${r.katman} | ${r.deger} | ${r.t ?? '—'} | ${r.ses} | ${r.level ?? '—'} | ${r.cutoff ?? '—'} | ${r.rate ?? '—'} | ${r.sharp ?? '—'} | ${r.mix ?? ''} |`)].join('\n');
fs.writeFileSync('data/ses_dunyalari_test.md', `# Ses dünyaları — gerçek veri testi\n\nÜretici: \`node scripts/test-worlds.mjs\`. Değerler SVS görsellerinden (renk skalası → değer); ölçek küresel; uzaklık 0 (merkez).\n\n${md}\n`);
console.log(md);
const get = (yer, kat) => rows.find((r) => r.yer.startsWith(yer) && r.katman.startsWith(kat));
check((get('Sahra', 'Toz')?.t ?? 0) > 0.4, `Sahra: toz yüksek (t ${get('Sahra', 'Toz')?.t})`);
check((get('Amazon', 'Orman')?.t ?? 0) > 0.6, `Amazon: orman/bitki örtüsü yüksek (t ${get('Amazon', 'Orman')?.t})`);
check((get('Tokyo', 'Gece')?.t ?? 0) > 0.5, `Tokyo: şehir ışığı yüksek (t ${get('Tokyo', 'Gece')?.t})`);
check(/sessiz/.test(get('Sahra', 'Gece')?.ses ?? ''), `Sahra: gece ışığı arka plan (t ${get('Sahra', 'Gece')?.t}) → sessiz, şehir sesi yok`);
check(/buzlu|serin/.test(get('Kuzey', 'Okyanus')?.ses ?? ''), `Kuzey Atlantik: soğuk dalga (${get('Kuzey', 'Okyanus')?.deger} → ${get('Kuzey', 'Okyanus')?.ses})`);
check((get('Orta Afrika', 'Yıldırım')?.t ?? 0) > 0.6, `Orta Afrika: yıldırım yüksek (t ${get('Orta Afrika', 'Yıldırım')?.t})`);
console.log(fail ? `\n${fail} kontrol BAŞARISIZ` : '\nTüm ses dünyası kontrolleri geçti');
process.exit(fail ? 1 : 0);
