// Arayüz metinleri (TR/EN). Veri özetleri ve sesli anlatım da seçilen dilde (lib/radar.ts, lib/layers.ts).
export type Lang = 'tr' | 'en';

const T = {
  tagline: { tr: 'Gözlerini kapat. Dünya\'yı dinle.', en: 'Close your eyes. Listen to Earth.' },
  intro: { tr: 'Dünyanın herhangi bir yerini seç; çevresinde dönen bir veri radarı onu sese çevirsin.', en: 'Pick any place on Earth; a data radar sweeping around it turns it into sound.' },
  pick: { tr: 'Bir yer seç', en: 'Choose a place' },
  change: { tr: 'Yeri değiştir', en: 'Change place' },
  searchTitle: { tr: 'Bir yer seç', en: 'Choose a place' },
  orTap: { tr: 'Ya da Dünya\'ya dokun.', en: 'Or tap the globe.' },
  close: { tr: 'Kapat', en: 'Close' },
  play: { tr: 'Radarı çal', en: 'Play radar' },
  stop: { tr: 'Durdur', en: 'Stop' },
  legend: { tr: 'Sesli lejant', en: 'Audio legend' },
  summary: { tr: 'Özet', en: 'Summary' },
  range: { tr: 'Menzil', en: 'Range' },
  layers: { tr: 'Katmanlar', en: 'Layers' },
  speed: { tr: 'Hız', en: 'Speed' },
  story: { tr: 'Müzikal mod', en: 'Musical mode' },
  guide: { tr: 'Sesli rehber', en: 'Voice guide' },
  talk: { tr: 'Sesli komut (T)', en: 'Voice command (T)' },
  talkLong: { tr: 'Konuşarak kullan (T)', en: 'Use by voice (T)' },
  listening: { tr: 'Dinliyorum… konuş', en: 'Listening… speak' },
  stopLegend: { tr: 'Lejantı durdur', en: 'Stop legend' },
  stopSummary: { tr: 'Özeti durdur', en: 'Stop summary' },
  nowPlaying: { tr: 'Şu an', en: 'Now' },
  center: { tr: 'merkezde', en: 'at center' },
  highest: { tr: 'en yüksek yön', en: 'highest toward' },
  instruments: { tr: 'Enstrümanlar', en: 'Instruments' },
  timeline: { tr: 'Tarih (CO₂)', en: 'Date (CO₂)' },
  advance: { tr: 'Çalarken ayları ilerlet', en: 'Advance months while playing' },
  about: { tr: 'Hakkında ve kaynaklar', en: 'About & sources' },
  highContrast: { tr: 'Yüksek kontrast', en: 'High contrast' },
  view3d: { tr: '3D Dünya', en: '3D globe' },
  view2d: { tr: '2D görünüm', en: '2D view' },
  keys: { tr: 'Boşluk: çal/durdur · I/K/J/M: Dünya üzerinde gez · ←/→: ışını çevir · 1–4: katmanlar · S: özet · L: lejant · C: yer seç · B: karşılaştır · Y: hikâyeler · E: olaylar · V: ses sahnem · N: anlatıcı · T: sesli komut · H: yardım · Esc: sustur', en: 'Space: play/stop · I/K/J/M: travel the globe · ←/→: turn beam · 1–4: layers · S: summary · L: legend · C: choose place · B: compare · Y: stories · E: events · V: my soundscape · N: narrator · T: voice command · H: help · Esc: silence' },
  disclaimer: { tr: 'NASA verisi kullanılarak NASA Space Apps Challenge 2026 için hazırlanmıştır; NASA tarafından onaylanmamıştır.', en: 'Built with NASA data for the NASA Space Apps Challenge 2026; not endorsed by NASA.' },
  noLayer: { tr: 'Hiç katman açık değil.', en: 'No layer is on.' },
  fallback: { tr: '2D görünüm: bu cihazda 3D kapalı', en: '2D view: 3D is off on this device' },
} as const;

export type Key = keyof typeof T;
export const tr = (lang: Lang, k: Key) => T[k][lang];
