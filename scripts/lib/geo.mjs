// Düz (equirectangular / plate carrée) harita: lat/lon ↔ piksel.
// bounds: { lonL, lonR, latT, latB } = görüntünün SOL/SAĞ kenarındaki boylam ve ÜST/ALT kenarındaki enlem
// (piksel KENARLARI, merkezleri değil). Kırpılmış ya da gerilmiş görüntüde bunlar kalibrasyonla bulunur.

export function lonLatToPixel(lon, lat, w, h, b) {
  let L = lon;
  const span = b.lonR - b.lonL;
  while (L < b.lonL) L += 360;
  while (L >= b.lonL + 360) L -= 360;
  const x = ((L - b.lonL) / span) * w;
  const y = ((b.latT - lat) / (b.latT - b.latB)) * h;
  return { x, y }; // sürekli koordinat; piksel indeksi = Math.floor
}

export function pixelToLonLat(x, y, w, h, b) {
  return {
    lon: b.lonL + ((x + 0.5) / w) * (b.lonR - b.lonL),
    lat: b.latT - ((y + 0.5) / h) * (b.latT - b.latB),
  };
}

/** Bir pikselin km cinsinden boyutu (bu enlemde). */
export function pixelKm(lat, w, h, b) {
  const R = 6371.0088;
  const kmPerDegLat = (Math.PI * R) / 180;
  return {
    dx: ((b.lonR - b.lonL) / w) * kmPerDegLat * Math.cos((lat * Math.PI) / 180),
    dy: ((b.latT - b.latB) / h) * kmPerDegLat,
  };
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0088, r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const FULL = { lonL: -180, lonR: 180, latT: 90, latB: -90 };

/** Test noktaları (WGS84, şehir merkezi). */
export const TEST_POINTS = [
  { name: 'Sivas', lat: 39.7477, lon: 37.0179 },
  { name: 'Tokyo', lat: 35.6895, lon: 139.6917 },
  { name: 'Lagos', lat: 6.4541, lon: 3.3947 },
  { name: 'New York', lat: 40.7128, lon: -74.006 },
  { name: 'Sidney', lat: -33.8688, lon: 151.2093 },
];
