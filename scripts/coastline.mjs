// Natural Earth 50m kıyı çizgisi (kamu malı, naturalearthdata.com) → küre üstünde vektör çizgi için kompakt dosya.
// Girdi : raw/natural_earth/ne_50m_coastline.geojson (git'e girmez; kaynak: github.com/nvkelso/natural-earth-vector)
// Çıktı : public/data/coastline_50m.json — { lines: n, starts: [...], data: base64(Int16 [lon*100, lat*100, ...]) }
import fs from 'node:fs';
const g = JSON.parse(fs.readFileSync('raw/natural_earth/ne_50m_coastline.geojson', 'utf8'));
const pts = [], starts = [];
for (const f of g.features) {
  const geom = f.geometry; const parts = geom.type === 'LineString' ? [geom.coordinates] : geom.type === 'MultiLineString' ? geom.coordinates : [];
  for (const line of parts) { if (line.length < 2) continue; starts.push(pts.length / 2); for (const [lon, lat] of line) pts.push(Math.round(lon * 100), Math.round(lat * 100)); }
}
const buf = Buffer.from(new Int16Array(pts).buffer);
fs.writeFileSync('public/data/coastline_50m.json', JSON.stringify({
  source: 'Natural Earth 1:50m Coastline (public domain), naturalearthdata.com', encoding: 'Int16 LE çiftleri [boylam×100, enlem×100]; starts = her çizginin ilk nokta indeksi',
  points: pts.length / 2, starts, data: buf.toString('base64'),
}));
console.log('çizgi', starts.length, 'nokta', pts.length / 2, '→', (fs.statSync('public/data/coastline_50m.json').size / 1024).toFixed(0), 'KB');
