// Ceyhun'un JSON veri paketi (referans/data/, 2026-11-15; "6 kategori") denetimi. audit-ceyhun.mjs (v3 bin biçimi) ile AYNI denetimler:
// kaynak/etiket uyumu, fiziksel makullük, kopya, kırpma, eksik (-1/null) oranı + v3 ile 5 noktada karşılaştırma. Değer UYDURMAZ.
// Kullanım: node scripts/audit-ceyhun-data.mjs [klasör] → data/audit_ceyhun_data.json
import fs from 'node:fs';
import crypto from 'node:crypto';

const DIR = process.argv[2] ?? 'referans/data', V3 = 'referans/v3';
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'));
const idx = JSON.parse(fs.readFileSync(`${DIR}/jukebox_6_kategori_ana_indeks.json`, 'utf8'));
const q = (a, p) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))] : NaN; };
const r = (x, d = 3) => (Number.isFinite(x) ? +x.toFixed(d) : null);
const hash = (x) => crypto.createHash('md5').update(JSON.stringify(x)).digest('hex').slice(0, 10);
const PTS = { Sivas: [39.75, 37.02], Tokyo: [35.68, 139.69], Lagos: [6.52, 3.38], Amazon: [-3.1, -60.0], Svalbard: [78.22, 15.65] };
const hav = (a, b, c, d) => { const R = Math.PI / 180, x = Math.sin((c - a) * R / 2) ** 2 + Math.cos(a * R) * Math.cos(c * R) * Math.sin((d - b) * R / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
// fiziksel beklenti (kaynak: veri ürünü tanımları / bilinen iklim aralıkları)
const PHYS = {
  aerosoller: [0, 3, 'AOD 550 nm: temiz okyanus ~0.05, Sahra yazın 0.5–1+'],
  yuzey_sicakligi: [-70, 60, 'deri sıcaklığı °C'], hava_sicakligi_2m: [-70, 50, '2 m hava °C'],
  okyanus_sicakligi: [-2.5, 34, 'SST °C (deniz suyu ≥ −1,8)'], okyanus_sicakligi_akintilar: [-2.5, 34, 'SST °C'],
  okyanus_akintilari: [0, 2.5, 'yüzey akıntı hızı m/s: Gulf Stream ~1–2'],
  yildirim: [0, 1.5, 'LIS/OTD LRMC flaş/km²/gün: Kongo yıllık ~100–160/km²/yıl ≈ 0,3–0,45/gün'],
  orman_yuksekligi: [0, 70, 'GEDI rh100 m: tropik orman 25–45'], gece_isiklari: [0, 1000, 'VIIRS radyans nW/cm²/sr'],
};

// v3: monthly_cube (Int16 0..1000, -1 eksik), 2°×2.5°
const M3 = JSON.parse(fs.readFileSync(`${V3}/meta.json`, 'utf8')), G3 = M3.grid, L3 = M3.aylik_kup.katman_sirasi;
const cube = new Int16Array(fs.readFileSync(`${V3}/monthly_cube.bin`).buffer.slice(0));
const v3at = (id, month, lat, lon) => {
  const li = L3.indexOf(id); if (li < 0) return null; const m = M3.layers[id];
  const i = Math.round((lat - G3.lat0) / G3.dlat), j = ((Math.round((lon - G3.lon0) / G3.dlon) % G3.n_lon) + G3.n_lon) % G3.n_lon;
  const v = cube[(li * 12 + month) * G3.n_points + i * G3.n_lon + j]; if (v < 0) return null;
  return m.transform === 'linear' ? r(m.vmin + (v / 1000) * (m.vmax - m.vmin)) : `log(${v})`;
};
const V3MAP = { aerosoller: 'AOD', yuzey_sicakligi: 'LST', hava_sicakligi_2m: 'TEMP', okyanus_sicakligi: 'SST', okyanus_sicakligi_akintilar: 'SST' };

const out = { klasor: DIR, indeks: idx.uretim_tarihi, sahte_veri: idx.sahte_veri, dosyalar: [], katmanlar: {}, kopyalar: [], v3_katmanlari: L3.map((k) => `${k}: ${M3.layers[k].kaynak}`) };
for (const f of files) out.dosyalar.push({ ad: f, kb: Math.round(fs.statSync(`${DIR}/${f}`).size / 1024) });

const monthHashes = [];
for (const [key, A] of Object.entries(idx.akislar)) {
  const K = JSON.parse(fs.readFileSync(`${DIR}/${A.dosyalar.kure_12ay}`, 'utf8')), T = JSON.parse(fs.readFileSync(`${DIR}/${A.dosyalar.tam_paket}`, 'utf8')), S = JSON.parse(fs.readFileSync(`${DIR}/${A.dosyalar.istasyonlar_365gun}`, 'utf8'));
  const m = K.meta, months = Object.keys(K.aylik_kure_katmanlari);
  const first = K.aylik_kure_katmanlari[months[0]].noktalar;
  const lats = [...new Set(first.map((p) => p.lat))].sort((a, b) => a - b), lons = [...new Set(first.map((p) => p.lon))].sort((a, b) => a - b);
  const step = (a) => r(q(a.slice(1).map((x, i) => x - a[i]), 0.5), 2);
  const [pmin, pmax, pnote] = PHYS[key] ?? [-Infinity, Infinity, ''];
  const per = months.map((mo) => {
    const P = K.aylik_kure_katmanlari[mo].noktalar, v = P.map((p) => (p.deger === null || p.deger === -1 ? NaN : +p.deger));
    const bad = v.filter((x) => !Number.isFinite(x)).length, fin = v.filter(Number.isFinite);
    const atMin = fin.filter((x) => x === m.min_referans).length, atMax = fin.filter((x) => x === m.max_referans).length;
    const normOk = P.filter((p) => Number.isFinite(+p.norm)).every((p) => Math.abs(+p.norm - Math.max(0, Math.min(1, (+p.deger - m.min_referans) / (m.max_referans - m.min_referans)))) < 0.01);
    const normEqVal = P.every((p) => p.norm === p.deger), ppmEqVal = P.every((p) => p.ppm === p.deger);
    monthHashes.push({ key, mo, h: hash(v) });
    return { ay: mo, n: P.length, eksik: bad, min: r(q(fin, 0)), p01: r(q(fin, 0.01)), p50: r(q(fin, 0.5)), p99: r(q(fin, 0.99)), max: r(q(fin, 1)), ust_ref_ustu: fin.filter((x) => x > m.max_referans).length, alt_ref_alti: fin.filter((x) => x < m.min_referans).length, min_refe_esit: atMin, max_refe_esit: atMax, fizik_disi: fin.filter((x) => x < pmin || x > pmax).length, norm_formulu_tutar: normOk, norm_eq_deger: normEqVal, ppm_eq_deger: ppmEqVal, ort: K.aylik_kure_katmanlari[mo].ort_deger };
  });
  // 5 nokta: en yakın nokta (uzaklık ile), iki ay (ilk ay ve 6 ay sonrası)
  const pts = {};
  for (const [nm, [la, lo]] of Object.entries(PTS)) {
    pts[nm] = {};
    for (const mo of [months[0], months[Math.min(months.length - 1, 3)], months[Math.min(months.length - 1, 9)]]) {
      const P = K.aylik_kure_katmanlari[mo].noktalar; let best = null, bd = Infinity;
      for (const p of P) { const d = hav(la, lo, p.lat, p.lon); if (d < bd) { bd = d; best = p; } }
      const mi = /\d{4}-(\d{2})/.exec(mo)?.[1] ?? /-(\d{2})$/.exec(mo)?.[1];
      pts[nm][mo] = { deger: best?.deger ?? null, nokta: best ? `${best.lat},${best.lon}` : null, km: Math.round(bd), v3_ayni_takvim_ayi: V3MAP[key] && mi ? v3at(V3MAP[key], +mi - 1, la, lo) : undefined };
    }
  }
  const stN = Object.values(S.istasyonlar ?? {}).map((s) => s.gunluk_akis?.length ?? 0);
  out.katmanlar[key] = {
    baslik: A.baslik, kaynak: m.veri_kaynagi, birim: m.birim, ref: [m.min_referans, m.max_referans], tarih: m.tarih_araligi, ay_sayisi: months.length, aylar: months,
    gercek_kayit: m.gercek_kayit, veri_yok_kayit: m.veri_yok_kayit, not: m.not, fizik_beklenti: pnote,
    izgara: { nokta: first.length, enlem_sayisi: lats.length, boylam_sayisi: lons.length, enlem_adim: step(lats), boylam_adim: step(lons), enlem_araligi: [lats[0], lats[lats.length - 1]], ornek_enlemler: lats.slice(0, 4) },
    tam_paket_kure_ile_ayni: hash(T.aylik_kure_katmanlari) === hash(K.aylik_kure_katmanlari),
    istasyon: { sayi: stN.length, zaman_adimi: [...new Set(stN)], ad: Object.keys(S.istasyonlar ?? {}) }, aylik: per, noktalar: pts,
  };
}
// kopya: aynı değer dizisi farklı ay/katmanda
const byH = new Map(); for (const x of monthHashes) { if (!byH.has(x.h)) byH.set(x.h, []); byH.get(x.h).push(`${x.key}/${x.mo}`); }
out.kopyalar = [...byH.values()].filter((g) => g.length > 1);
fs.writeFileSync('data/audit_ceyhun_data.json', JSON.stringify(out, null, 1));
// kısa özet
for (const [k, L] of Object.entries(out.katmanlar)) {
  const a = L.aylik, fd = a.reduce((s, x) => s + x.fizik_disi, 0), ek = a.reduce((s, x) => s + x.eksik, 0), n = a.reduce((s, x) => s + x.n, 0);
  console.log(`\n## ${k} — ${L.kaynak} [${L.birim}] ref ${L.ref.join('–')} · ${L.ay_sayisi} ay (${L.aylar[0]}…${L.aylar[L.aylar.length - 1]}) · ızgara ${L.izgara.nokta} nokta, ${L.izgara.enlem_sayisi}×${L.izgara.boylam_sayisi}, adım ${L.izgara.enlem_adim}°×${L.izgara.boylam_adim}°, enlem ${L.izgara.enlem_araligi.join('…')} · istasyon ${L.istasyon.sayi}×${L.istasyon.zaman_adimi.join('/')} adım · tam_paket=küre ${L.tam_paket_kure_ile_ayni}`);
  console.log(`   eksik %${(100 * ek / n).toFixed(1)} · fizik dışı ${fd} · min/p50/max (aylar arası): ${r(Math.min(...a.map((x) => x.min)))} / ${r(q(a.map((x) => x.p50), 0.5))} / ${r(Math.max(...a.map((x) => x.max)))} · max_ref'e eşit (toplam) ${a.reduce((s, x) => s + x.max_refe_esit, 0)} · ref üstü ${a.reduce((s, x) => s + x.ust_ref_ustu, 0)} · min_ref'e eşit ${a.reduce((s, x) => s + x.min_refe_esit, 0)} · norm formülü ${a.every((x) => x.norm_formulu_tutar)} · norm=deger ${a.every((x) => x.norm_eq_deger)} · ppm=deger ${a.every((x) => x.ppm_eq_deger)}`);
  for (const [nm, v] of Object.entries(L.noktalar)) console.log(`   ${nm.padEnd(9)} ` + Object.entries(v).map(([mo, x]) => `${mo}: ${x.deger}${x.km > 150 ? ` (${x.km} km)` : ''}${x.v3_ayni_takvim_ayi !== undefined ? ` [v3 2024: ${x.v3_ayni_takvim_ayi}]` : ''}`).join(' · '));
}
console.log('\nKOPYA gruplar:', out.kopyalar.length ? out.kopyalar.map((g) => g.join(' = ')).join('\n  ') : 'yok');
