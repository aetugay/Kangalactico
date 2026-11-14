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
- Eşleme (Caldwell 73 / SVS 13786 yöntemi Dünya'ya uyarlandı; orkestra): yön → stereo konum, tür/katman → enstrüman, değer → nota (yüksek değer ince nota, Do majör pentatonik), ←/→ ile elle çevirince yakın-orta-uzak üç nota. Enstrümanlar: CO₂ keman, yüzey sıcaklığı gitar, okyanus arp + dalga sesi, kara karbon çello, toz çelesta, deniz tuzu flüt, sülfat marimba. Radar 32 adımlı sıralayıcı gibi çalar; yer değişince durmaz (I/K/J/M ile gezilir, zaman korunur). Menzil 500 / 2000 / 5000 km. Sesli lejant (L) ve özet (S) tekrar basınca durur. Sesli rehber (G): düğme adlarını ve duyuruları konuşur; kapalıyken duyurular aria-live ile ekran okuyucuya gider. Kod: src/audio/engine.ts, radarPlayer.ts, speech.ts, src/lib/radar.ts (PARTS).
- Ek özellikler (src/components/Extras.tsx, mantık App.tsx): iki yeri karşılaştır (B; bir tur A bir tur B, "Farkı söyle"), Dünya hikâyeleri (Y; seçilen yerden başlar, kodda sabit yer yok: Gezegenin nefesi, Ekvatora yolculuk, Havadaki yolcular), Dünya olayları (E; NASA EONET canlı, en yakın 8 açık olay), Ses sahnem (V; katman başına ses düzeyi + enstrüman, yankı, konuşma hızı; localStorage), Anlatıcı (N; kural tabanlı, her tur kısa bilgi — yapay zekâ değil). Tarih seçimi: CO₂ ay seçici (tarih çubuğu), sıcaklık ve okyanus tarih seçicileri (katman paneli).
- 3B küre keskinliği (Adım 5, hızlı kısım): dokularda en yüksek anizotropi, pixelRatio = min(devicePixelRatio, 2), vektör kıyı çizgileri Natural Earth 1:50m (kamu malı; scripts/coastline.mjs → public/data/coastline_50m.json, 323 KB; yüklenince raster kıyı kapanır). 8K Blue Marble dokusu ve LOD YAPILMADI. Veri katmanlarının çözünürlüğü yapay artırılmaz.
- Performans: CO₂ ay aralığı (monthRange) önbellekli, küre dokuları 720x360 ve önbellekli; 3D→2D düşüşü 4 sn ısınmadan sonra ortanca kare süresine bakar.
- Sesli komut (T ya da mikrofon düğmesi; src/audio/listen.ts, komut çözümleme App.tsx `runCommand`): bas-konuş, Web Speech API (Chrome/Edge, internet + mikrofon izni). Örnekler: "Ankara'ya git", "çal", "dur", "sıcaklığı aç", "temmuz", "menzil iki bin", "kuzeye git", "Tokyo ile karşılaştır", "nefes hikâyesini anlat", "özet", "yardım". Geliştirmede `window.__cmd('…')` ile mikrofonsuz sınanır.
- Kör kullanıcı için sesli kullanım: açılışta başlatma katmanı (sayfanın ilk h1'i: "Başlamak için herhangi bir tuşa basın ya da ekranın herhangi bir yerine dokunun."); herhangi bir tuş (Tab/Shift/Ctrl/Alt/ekran okuyucu tuşları hariç) ya da dokunuş → AudioContext + mikrofon izni + sesli karşılama + ELLER SERBEST sürekli dinleme (listen.ts handsFree; bitince kendini yeniden başlatır; EarthEar kendi sesiyle konuşurken başlayan tanımalar yok sayılır; kullanıcı konuşunca müzik kısılır). "sus"/"dinlemeyi durdur"/"stop listening" → kapanır; herhangi bir tuş/dokunuş ya da "dinlemeye başla" → açılır. Boşluk kısa = çal/durdur, 400 ms+ basılı = bas-konuş (App.tsx; useRadar Boşluk işlemez). Mobilde altta tam genişlik Konuş. Web Speech yoksa/izin ya da internet yoksa sesli uyarı + odak yazılı kutuya.
- EarthEar AI Guide paneli (src/components/Guide.tsx; sağ sütun): yazılı komut kutusu (sesli komutla AYNI çözümleyici, internetsiz), mikrofon (Web Speech yoksa gizli), durum, önerilen komut çipleri, son 6 komut, anlatıcı. "AI" arayüz adı; çözümleyici kural tabanlı. Komut → onay sesi (engine.confirm) + "Anlaşıldı: …" + komutun kendi duyurusu tek duyuruda (announce yakalama; speech.say öncekini keser); anlaşılmazsa 3 örnek. Sesli komut hatasında (izin/internet/destek yok) yazılı kutuya odak. Sekme sırasında ilk öğe büyük Konuş düğmesi (TopBar; mobilde altta sabit); Alt+T her yerde (yazı alanı/diyalog dahil), ? yardım. 2024 katmanları komutla: "deniz sıcaklığını aç" (sst_24; "okyanus" = ECCO2), "yağışı aç", "deniz buzu", "SO2", "albedo", "hava sıcaklığı", "2024 karbon". Dil: "Switch to English"/"English"/"İngilizceye geç"/"Türkçeye geç"/"Turkish" → arayüz + tanıma dili + rehber sesi birlikte; onay yeni dilde; localStorage.
- Yer adları: fare küre/harita üstünde gezerken altındaki yer söylenir (en kalabalık yakın şehir ya da deniz adı); ←/→ ile ışın çevrilince o yöndeki büyük şehirler ve uzaklıkları söylenir.
- **Radarın ilk ve ana katmanı: CO₂** (OCO-2 GEOS L3 günlük, 2021; ekip paketi `referans/jukebox_1yillik_tam_paket.json` → `node scripts/co2.mjs` → public/data/co2_2021_grid.json + co2_2021_stations.json). Yalnız ppm tutulur; ses eşlemesini motor yapar. Aylık katmanlar ayın 1. GÜNÜNÜN anlık değeri (aylık ortalama değil). Kredi: "Veri: NASA OCO-2 GEOS Level 3 Daily CO2 (OCO2_GEOS_L3CO2_DAY), GES DISC" (kaynak bağlantısı sonra eklenecek). referans/'taki diğer iki JSON alt küme, kullanılmaz.
- 10 CO₂ istasyonu = Dünya turunda "öne çıkan duraklar"; ana deneyim ızgarayla her yerde çalışır. Enlem halkaları Dünya turu için. "Gezegenin nefesi" sahnesi: seçilen yerin 12 aylık (istasyon yakınsa 365 günlük) CO₂ döngüsü.
- Görüntü sonifikasyonu (yüzey sıcaklığı, aerosoller, yıldırım) ana özellik olarak kalır; ek katmanlar.
- **Radar sadece düz (eşdikdörtgen) haritalarla çalışır.** Küre/3B görseller (4950, 5196) radarda kullanılmaz.
- "Dünya turu" hikâye modu: seçilen yerin enlemi boyunca 30 sn'lik tur, yol üstündeki büyük şehirler sesli anılır.
- Bilim/Hikâye ayrımı ayrı mod değil, **tek basit anahtar**: bilim = tam ton dizisi, yalnız veri sesleri (varsayılan); hikâye = pentatonik + merkezden zemin akoru + dalga.
- Ses eşlemesi (Adım 2, lib/radar.ts): değer → ölçekte yeri t → aynı anda perde (2 oktav, dizeye oturtulmuş), vuruş sayısı (1–3) ve parlaklık (süzgeç). Ölçek anahtarı: **yerel** (varsayılan; çalınan ışın ortalamalarının min–max'ı, en az katman aralığının %2'si) / küresel (sabit). Karşılaştırmada yerel ölçek A+B birleşik. Her tur 4 adımlık referans bölümüyle başlar (merkez değeri, "ref" tınısı; karşılaştırmada A sonra B), sonra kuzey zili. Tek katman kendi kaydında; birden çok katman C3–C7 arasında ayrı kayıtlara yayılır. Okunan değer hep gerçek değer. Sınama: npm run test:sound.
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
- Her kontrol açıklayıcı etiketli; tam klavye desteği (Boşluk çal/durdur, ←/→ ışın yönü, I/K/J/M gez, 1–4 katman, S özet, L lejant, C yer seç, H yardım, G sesli rehber, Esc sustur).
- Genel kısayollar yazı alanında (input/textarea/select/combobox/contenteditable) ve açık diyalogda ÇALIŞMAZ (src/lib/keys.ts `shortcutAllowed`); diyalogda Esc yalnız pencereyi kapatır. Dialog (Shell.tsx) efekti yalnız `open`'a bağlı (onClose ref) — yoksa her yeniden çizimde odak ✕'e kayar. Diyalog içeriği `.dialog-body` içinde kayar (85vh), arka plan kilitli. Kök `color-scheme: dark` (yüksek kontrastta light); <option> renkleri index.css'te.
- Ses yalnızca kullanıcı dokunuşuyla başlar; iOS için sessiz <audio> kilit açma + navigator.audioSession.type='playback'.

## Teknik
- Vite + React 18 + TypeScript + Tailwind, Web Audio. Statik site, Vercel/GitHub Pages.
- Veri hattı (Node + ffmpeg, tekrar çalıştırılabilir): scripts/download.mjs → calibrate.mjs → colorscales.mjs → process.mjs; sınama: scripts/query.mjs <şehir>. raw/ ve referans/ git'e girmez.
- Ortak ızgara: 360x180 (1°), 8-bit nicemli base64; çözme formülü JSON içinde.
- `demo/index.html` eski CO₂ demosu (yedek).

## Plan
Pazar: 09–12 kullanıcı testi (Ceyhun) + video (Tugay) · 12–13 analiz · 13:00 kod dondurma · 13–18 video/slayt/proje sayfası · 18–20 teslim.
Kesilenler: AI rehber, ayrı bilim/hikâye modu (tek anahtar kalır), titreşim (vakit kalırsa). Kullanıcı testi ve radar kesilmez.
