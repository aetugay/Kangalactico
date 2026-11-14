// Ekip paketi → kompakt CO₂ dosyaları. Kullanım: node scripts/co2.mjs
// Girdi : referans/jukebox_1yillik_tam_paket.json (NASA OCO-2 GEOS L3 günlük CO₂, OCO2_GEOS_L3CO2_DAY, 2021; ekip üretti)
// Çıktı : public/data/co2_2021_grid.json      — 12 aylık 96x60 ızgara + 4 enlem halkası + küresel/yarımküre günlük seri
//         public/data/co2_2021_stations.json  — 10 istasyonun 365 günlük serisi
// Yalnızca ppm tutulur (hz / midi / norm / anomali atılır; ses eşlemesini uygulama yapar).
// Kodlama: tamsayı v → ppm = 400 + v/100 (kaynak 2 ondalıklı → KAYIPSIZ; aşağıda doğrulanır).
import fs from 'node:fs';

const SRC = 'referans/jukebox_1yillik_tam_paket.json';
const j = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const enc = (ppm) => Math.round((ppm - 400) * 100);
const dec = (v) => 400 + v / 100;
const CREDIT = 'Veri: NASA OCO-2 GEOS Level 3 Daily CO2 (OCO2_GEOS_L3CO2_DAY), GES DISC';
const NOTE_TEAM = 'Ekip tarafından GES DISC verisinden üretildi (2021). Ham dosyaya bağlantı sonra eklenecek.';

// ---- ızgara geometrisini veriden çıkar ve doğrula
const months = Object.keys(j.aylik_kure_katmanlari).sort();
const first = j.aylik_kure_katmanlari[months[0]].noktalar;
const lats = [...new Set(first.map((p) => p.lat))].sort((a, b) => a - b);
const lons = [...new Set(first.map((p) => p.lon))].sort((a, b) => a - b);
const nLat = lats.length, nLon = lons.length;
const dLat = +(lats[1] - lats[0]).toFixed(6), dLon = +(lons[1] - lons[0]).toFixed(6);
// Boylam merkezleri yerel 0.625° ızgaranın 6'lı blok ortalaması: -180 + 2.5·0.625 = -178.4375 (kaynakta -178.44'e yuvarlanmış)
const lon0 = -180 + (dLon - 0.625) / 2, lat0 = lats[0];
for (let i = 0; i < nLon; i++) if (Math.abs(lon0 + i * dLon - lons[i]) > 0.006) throw new Error(`boylam düzensiz: ${i} ${lons[i]}`);
for (let k = 0; k < nLat; k++) if (Math.abs(lat0 + k * dLat - lats[k]) > 0.006) throw new Error(`enlem düzensiz: ${k} ${lats[k]}`);

const values = months.map((m) => {
  const arr = new Array(nLat * nLon).fill(null);
  for (const p of j.aylik_kure_katmanlari[m].noktalar) {
    const k = Math.round((p.lat - lat0) / dLat), i = Math.round((p.lon - lons[0]) / dLon);
    if (arr[k * nLon + i] !== null) throw new Error(`tekrar eden nokta ${m} ${p.lat},${p.lon}`);
    arr[k * nLon + i] = enc(p.ppm);
  }
  if (arr.includes(null)) throw new Error(`eksik nokta ${m}`);
  return arr;
});

// ---- enlem halkaları (Dünya turu): yalnız ppm
const ringLats = Object.keys(j.plak_calar_enlem_halkalari[months[0]]).map((k) => +k.replace('enlem_', '')).sort((a, b) => b - a);
const ringLons = j.plak_calar_enlem_halkalari[months[0]][`enlem_${ringLats[0]}`].map((p) => p.lon);
const rings = Object.fromEntries(ringLats.map((la) => [la, months.map((m) => j.plak_calar_enlem_halkalari[m][`enlem_${la}`].map((p) => enc(p.ppm)))]));

// ---- küresel / yarımküre günlük seri (Gezegenin nefesi için)
const T = j.kuresel_gunluk_trend;
const daily = { global: T.map((d) => enc(d.kuresel_ppm)), north: T.map((d) => enc(d.kuzey_yarimkure_ppm)), south: T.map((d) => enc(d.guney_yarimkure_ppm)) };

const grid = {
  id: 'co2_2021', title: 'OCO-2 GEOS Level 3 Daily CO₂ — 2021', titleTr: 'Atmosferik CO₂ (OCO-2 GEOS L3), 2021',
  unit: 'ppm', source: j.meta.veri_kaynagi, credit: CREDIT, notes: [NOTE_TEAM,
    'Aylık katmanlar her ayın 1. GÜNÜNÜN anlık değeridir (aylık ortalama DEĞİL): her ayda katmanın küresel ortalaması o ayın 1. günündeki küresel değere eşit.',
    'Izgara noktaları yerel 0.5°×0.625° ızgaranın 6×6 bloklarının merkezleri (3° × 3.75°).'],
  encoding: 'ppm = 400 + v/100',
  grid: { nLat, nLon, lat0, dLat, lon0, dLon, order: 'k (enlem) güneyden kuzeye, i (boylam) batıdan doğuya; indeks = k·nLon + i', wrapLon: true },
  months, refDates: months.map((m) => j.aylik_kure_katmanlari[m].referans_tarih), values,
  rings: { lats: ringLats, lons: ringLons, byLat: rings, note: 'Ekip paketindeki hazır enlem halkaları (5° boylam aralığı), aylara göre.' },
  daily: { start: T[0].time, days: T.length, ...daily },
};
const stationsOut = {
  id: 'co2_2021_stations', unit: 'ppm', source: j.meta.veri_kaynagi, credit: CREDIT, notes: [NOTE_TEAM, 'İstasyon = belirtilen koordinattaki günlük seri (ölçüm istasyonu değil, OCO-2 GEOS model/veri ızgarasından nokta).'],
  encoding: 'ppm = 400 + v/100', start: T[0].time, days: T.length,
  stations: Object.entries(j.istasyonlar).map(([id, s]) => ({ id, region: s.bolge, lat: s.hedef_lat, lon: s.hedef_lon, ppm: s.gunluk_akis.map((d) => enc(d.ppm)) })),
};
// tarih sırası kontrolü
for (const s of Object.values(j.istasyonlar)) s.gunluk_akis.forEach((d, i) => { if (d.time !== T[i].time) throw new Error('istasyon tarihi uyuşmuyor'); });

// ---- kayıpsızlık doğrulaması
let maxErr = 0;
months.forEach((m, mi) => j.aylik_kure_katmanlari[m].noktalar.forEach((p) => {
  const k = Math.round((p.lat - lat0) / dLat), i = Math.round((p.lon - lons[0]) / dLon);
  maxErr = Math.max(maxErr, Math.abs(dec(values[mi][k * nLon + i]) - p.ppm));
}));
Object.values(j.istasyonlar).forEach((s, si) => s.gunluk_akis.forEach((d, i) => { maxErr = Math.max(maxErr, Math.abs(dec(stationsOut.stations[si].ppm[i]) - d.ppm)); }));
if (maxErr > 1e-9) throw new Error('kodlama kayıplı: ' + maxErr);

fs.writeFileSync('public/data/co2_2021_grid.json', JSON.stringify(grid));
fs.writeFileSync('public/data/co2_2021_stations.json', JSON.stringify(stationsOut));
const kb = (f) => (fs.statSync(f).size / 1024).toFixed(0) + ' KB';
console.log(`ızgara ${nLat}x${nLon}, enlem ${lat0}..${lats.at(-1)} (${dLat}°), boylam ${lon0}..${(lon0 + (nLon - 1) * dLon).toFixed(4)} (${dLon}°), ${months.length} ay`);
console.log('co2_2021_grid.json', kb('public/data/co2_2021_grid.json'), '| co2_2021_stations.json', kb('public/data/co2_2021_stations.json'), '| kodlama hatası', maxErr);
