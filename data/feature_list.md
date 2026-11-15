# EarthEar — doğrulanmış özellik listesi (landing sayfası için TEK kaynak)

Kod incelemesinden (2026-11-15). Landing'de buradaki dışında iddia yok.

## Yapı
- Vite 6 + React 18 + TypeScript + Tailwind v4, three.js, Web Audio, Web Speech API. Statik site; sunucu yok, API anahtarı yok.
- Giriş: `src/main.tsx` → `App` (tek sayfa). Başlangıç ekranı `StartGate` (three.js dönen güneş sistemi; Başla / herhangi bir tuş / dokunuş).
- Ses kilidi: ilk kullanıcı hareketinde `engine.unlock()` (AudioContext + iOS sessiz <audio> kilit açma + audioSession 'playback').
- URL parametreleri: `q` (yer adı), `lat`, `lon`, `lang` (tr/en), `hc=1` (yüksek kontrast), `view=2d|3d`. Eklenecek: `layer`, `month`.

## Keşif
- Dünyanın her yerinde radar (hiçbir şehir sabit değil): şehir arama (GeoNames ≥15 bin nüfus), haritaya dokunma, "Konumumu kullan".
- Yer çözümleyici: 242 ülke (başkente gider), 38 kıta/bölge/deniz, Türkçe ekler ve bulanık aday sorusu.
- 3B küre (Blue Marble taban + Natural Earth kıyıları) ya da 2B harita; katman görseli küre üstünde.
- Menzil 500 / 2000 / 5000 km; I/J/K/M ile gezinme; ←/→ ışın.

## Ses
- Radar: ışın döner; yön → stereo, yakın/orta/uzak bant ayrı doku (uzak = kısık, boğuk, gök gürültüsünde gecikme).
- Ses dünyaları (auditory icons): toz = kum fırtınası, kara karbon = yangın, deniz tuzu = serpinti, sülfat = volkan uğultusu, yıldırım = gök gürültüsü, okyanus sıcaklığı = dalga (sıcak yumuşak / soğuk buzlu), gece ışıkları = şehir uğultusu, bitki örtüsü = yaprak + kuş, yüzey sıcaklığı = buzlu rüzgâr ↔ ağustos böceği, akıntı = dalga temposu. Kayıtlı sesler + sentez.
- Veriden doğan müzik: bölgenin zorlanma skoru → majör/minör; toplam yoğunluk → nota sıklığı (tempo); baskın dünya → çalgı; değer → akor derecesi. Rastgelelik yok.
- Ses modları: Doğa / Doğa + müzik / Sadece müzik. Sesli lejant (L), sesli özet (S).

## Katmanlar (canlı)
- NASA SVS görsellerinden (1°): GEOS aerosoller 2025 (5669), ISS LIS yıldırım 2017–2023 (5011), ECCO2 deniz yüzeyi sıcaklığı 2007–08 (3912), GEOS-FP yüzey sıcaklığı (5147), NDVI bitki örtüsü (5544, göreli), gece ışıkları (5313 — LANDING'DE LİSTELENMEZ).
- 5° ayrı katmanlar: OSCAR okyanus akıntıları (m/s, boylam düzeltildi), LIS/OTD yıldırım iklimi (flaş/km²/yıl, log), GEDI kanopi yüksekliği (m, 51,6°K–G).
- Aylık katmanlar (Ceyhun paketi v3, MERRA-2 2024, 2°×2,5°; sesli komutla): yağış, deniz buzu, SO₂, AOD, albedo, 2 m hava sıcaklığı, deri sıcaklığı, ozon, toprak nemi, LAI, su depolama; CO₂ (OCO-2 2021).
- KAPALI / YOK: FIRE, CO, orman değişimi, NOAA.

## Hava durumu
- NASA GMAO GEOS-FP tahmini, 7 gün × 6 saat, statik dosya (günlük GitHub Actions). Bugün kartı, gün düğmeleri, önce ses sonra anlatım. "Model tahmini, resmi uyarı değildir."

## Ses ile kontrol
- Eller serbest: uyandırma kelimesi "Dünya" / "EarthEar" (EN "Earth"). Boşluk basılı tut = konuş (bas-konuş); Konuş düğmesi basılı tut.
- Yazılı komut kutusu (aynı çözümleyici, internetsiz). Çözümleyici KURAL TABANLI (büyük dil modeli değil); arayüzde "AI Guide" adı.
- Sesli rehber (Web Speech sentezi), konuşma hızı 0.8–2×, "tekrar et", "sus".
- Konuşma tanıma: Chrome/Edge (Web Speech API, internet + mikrofon izni). Yoksa yazılı komut.
- Rehberli tur (30 sn, 4 durak), ev konumu (yalnız tarayıcıda), karşılaştırma, Dünya hikâyeleri, NASA EONET olayları.

## Erişilebilirlik
- Tam klavye, ekran okuyucu duyuruları (aria-live), yüksek kontrast, reduced-motion, ≥44 px dokunma alanları.

## Çevrimdışı
- Veri dosyaları statik; sayfa yüklendikten sonra radar ve yazılı komut çalışır. Konuşma tanıma ve EONET internet ister. PWA/service worker YOK (tam çevrimdışı iddia edilemez).
