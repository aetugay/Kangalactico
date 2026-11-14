// Adım 1 doğrulaması: "ses veriden gelir"; Adım 2: "farklar duyulsun". node scripts/test-sound.mjs  (npm run test:sound)
// Arayüzün kullandığı saf fonksiyonu (src/lib/radar.ts → beamEvents) sınar; ses kartı gerekmez.
import fs from 'node:fs';
import { beamEvents, refEvents, registers, noteHz, sampleLayer, playedRange, DEFAULTS, PARTS, REG_MIN, pentaHz } from '../src/lib/radar.ts';
import { Co2Source, SstSource } from '../src/lib/layers.ts';
import { Cities, rowToPlace } from '../src/lib/places.ts';

let fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? '✓' : '✗'} ${msg}`); if (!ok) fail++; };
const P = (center, rangeKm = 2000) => ({ center, rangeKm, ...DEFAULTS });
const frame = (layers, center, mode = 'bilim', rangeKm = 2000, scale = 'local') => {
  const p = P(center, rangeKm);
  return { P: p, mode, scale, layers: layers.map((layer) => { const vals = sampleLayer(layer, p); return { layer, vals, local: playedRange(layer, vals, p, [layer.sample(center)]) }; }) };
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

console.log('4) Küresel ölçek: aynı değer her yerde aynı nota; yerel ölçek çevreye göre');
{
  const la = synth((p) => (p.lon > C.lon ? 405 : 415)), lb = synth((p) => (p.lon > C.lon ? 415 : 419));
  const a = frame([la], C, 'bilim', 2000, 'global'), b = frame([lb], C, 'bilim', 2000, 'global');
  const fa = beamEvents(a, 24)[0], fb = beamEvents(b, 8)[0]; // a'nın batısı = 415, b'nin doğusu = 415
  check(fa && fb && fa.freq === fb.freq, `küresel: iki farklı çevrede 415 → aynı nota (${fa?.freq.toFixed(2)} Hz)`);
  const ha = frame([la], C), hb = frame([lb], C);
  check(beamEvents(ha, 24)[0].freq !== beamEvents(hb, 8)[0].freq, 'yerel: aynı 415 çevresine göre farklı nota (beklenen)');
  check(ha.scale === 'local' && beamEvents(ha, 24)[0].valueText === '415', 'yerel ölçekte bile okunan değer gerçek değer (415)');
}

console.log('4b) Adım 2: farklar duyulsun');
{
  // doğuya doğru 400 → 401 ppm (küçük fark): yerel ölçekte en az 2 oktava yayılmalı
  const grad = synth((p) => 400 + Math.max(0, Math.min(1, (p.lon - C.lon + 25) / 50)));
  for (const mode of ['bilim', 'hikaye']) {
    const F = frame([grad], C, mode);
    const evs = Array.from({ length: F.P.beams }, (_, b) => beamEvents(F, b)).flat();
    const fs = evs.map((e) => e.freq), lo = Math.min(...fs), hi = Math.max(...fs);
    const loT = Math.min(...evs.map((e) => e.t)), hiT = Math.max(...evs.map((e) => e.t));
    const semis = fs.map((f) => 12 * Math.log2(f / pentaHz(REG_MIN)));
    const ok = mode === 'bilim' ? semis.every((s) => Math.abs(s / 2 - Math.round(s / 2)) < 1e-6) : semis.every((s) => [0, 2, 4, 7, 9].includes(((Math.round(s) % 12) + 12) % 12) && Math.abs(s - Math.round(s)) < 1e-6);
    check(ok, `${mode}: notalar dizeye oturuyor (${mode === 'bilim' ? 'tam ton' : 'pentatonik'}; kromatik değil)`);
    const full = noteHz(1, PARTS.co2, mode) / noteHz(0, PARTS.co2, mode);
    check(Math.abs(full - 4) < 1e-9, `${mode}: ölçeğin tamamı tam 2 oktav (${full.toFixed(2)}×)`);
    check(hi / lo > 3.99, `${mode}: 1 ppm'lik yerel fark ${(12 * Math.log2(hi / lo)).toFixed(0)} yarım tona yayıldı (t ${loT.toFixed(2)}…${hiT.toFixed(2)})`);
  }
  const F = frame([grad], C);
  const evs = Array.from({ length: F.P.beams }, (_, b) => beamEvents(F, b)).flat().sort((x, y) => x.value - y.value);
  check(evs.every((e, i) => i === 0 || (e.hits >= evs[i - 1].hits && e.bright >= evs[i - 1].bright)), 'değer arttıkça vuruş sayısı ve parlaklık da artıyor (azalmıyor)');
  check(evs[0].hits === 1 && evs[evs.length - 1].hits === 3, `en düşük değer 1 vuruş, en yüksek 3 vuruş`);
  const flat = frame([synth(() => 412 + 1e-4)], C);
  check(new Set(Array.from({ length: 32 }, (_, b) => beamEvents(flat, b)).flat().map((e) => e.freq)).size === 1, 'neredeyse düz alan (≈0 fark) şişirilmiyor: tek nota');
  const r = refEvents(F);
  check(r.length === 1 && r[0].value === grad.sample(C) && r[0].pan === 0, `tur başı referans: merkez değeri ${r[0]?.valueText} → ${r[0]?.freq.toFixed(1)} Hz, ortada`);
  const ev0 = evs.find((e) => Math.abs(e.value - r[0].value) < 1e-9);
  check(!ev0 || ev0.freq === r[0].freq, 'referans tonu aynı ölçek ve kayıtta (aynı değer → aynı nota)');
  const tokyo = { lat: 35.68, lon: 139.69 };
  const cmp = { ...frame([grad], C), refs: [{ tag: 'A', name: 'A', center: C }, { tag: 'B', name: 'B', center: tokyo }] };
  check(refEvents(cmp).map((e) => e.ref.tag).join('') === 'AB', 'karşılaştırma: referanslar önce A sonra B');
  check(refEvents(frame([synth(() => NaN)], C)).length === 0, 'merkezde veri yok → referans tonu yok');
  const regs = registers(['temp', 'co2']);
  const top0 = noteHz(1, PARTS.temp, 'bilim', regs[0]), bot1 = noteHz(0, PARTS.co2, 'bilim', regs[1]);
  check(regs[0] < regs[1] && top0 <= bot1 + 1e-9, `iki katman ayrı kayıtlarda: gitar ${noteHz(0, PARTS.temp, 'bilim', regs[0]).toFixed(0)}–${top0.toFixed(0)} Hz, keman ${bot1.toFixed(0)}–${noteHz(1, PARTS.co2, 'bilim', regs[1]).toFixed(0)} Hz`);
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
  check(Object.values(PARTS).every((p) => p.every > 0), 'her katmanın ritmi tanımlı');
}

console.log(fail ? `\n${fail} kontrol BAŞARISIZ` : '\nTüm ses kontrolleri geçti');
process.exit(fail ? 1 : 0);
