// Radar çekirdeğinin gerçek veriyle sınanması: node scripts/test-radar.mjs Tokyo Lagos Sivas
// Şehirler cities.json'dan aranır (kodda koordinat yok). Arayüzün kullandığı src/lib/*.ts doğrudan çalışır.
import fs from 'node:fs';
import { Cities, rowToPlace, placeLabel } from '../src/lib/places.ts';
import { TemperatureSource, Co2Source } from '../src/lib/layers.ts';
import { sampleLayer, summarize, describeBeam, panFor, pitchFor, gainFor, localRange, DEFAULTS } from '../src/lib/radar.ts';
import { destination, haversineKm } from '../src/lib/geo.ts';

const read = (f) => JSON.parse(fs.readFileSync(`public/data/${f}`, 'utf8'));
const cities = new Cities(read('cities.json'));
const temp = new TemperatureSource(read('5147.json'), read('5147_colorscale.json'));
const co2 = new Co2Source(read('co2_2021_grid.json'), read('co2_2021_stations.json'));
let fail = 0;
const check = (ok, msg) => { console.log(`  ${ok ? '✓' : '✗'} ${msg}`); if (!ok) fail++; };

console.log('Genel eşleme');
check(Math.abs(panFor(90) - 1) < 1e-9 && Math.abs(panFor(270) + 1) < 1e-9 && Math.abs(panFor(0)) < 1e-9, 'doğu → sağ (+1), batı → sol (−1), kuzey → orta');
check(pitchFor(7, 8, 'bilim', 130.81) > pitchFor(0, 8, 'bilim', 130.81), 'uzak halka daha tiz (bilim)');
check(Math.abs(pitchFor(7, 8, 'bilim', 100) / 100 - 4) < 1e-9, 'bilim: 8 halka = tam 2 oktav');
const d = destination({ lat: 0, lon: 0 }, 90, 1000);
check(Math.abs(haversineKm({ lat: 0, lon: 0 }, d) - 1000) < 0.01 && Math.abs(d.lat) < 1e-9, 'hedef nokta: 1000 km doğu doğru');

const frame = temp.frames - 1;
for (const q of process.argv.slice(2)) {
  const row = cities.find(q);
  if (!row) { console.log(`\n${q}: bulunamadı`); fail++; continue; }
  const place = rowToPlace(row, 'arama');
  console.log(`\n${placeLabel(place)} (${place.lat}, ${place.lon})`);
  // CO₂ (ilk katman): Ocak ve Temmuz
  for (const m of [0, 6]) {
    const L = co2.radarLayer(m), P = { center: place, rangeKm: 2000, ...DEFAULTS };
    const vals = sampleLayer(L, P);
    console.log(`  [CO₂ ${co2.monthLabel(m)}, 2000 km] ${summarize(L, vals, P, place.name)}`);
    check(localRange(vals).coverage === 1, 'CO₂ kapsama %100');
    const E = DEFAULTS.beams / 4; // 90° doğu ışını
    const km = 4.5 / 8 * 2000, direct = co2.grid.bilinear(destination(place, 90, km), m), nn = co2.grid.nearest(destination(place, 90, km), m);
    check(Math.abs(direct - vals[E * 8 + 4]) < 0.5, `CO₂ doğu ışını ${Math.round(km)} km: radar ${vals[E * 8 + 4].toFixed(2)} ≈ bilinear ${direct.toFixed(2)} (en yakın düğüm ${nn.ppm.toFixed(2)} ppm, ${Math.round(nn.km)} km)`);
  }
  const st = co2.stations.near(place, 3000);
  console.log(`  en yakın CO₂ istasyonu: ${st ? st.s.id + ' (' + Math.round(st.km) + ' km)' : 'yok (3000 km içinde)'}`);
  for (const rangeKm of [500, 2000, 5000]) {
    const L = temp.radarLayer(frame);
    const P = { center: place, rangeKm, ...DEFAULTS };
    const vals = sampleLayer(L, P);
    const loc = localRange(vals);
    console.log(`  [${rangeKm} km] ${summarize(L, vals, P, place.name)}`);
    check(loc.coverage > 0.9, `kapsama %${Math.round(loc.coverage * 100)}`);
    // bağımsız kontrol: doğu ışını (90°), 4. halka değerini doğrudan ızgaradan hesapla
    const b = DEFAULTS.beams / 4, k = 4, km = ((k + 0.5) / P.rings) * rangeKm;
    const direct = temp.layer.sample(frame, destination(place, 90, km));
    check(Math.abs(direct - vals[b * P.rings + k]) < 3, `doğu ışını ${Math.round(km)} km: radar ${vals[b * P.rings + k].toFixed(1)} °C ≈ doğrudan ${direct.toFixed(1)} °C`);
    if (rangeKm === 2000) {
      console.log('    ' + describeBeam(L, vals, P, 0));
      console.log('    ' + describeBeam(L, vals, P, DEFAULTS.beams / 4));
      const g = Array.from({ length: P.rings }, (_, kk) => gainFor(vals[(DEFAULTS.beams / 4) * P.rings + kk], L, 'bilim').toFixed(2));
      console.log(`    doğu ışını şiddetleri (bilim): ${g.join(' ')}`);
    }
  }
}
console.log(fail ? `\n${fail} kontrol BAŞARISIZ` : '\nTüm kontroller geçti');
process.exit(fail ? 1 : 0);
