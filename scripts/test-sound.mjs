// Adım 1 doğrulaması: "ses veriden gelir". node scripts/test-sound.mjs  (npm run test:sound)
// Arayüzün kullandığı saf fonksiyonu (src/lib/radar.ts → beamEvents) sınar; ses kartı gerekmez.
import fs from 'node:fs';
import { beamEvents, sampleLayer, localRange, DEFAULTS, PARTS } from '../src/lib/radar.ts';
import { Co2Source, SstSource } from '../src/lib/layers.ts';
import { Cities, rowToPlace } from '../src/lib/places.ts';

let fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? '✓' : '✗'} ${msg}`); if (!ok) fail++; };
const P = (center, rangeKm = 2000) => ({ center, rangeKm, ...DEFAULTS });
const frame = (layers, center, mode = 'bilim', rangeKm = 2000) => {
  const p = P(center, rangeKm);
  return { P: p, mode, layers: layers.map((layer) => { const vals = sampleLayer(layer, p); return { layer, vals, local: localRange(vals) }; }) };
};
/** Tüm tur: her ışının olayları (yalnız ses parametreleri). */
const tour = (F) => Array.from({ length: F.P.beams }, (_, b) => beamEvents(F, b).map((e) => ({ id: e.layerId, freq: e.freq, gain: e.gain, pan: +e.pan.toFixed(6), dur: e.durBeams })));
const synth = (fn, id = 'co2') => ({ id, label: id, instrument: '', unit: 'x', min: 400, max: 420, baseHz: 0, when: '', sample: fn, fmt: (v) => `${v}` });
const C = { lat: 39.75, lon: 37.02 };

console.log('1) Sabit veri → sabit ses');
{
  const F = frame([synth(() => 412)], C);
  const t = tour(F);
  const notes = t.flat();
  check(notes.length > 0, `sabit veri ses üretiyor (${notes.length} nota/tur)`);
  check(new Set(notes.map((n) => n.freq)).size === 1 && new Set(notes.map((n) => n.gain)).size === 1, `tüm turda tek perde (${notes[0].freq.toFixed(2)} Hz) ve tek şiddet`);
  check(JSON.stringify(t) === JSON.stringify(tour(frame([synth(() => 412)], C))), 'iki ayrı çalıştırma bit bit aynı');
}

console.log('2) Farklı veri → farklı ses (ve yüksek değer asla daha pes değil)');
{
  // değer yöne bağlı: doğu (boylam büyük) daha yüksek
  const F = frame([synth((p) => 400 + Math.max(0, Math.min(20, (p.lon - C.lon) * 1.2 + 10)))], C);
  const evs = Array.from({ length: F.P.beams }, (_, b) => beamEvents(F, b)).flat();
  check(new Set(evs.map((e) => e.freq)).size > 1, `farklı değerler farklı notalar veriyor (${new Set(evs.map((e) => e.freq)).size} farklı perde)`);
  const sorted = [...evs].sort((a, b) => a.value - b.value);
  check(sorted.every((e, i) => i === 0 || e.freq >= sorted[i - 1].freq), 'perde değerle birlikte artıyor (azalmıyor)');
  check(evs.every((e) => Number.isFinite(e.value) && e.valueText.length > 0), 'her olayın arkasında gerçek bir değer var');
}

console.log('3) Veri yok → ses yok');
{
  check(tour(frame([synth(() => NaN)], C)).flat().length === 0, 'her yer NaN → tur boyunca hiç nota yok');
  const F = frame([synth((p) => (p.lon > C.lon ? NaN : 410))], C); // doğu yarısı veri yok
  const evs = Array.from({ length: F.P.beams }, (_, b) => beamEvents(F, b)).flat();
  // her nota, ışınlarının çoğunda veri olan bir gruptan gelmeli; tamamen doğuya bakan gruplar susmalı
  check(evs.length > 0 && evs.every((e) => e.bearing < 1 || e.bearing > 179), `doğu yarısı NaN → yalnız veri olan yönler çalıyor (yönler: ${[...new Set(evs.map((e) => Math.round(e.bearing)))].join(', ')})`);
}

console.log('4) Bilim modu: aynı değer her yerde aynı nota; hikâye modu yerel ölçek');
{
  const a = frame([synth((p) => (p.lon > C.lon ? 405 : 415))], C, 'bilim'), b = frame([synth((p) => (p.lon > C.lon ? 415 : 419))], C, 'bilim');
  const fa = beamEvents(a, 24)[0], fb = beamEvents(b, 8)[0]; // a'nın batısı = 415, b'nin doğusu = 415
  check(fa && fb && fa.freq === fb.freq, `bilim: iki farklı çevrede 415 → aynı nota (${fa?.freq.toFixed(2)} Hz)`);
  const ha = frame(a.layers.map((l) => l.layer), C, 'hikaye'), hb = frame(b.layers.map((l) => l.layer), C, 'hikaye');
  check(beamEvents(ha, 24)[0].freq !== beamEvents(hb, 8)[0].freq, 'hikâye: aynı 415 çevresine göre farklı nota (yerel ölçek, beklenen)');
}

console.log('5) Gerçek veri');
{
  const read = (f) => JSON.parse(fs.readFileSync(`public/data/${f}`, 'utf8'));
  const co2 = new Co2Source(read('co2_2021_grid.json'), read('co2_2021_stations.json'));
  const sst = new SstSource(read('3912.json'), read('3912_colorscale.json'));
  const cities = new Cities(read('cities.json'));
  const sivas = rowToPlace(cities.find('Sivas'), 'arama');
  const t1 = tour(frame([co2.radarLayer(0)], sivas)), t2 = tour(frame([co2.radarLayer(0)], sivas));
  check(JSON.stringify(t1) === JSON.stringify(t2), 'CO₂ Sivas Ocak: iki çalıştırma aynı');
  check(JSON.stringify(t1) !== JSON.stringify(tour(frame([co2.radarLayer(6)], sivas))), 'CO₂ Sivas Ocak ≠ Temmuz (veri değişince ses değişiyor)');
  const inland = rowToPlace(cities.find('Ulan Bator'), 'arama'); // denizden ~1000+ km
  const seaEvents = tour(frame([sst.radarLayer(0)], inland, 'bilim', 500)).flat();
  check(seaEvents.length === 0, `okyanus katmanı Ulan Bator 500 km (tamamı kara): ${seaEvents.length} nota → sessizlik`);
  const coast = tour(frame([sst.radarLayer(0)], rowToPlace(cities.find('Lisbon'), 'arama'), 'bilim', 500)).flat();
  const lis = frame([sst.radarLayer(0)], rowToPlace(cities.find('Lisbon'), 'arama'), 'bilim', 500);
  const lisEv = Array.from({ length: lis.P.beams }, (_, b) => beamEvents(lis, b)).flat();
  check(coast.length > 0 && lisEv.length > 0, `okyanus katmanı Lizbon 500 km (kıyı): ${coast.length} nota/tur`);
  check(lisEv.every((e) => e.bearing < 45 || e.bearing > 112), `Lizbon'un doğusu (İspanya, kara) sessiz; çalan yönler: ${[...new Set(lisEv.map((e) => Math.round(e.bearing)))].join(', ')}`);
  check(Object.values(PARTS).every((p) => p.span > 0), 'her katmanın nota aralığı tanımlı');
}

console.log(fail ? `\n${fail} kontrol BAŞARISIZ` : '\nTüm ses kontrolleri geçti');
process.exit(fail ? 1 : 0);
