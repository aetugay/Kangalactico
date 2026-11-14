// Aşama 3 — renk skalası görsellerinden renk→değer tabloları (public/data/<id>_colorscale.json).
// Tüm piksel konumları raw/ altındaki NASA görsellerinden ÖLÇÜLDÜ (bkz. data/stage3_notes.md); değer aralıkları
// görselin kendi etiketlerinden. Etiket yoksa "relative" (0..1) yazılır, birim null.
import fs from 'node:fs';
import { readFrame } from './lib/raster.mjs';

const N = 128; // adım sayısı (≥64 istendi)
const avg = (img, x0, x1, y0, y1) => {
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = y0; y <= y1; y++) for (let x = Math.round(x0); x <= Math.round(x1); x++) {
    const i = (y * img.w + x) * 3; r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++;
  }
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
};
/** Doğrusal skala: değer → x (piksel merkezi) */
function linearSteps(img, { vmin, vmax, xOf, rows, xClamp }) {
  const steps = [];
  for (let i = 0; i < N; i++) {
    const v = vmin + (i / (N - 1)) * (vmax - vmin);
    const x = Math.min(xClamp[1], Math.max(xClamp[0], xOf(v)));
    steps.push({ v: +v.toFixed(4), rgb: avg(img, x - 1, x + 1, rows[0], rows[1]) });
  }
  return steps;
}
/** Aynı renge çok farklı değerlerin karşılık geldiği yerler (renk tekrarı) */
function ambiguity(steps, minDv, maxDist = 18) {
  const out = [];
  for (const a of steps) for (const b of steps) {
    if (b.v <= a.v || b.v - a.v < minDv) continue;
    const d = Math.hypot(a.rgb[0] - b.rgb[0], a.rgb[1] - b.rgb[1], a.rgb[2] - b.rgb[2]);
    if (d < maxDist) out.push({ v1: a.v, v2: b.v, rgbDist: +d.toFixed(1) });
  }
  return out;
}
const write = (id, obj) => {
  fs.writeFileSync(`public/data/${id}_colorscale.json`, JSON.stringify(obj));
  console.log(id, obj.kind, obj.unit ?? '(birimsiz)', obj.steps?.length ?? obj.categories?.length, 'adım', obj.ambiguous?.length ? `· belirsiz çift: ${obj.ambiguous.length}` : '');
};
const SVS = (id) => `https://svs.gsfc.nasa.gov/${id}/`;

// ---- 3912 ECCO2 SST: etiket merkezleri ölçüldü (0→12.5, 10→100.5, 20→187.5, 32→291.5) → en küçük kareler
{
  const img = readFrame('raw/3912/sst_ecco2_cbar.png');
  const L = [[0, 12.5], [10, 100.5], [20, 187.5], [32, 291.5]];
  const n = L.length, sv = L.reduce((a, [v]) => a + v, 0), sx = L.reduce((a, [, x]) => a + x, 0);
  const svv = L.reduce((a, [v]) => a + v * v, 0), svx = L.reduce((a, [v, x]) => a + v * x, 0);
  const k = (n * svx - sv * sx) / (n * svv - sv * sv), c = (sx - k * sv) / n;
  const resid = L.map(([v, x]) => +(x - (k * v + c)).toFixed(2));
  write('3912', { id: '3912', kind: 'continuous', unit: '°C', quantity: 'Deniz yüzeyi sıcaklığı (ECCO2 model)', min: 0, max: 32,
    source: `${SVS(3912)} sst_ecco2_cbar.png`, method: `etiket merkezlerine doğrusal uyum x = ${k.toFixed(4)}·v + ${c.toFixed(2)} (artık px: ${resid.join(', ')}); çubuk iç x 14..291, satır 30..66`,
    steps: linearSteps(img, { vmin: 0, vmax: 32, xOf: (v) => k * v + c, rows: [30, 66], xClamp: [15, 290] }) });
}

// ---- 5147 GEOS-FP T2M: çubuk x 73..462 (390 px), 7 iç çentik 48.75 px aralıkla → 10 °C adım, -40..40
{
  const img = readFrame('raw/5147/NearSurfaceTemperature_colorbar_plain.png');
  const steps = linearSteps(img, { vmin: -40, vmax: 40, xOf: (v) => 73 + ((v + 40) / 80) * 390 - 0.5, rows: [80, 98], xClamp: [74, 461] });
  write('5147', { id: '5147', kind: 'continuous', unit: '°C', quantity: 'Yüzeye yakın hava sıcaklığı T2M (GEOS-FP, 2 m)', min: -40, max: 40,
    source: `${SVS(5147)} NearSurfaceTemperature_colorbar_plain.png (+ etiketli sürüm)`,
    method: 'çubuk x 73..462; çentikler x≈121.5,170.5,218.5,268.5,316.5,365.5,414.5 (48.75 px = 10 °C); satır 80..98',
    notes: ['Etiketli görselde soldan 2. etiket "-10" yazıyor; çentik aralığına göre doğrusu -30 (NASA görselinde yazım hatası).', 'Uçlar doygun: < -40 ve > 40 °C ayırt edilemez.'],
    ambiguous: ambiguity(steps, 15), steps });
}

// ---- 5544 NDVI: etiket yalnızca "Low"…"High" → göreli 0..1, birim yok
{
  const img = readFrame('raw/5544/NDVI_colorbar.png');
  write('5544', { id: '5544', kind: 'relative', unit: null, quantity: 'Bitki örtüsü indeksi NDVI — GÖRELİ (Low→High)', min: 0, max: 1,
    source: `${SVS(5544)} NDVI_colorbar.png`, method: 'çubuk iç x 101..798, satır 112..140; uçlardaki etiketler "Low" ve "High", sayısal değer YOK',
    notes: ['Gerçek NDVI sayısı bilinmiyor; 0 = skalanın sol ucu, 1 = sağ ucu.', 'Okyanus mavisi ve buz/kar beyazı skalada yok → veri yok.'],
    steps: linearSteps(img, { vmin: 0, vmax: 1, xOf: (v) => 101 + v * (798 - 101), rows: [112, 140], xClamp: [102, 797] }) });
}

// ---- 4950 GEDI: üç TIF. 0-50 ve 0-75 AYNI renk geçişi (x 190..1821), farklı etiket. 0-40 ayrı (x 128..1189).
{
  const v = {};
  const g50 = readFrame('raw/4950/GEDI_colorbar_0to50_01.tif');
  const g75 = readFrame('raw/4950/GEDI_colorbar_0to75_01.tif');
  const g40 = readFrame('raw/4950/GEDI_colorbar_0to40_01.tif');
  v['0to50'] = { min: 0, max: 50, method: 'büyük çentikler x≈190,517,843,1169,1495 (326.3 px = 10 m), 50 m x≈1821; satır 1905..1925 (çentiksiz orta bant)', steps: linearSteps(g50, { vmin: 0, vmax: 50, xOf: (h) => 190 + (h / 10) * 326.3, rows: [1905, 1925], xClamp: [196, 1820] }) };
  v['0to75'] = { min: 0, max: 75, method: 'çentikler 108.75 px aralıklı; 0→x 190, 75→x≈1821', steps: linearSteps(g75, { vmin: 0, vmax: 75, xOf: (h) => 190 + (h / 75) * 1631.5, rows: [1905, 1925], xClamp: [196, 1820] }) };
  v['0to40'] = { min: 0, max: 40, method: 'çentikler x≈128,261,393.5,526,658.5,791,923.5,1056 (132.6 px = 5 m), 40 m x≈1189; satır 1975..2020', steps: linearSteps(g40, { vmin: 0, vmax: 40, xOf: (h) => 128 + (h / 5) * 132.6, rows: [1975, 2020], xClamp: [140, 1188] }) };
  let same = 0; for (let i = 0; i < N; i++) { const a = v['0to50'].steps[i].rgb, b = v['0to75'].steps[i].rgb; if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 3) same++; }
  write('4950', { id: '4950', kind: 'continuous', unit: 'm', quantity: 'Orman (bitki örtüsü) yüksekliği GEDI', variants: v, default: '0to50',
    source: `${SVS(4950)} GEDI_colorbar_0to40/0to50/0to75_01.tif`,
    notes: [`ÜÇ skala da aynı renk geçişini kullanıyor, sadece etiket farklı (0to50 vs 0to75: ${same}/${N} adımda RGB farkı < 3). Aynı renk 0to40'ta 10 m, 0to50'de 12.5 m, 0to75'te 18.75 m demek → hangi skalanın kullanıldığı bilinmeden değer okunamaz.`, 'GEDI_global_w_colorbar videosunda ekrandaki skala 0–50 m (kareden okundu) → default 0to50.', 'Çubuğun sağındaki ok: maksimumdan büyük değerler aynı renkte (doygun).', 'Video gölgeli 3B küre: piksel rengi ışıklandırmayla değişir, değer okuma GÜVENİLMEZ.'],
    steps: v['0to50'].steps });
}

// ---- 5669 Aerosoller: kategorik kutucuklar (renkleri görselden ölçüldü)
{
  const img = readFrame('raw/5669/Aerosols_cbar.png');
  const sw = { 'black_carbon': [230, 370], dust: [525, 665], sea_salt: [825, 965], sulfate: [1120, 1260] };
  const label = { black_carbon: 'Black Carbon (kara karbon / is)', dust: 'Dust (toz)', sea_salt: 'Sea Salt (deniz tuzu)', sulfate: 'Sulfate (sülfat)' };
  write('5669', { id: '5669', kind: 'categorical', unit: null, quantity: 'Aerosol türü (GEOS)', source: `${SVS(5669)} Aerosols_cbar.png`,
    method: 'her kutucuğun iç bölgesi (y 170..205) ortalaması',
    notes: ['Renk skalasında yoğunluk (miktar) yok; yalnızca tür. Yoğunluk için parlaklık/doygunluk GÖRELİ kullanılır.', 'API metni "deniz tuzu mavi, duman turuncu/kırmızı" diyor; renk skalası "Sea Salt" gri-camgöbeği, "Black Carbon" kırmızı-turuncu. Renk skalası esas alındı.', 'Haritada türler üst üste toplanarak (additive) karışıyor; ayrıca karada şehir ışıkları var.'],
    categories: Object.entries(sw).map(([k, [x0, x1]]) => ({ id: k, label: label[k], rgb: avg(img, x0, x1, 170, 205) })) });
}

// ---- 5196 DYAMOND: etiketsiz → göreli; sol kısım dama deseni = saydamlık (renk geri kazanılamaz)
{
  const img = readFrame('raw/5196/dyamondCbar_6-27-2024a.png');
  // dama deseni bitişi: iki dama satırı (y 350 ve 405) aynı renge döndüğü ilk x
  let xo = 238; for (let x = 238; x < 1681; x++) { const a = avg(img, x, x, 350, 350), b = avg(img, x, x, 405, 405); if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) > 30) xo = x; }
  const steps = linearSteps(img, { vmin: 0, vmax: 1, xOf: (p) => 238 + p * (1681 - 238), rows: [440, 520], xClamp: [239, 1680] });
  const pOpaque = (xo + 1 - 238) / (1681 - 238);
  write('5196', { id: '5196', kind: 'relative', unit: null, quantity: 'CO₂ (ppm) — DEĞER ARALIĞI BİLİNMİYOR', min: 0, max: 1,
    source: `${SVS(5196)} dyamondCbar_6-27-2024a.png`, method: `çubuk x 238..1681, satır 440..520; dama deseni (saydamlık) x≤${xo} → göreli konum < ${pOpaque.toFixed(3)}`,
    notes: ['Görselde sayı/etiket YOK: ppm karşılığı bilinmiyor.', `Göreli konum < ${pOpaque.toFixed(3)} kısmı saydam (dama deseni); bu renkler alfa-karışım, gerçek renk geri kazanılamaz.`, 'Video 3B küre nokta bulutu: değer okumaya uygun değil.'],
    opaqueFrom: +pOpaque.toFixed(4), steps });
}

// ---- 5313 Night Lights değişim haritası: VİDEOYA GÖMÜLÜ skala (kare 460, değişim bölümü 300..630)
// Etiketler: "lights out" (sol, turuncu) — "no change" (orta, beyaz) — "new lights" (sağ, mor). Sayı YOK → göreli −1..+1.
{
  const img = readFrame('raw/5313/nightlights_flat_series_and_change_wZooms_13_EIC_2160p30_h265.mp4', { frame: 460 });
  // çubuk tam çözünürlükte x 3764..4370, y 1212..1250 (2× büyütülmüş kırpımdan ölçüldü); kenarlardan 3 px içeride örnekle
  const steps = linearSteps(img, { vmin: -1, vmax: 1, xOf: (v) => 3767 + ((v + 1) / 2) * (4367 - 3767), rows: [1222, 1240], xClamp: [3767, 4367] });
  write('5313', { id: '5313', kind: 'relative-diverging', unit: null, quantity: 'Gece ışığı yoğunluğundaki değişim 2012→2023 — GÖRELİ', min: -1, max: 1,
    source: `${SVS(5313)} nightlights_flat_series_and_change_wZooms_13_EIC_2160p30_h265.mp4, kare 460 (videoya gömülü skala)`,
    method: 'çubuk x 3764..4370, y 1212..1250 (tam çözünürlük); satır 1222..1240',
    notes: ['Başlık: "Change in Lighting Intensity from 2012 to 2023". Etiketler: lights out / no change / new lights. Sayısal değer YOK.', 'Haritada renk ayrıca parlaklıkla çarpılmış (karanlık = ışık yok); renk tonu yönü, parlaklık şiddeti verir.', 'Yıllık seri bölümünde (kare 0..283) skala yok: değer = parlaklık (0–255), birimsiz.', 'API ve katalog "renk skalası yok" diyordu; değişim bölümü için bu düzeltildi.'],
    steps });
}
