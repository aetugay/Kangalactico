# EarthEar – NASA Space Apps 2026 (The Earth Information Jukebox)

Bu dosya Claude Code için proje bağlamıdır. Her oturumun başında oku.

## Kullanıcı ve ekip
- Tugay Demirci (lider): Uçak mühendisliği 4. sınıf, mobil oyun geliştirici. Türkçe yaz; kısa, adım adım, aksiyon odaklı. **Video ve sunumdan sorumlu.**
- Taha: bilgisayar mühendisi – veri hattı, NASA veri setleri, deploy.
- Ceyhun: robotik & AI – **kullanıcı testinin tamamından sorumlu** (katılımcı bulma, protokol, testi yürütme, analiz).
- Yarışma: 14–15 Kasım 2026, Sivas yerel etkinliği. Pazar 13:00 kod dondurma, akşam teslim.

## Challenge
"The Earth Information Jukebox" (başlangıç/orta). NASA Earth Information Center (EIC, earth.gov) görselleştirmelerini/verisini gerçek zamanlı sonifikasyona çevirmek; görme engelliler için erişilebilirlik.
Jüri kriterleri: Impact, Creativity, Validity, Relevance, Presentation.
Hedef ödüller: Local Impact, Best Use of Science, Most Inspirational, Art & Technology.

## Rekabet / önceki çalışmalar (tekrar etme, üstüne çık)
- 2023 Global Connection kazananı "Arcobaleno" (Brezilya): uzay görüntülerini sese çeviren yöntem + müzik türü kişiselleştirme. → "erişilebilir sonifikasyon" tek başına yeni değil.
- 2026 rakip repo: github.com/NASA-space-app-challenge-2026/shkim – 3D küre + HRTF. → 3D küreyi ana fikir yapma.
- CO₂ ↑ = nota ↑ parçaları, Highcharts Sonification Studio, TwoTone. → genel "CSV'yi sese çevir" aracı yapma.

## Ana deneyim: Radar (EVRENSEL)
- NASA SVS düz 2:1 harita görselleri/videoları piksel analiziyle değere, değer sese çevrilir.
- **Radar kullanıcının seçtiği herhangi bir yerde döner. Hiçbir şehir sabit kodlanmaz** (kod, varsayılan, örnek veri dahil). Açılışta varsayılan konum YOK; kullanıcıdan yer seçmesi istenir, seçmezse "Konumumu kullan" önerilir.
- Konum seçimi üç yol: şehir arama (public/data/cities.json, ekran okuyucuyla erişilebilir ARIA combobox), haritaya dokunma, "Konumumu kullan" (geolocation).
- Eşleme (Caldwell 73 / SVS 13786 yöntemi Dünya'ya uyarlandı): yön → stereo konum, uzaklık → perde, tür/katman → enstrüman, değer → ses şiddeti. Menzil 500 / 2000 / 5000 km. Katmanlar tek tek açılıp kapanır: yüzey sıcaklığı (5147), 4 aerosol türü (5669), yıldırım (5011). Başta 15 sn sesli lejant.
- **Radarın ilk ve ana katmanı: CO₂** (OCO-2 GEOS L3 günlük, 2021; ekip paketi `referans/jukebox_1yillik_tam_paket.json` → `node scripts/co2.mjs` → public/data/co2_2021_grid.json + co2_2021_stations.json). Yalnız ppm tutulur; ses eşlemesini motor yapar. Aylık katmanlar ayın 1. GÜNÜNÜN anlık değeri (aylık ortalama değil). Kredi: "Veri: NASA OCO-2 GEOS Level 3 Daily CO2 (OCO2_GEOS_L3CO2_DAY), GES DISC" (kaynak bağlantısı sonra eklenecek). referans/'taki diğer iki JSON alt küme, kullanılmaz.
- 10 CO₂ istasyonu = Dünya turunda "öne çıkan duraklar"; ana deneyim ızgarayla her yerde çalışır. Enlem halkaları Dünya turu için. "Gezegenin nefesi" sahnesi: seçilen yerin 12 aylık (istasyon yakınsa 365 günlük) CO₂ döngüsü.
- Görüntü sonifikasyonu (yüzey sıcaklığı, aerosoller, yıldırım) ana özellik olarak kalır; ek katmanlar.
- **Radar sadece düz (eşdikdörtgen) haritalarla çalışır.** Küre/3B görseller (4950, 5196) radarda kullanılmaz.
- "Dünya turu" hikâye modu: seçilen yerin enlemi boyunca 30 sn'lik tur, yol üstündeki büyük şehirler sesli anılır.
- Bilim/Hikâye ayrımı ayrı mod değil, **tek basit anahtar** (doğrusal perde/şiddet ↔ pentatonik/normalize).
- Tema: açık ve yüksek kontrastlı arayüz; harita/radar koyu olabilir.

## NASA kuralları (zorunlu)
- NASA logosu, "meatball", "worm", görev amblemleri ve NASA'ya ait hiçbir arma KULLANILMAZ (videolardaki NASA/GMAO logolu bölgeler gösterilmez; işlenmiş veride maskelidir).
- Projenin NASA tarafından onaylandığı izlenimi verilmez.
- SVS veri görselleri/videoları kullanılabilir; her birinin altında ya da "Kaynaklar" bölümünde kredi satırı gösterilir (ör. "Visualization: NASA Scientific Visualization Studio, Kel Elkins"). Kredi satırları public/data/<id>.json `credit` alanında.
- Footer: "Bu proje NASA verisi kullanılarak NASA Space Apps Challenge 2026 için hazırlanmıştır; NASA tarafından onaylanmamıştır."

## Veri dürüstlüğü
- NASA verisini uydurma/tahmin etme. Bilinmeyen → "bilinmiyor".
- Renk skalası sayı içermiyorsa değer iddia etme, "göreli" de (5544, 5196, 5313, 5669 yoğunluk).
- Tahmin kareleri (5147 son kareler) arayüzde "tahmin" diye işaretlenir.
- Ayrıntı: data/catalog.md, data/stage3_notes.md, data/calibration.json.

## Erişilebilirlik kuralları (zorunlu)
- Özel jest sistemi icat etme; VoiceOver/TalkBack ile kusursuz çalış.
- Zaman/konum seçiciler gerçek `<input type="range">`; her değişimde ses + aria-live okuma.
- Her kontrol açıklayıcı etiketli; tam klavye desteği (←/→ ışın yönü, Boşluk çal/durdur, S özet).
- Ses yalnızca kullanıcı dokunuşuyla başlar; iOS için sessiz <audio> kilit açma + navigator.audioSession.type='playback'.

## Teknik
- Vite + React 18 + TypeScript + Tailwind, Web Audio. Statik site, Vercel/GitHub Pages.
- Veri hattı (Node + ffmpeg, tekrar çalıştırılabilir): scripts/download.mjs → calibrate.mjs → colorscales.mjs → process.mjs; sınama: scripts/query.mjs <şehir>. raw/ ve referans/ git'e girmez.
- Ortak ızgara: 360x180 (1°), 8-bit nicemli base64; çözme formülü JSON içinde.
- `demo/index.html` eski CO₂ demosu (yedek).

## Plan
Pazar: 09–12 kullanıcı testi (Ceyhun) + video (Tugay) · 12–13 analiz · 13:00 kod dondurma · 13–18 video/slayt/proje sayfası · 18–20 teslim.
Kesilenler: AI rehber, ayrı bilim/hikâye modu (tek anahtar kalır), titreşim (vakit kalırsa). Kullanıcı testi ve radar kesilmez.
