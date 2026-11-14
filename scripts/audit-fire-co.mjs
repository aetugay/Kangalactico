// FIRE (BCCMASS) ve CO (COSC) için birim/dönüşüm hatası araması. Kullanım: node scripts/audit-fire-co.mjs [referans/v3]
// Bakılanlar: (1) alan ağırlıklı (cos enlem) küresel ortalama, (2) "log" dönüşümünün iki yorumu (log1p ve saf log),
// (3) uzak bölge değerleri, (4) oranların "temiz" bir birim çarpanına (10, 100, 1000, 1e6, 28/29 mol kütlesi …) denk gelip gelmediği.
import fs from 'node:fs';
const DIR = process.argv[2] ?? 'referans/v3';
const M = JSON.parse(fs.readFileSync(`${DIR}/meta.json`, 'utf8'));
const cube = new Int16Array(fs.readFileSync(`${DIR}/monthly_cube.bin`).buffer.slice(0));
const G = M.grid, NP = G.n_points, NLON = G.n_lon;
const latOf = (p) => G.lat0 + Math.floor(p / NLON) * G.dlat, lonOf = (p) => G.lon0 + (p % NLON) * G.dlon;
const inv = {
  log1p: (L, t) => Math.expm1(Math.log1p(L.vmin) + t * (Math.log1p(L.vmax) - Math.log1p(L.vmin))),
  log: (L, t) => Math.exp(Math.log(L.vmin) + t * (Math.log(L.vmax) - Math.log(L.vmin))),
};
const out = {};
for (const id of ['FIRE', 'CO', 'AOD', 'SO2']) {
  const L = M.layers[id], li = L.cube_offset_index; out[id] = { kanit: L.kanit, birim: L.birim, vmin: L.vmin, vmax: L.vmax };
  for (const [name, f] of Object.entries(inv)) {
    let sw = 0, s = 0, remote = [], cnt = 0;
    for (let m = 0; m < 12; m++) for (let p = 0; p < NP; p++) {
      const q = cube[(li * 12 + m) * NP + p]; if (q < 0) continue;
      const v = f(L, q / 1000), w = Math.cos(latOf(p) * Math.PI / 180); s += v * w; sw += w; cnt++;
      const la = latOf(p), lo = lonOf(p); if (la > -50 && la < -30 && lo > -150 && lo < -100) remote.push(v);
    }
    remote.sort((a, b) => a - b);
    out[id][name] = { alanAgirlikliOrt: +(s / sw).toPrecision(4), uzakGPasifikMedyan: +remote[remote.length >> 1].toPrecision(4) };
  }
}
console.log(JSON.stringify(out, null, 1));
