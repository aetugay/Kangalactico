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

## SES DÜNYALARI (15 Kasım 2026 gece, kullanıcı testinden sonra ANA YAKLAŞIM)
- Nota/enstrüman eşlemesi bırakıldı (perde değişimi artış/azalış olarak hissedilmedi). Eski sürüm: dal `yedek-nota-motoru`.
- Her veri doğadaki kendi sesiyle (auditory icons): TÜR = ne var, ŞİDDET + SIKLIK = ne kadar. Web Audio prosedürel sentez (ses dosyası yok): src/audio/engine.ts `world()`; saf parametreler src/lib/worlds.ts (`worldParams`, `describeWorld`); radar olayları src/lib/radar.ts `worldEvents` / `worldRefEvents`.
- 6 katman (yalnız challenge SVS görsellerinden): aerosoller 5669 (toz = kum fırtınası, kara karbon = yangın çıtırtısı, deniz tuzu = serpinti, sülfat = volkan uğultusu) · yıldırım 5011 (gök gürültüsü; yakın sert, uzak boğuk + gecikmeli) · okyanus 3912 (dalga; sıcak yumuşak, soğuk sert/buzlu; akıntı hızı ızgaradan çıkarılamadı) · gece ışıkları 5313 (şehir uğultusu; karanlık = sessiz) · orman: radarda 5544 NDVI (yaprak + kuş; çıplak = rüzgâr), 4950 GEDI küre olduğu için yalnız "görüntüyü dinle" (orman sesiyle) · yüzey sıcaklığı 5147 (buzlu rüzgâr ↔ ağustos böcekleri). 5533 hava kalitesi YAPILMADI (indirilmedi).
- Ölçek KÜRESEL. Radar: yön → stereo; her ışında yakın/orta/uzak bant ayrı doku (uzak = kısık + alçak geçiren + gürlemede gecikme); tur başında merkezin sesi en net. Gösterge ve ekran okuyucu her yön için sözlü özet ("Kuzeydoğu: yoğun kum fırtınası (toz) · yakın"). Lejant her dünyayı anlatıp az/çok örneği çalar. Temalar: Çöl ve Toz, Fırtına, Okyanus, Şehirler ve Ormanlar, Sıcak ve Soğuk.
- Kayıtlı sesler: public/sounds/*.mp3 (`npm run sounds` → scripts/sounds.mjs; ham orijinaller public/sounds/raw/, git'e ve derlemeye girmez). Mono, loudnorm −20 LUFS, 128 kbps, ≤1 MB; döngüler sonu başına yumuşak geçişli; gök gürültüleri dosyanın <200 Hz enerji tepelerinden otomatik kesilir. src/audio/soundbank.ts (WORLD_SOUNDS / WEATHER_SOUNDS; katman/hava ilk açıldığında yüklenir). Motor yoğunluğa göre hafif ↔ şiddetli geçiş yapar; dosya yoksa/yüklenmediyse SENTEZ. Eksik (sentez): sehir_trafik, sehir_kalabalik, agustos_bocegi, volkan.
- VERİDEN DOĞAN MÜZİK (src/lib/music.ts saf; engine.musicNote, müzik kanalı 0.25 kazanç + 2.8 kHz alçak geçiren → doğanın altında): ruh hali = radar alanının zorlanması (toz, duman, şimşek, aşırı sıcak/soğuk; zengin orman azaltır) → majör ↔ minör; toplam yoğunluk → nota sıklığı; her tur bir cümle (ruh hali tur başında); ışındaki baskın dünya → çalgı (okyanus arp, soğuk çelesta, duman yaylı tremolo, toz pad+flüt, şimşek timpani, orman marimba+üflemeli, şehir synth nabzı, sıcak drone), değer → akor derecesi. Rastgelelik yok; veri yoksa müzik yok. Ses modu: Doğa (bilim) / Doğa + müzik (varsayılan) / Sadece müzik; komut "müziği aç/kapat", "sadece doğa", "sadece müzik". Rehber konuşurken kısma (engine.duck). Hava durumu müziği weatherMusic. Sınama: npm run test:music. Yedek dal: yedek-doga-sesleri.
- CO₂ (OCO-2) ve MERRA-2 ana deneyimden çıktı; dosyalar duruyor, Hakkında → "Veri doğrulaması". Sınama: npm run test:worlds (data/ses_dunyalari_test.md).

## Meteorolog (hava asistanı)
- Veri: NASA GMAO GEOS-FP tahmini, NCCS OPeNDAP (herkese açık, giriş yok, CORS yok → tarayıcıdan değil). `npm run forecast` (scripts/forecast.mjs) en yeni 00Z çalıştırmasından 7 gün × 00/06/12/18 UTC × t2m, u10m, v10m, prectot, precsno, preccon, cldtot; 2° × 2.5° → public/data/forecast.bin (~5 MB) + forecast_meta.json. Sunucu çok adımlı istekte 504 verir → adım başına istek (~84 istek, ~3 dk). GitHub Actions .github/workflows/forecast.yml her gün 06:00 UTC tazeler.
- src/lib/forecast.ts (günlük özet, durum, anlatım, ses sahnesi), src/components/Weather.tsx (bugün kartı + gün düğmeleri), engine.weather() (yağmur/kar/rüzgâr + ses dünyaları). Komut: "Dünya, Ankara'da hava nasıl", "burada hava nasıl", "daha fazla"; W kısayolu. Gök gürültüsü yalnız OLASILIK (konvektif yağış). Her zaman kaynak + çalıştırma saati + "model tahmini, resmi uyarı değildir"; 24 saatten eskiyse tarih uyarısı. "Bugün" yerel takvime göre; gün özetleri UTC günü.
- Not: Vite dev, .bin dosyalarını izlemez; YENİ bir .bin yolu eklenirse dev sunucusu yeniden başlatılmalı (var olan dosyanın güncellenmesi sorun değil).

## Ana deneyim: Radar (EVRENSEL)
- NASA SVS düz 2:1 harita görselleri/videoları piksel analiziyle değere, değer sese çevrilir.
- **Radar kullanıcının seçtiği herhangi bir yerde döner. Hiçbir şehir sabit kodlanmaz** (kod, varsayılan, örnek veri dahil). Açılışta varsayılan konum YOK; kullanıcıdan yer seçmesi istenir, seçmezse "Konumumu kullan" önerilir.
- Konum seçimi üç yol: şehir arama (public/data/cities.json, ekran okuyucuyla erişilebilir ARIA combobox), haritaya dokunma, "Konumumu kullan" (geolocation).
- Eşleme (Caldwell 73 / SVS 13786 yöntemi Dünya'ya uyarlandı; orkestra): yön → stereo konum, tür/katman → enstrüman, değer → nota (yüksek değer ince nota, Do majör pentatonik), ←/→ ile elle çevirince yakın-orta-uzak üç nota. Enstrümanlar: CO₂ keman, yüzey sıcaklığı gitar, okyanus arp + dalga sesi, kara karbon çello, toz çelesta, deniz tuzu flüt, sülfat marimba. Radar 32 adımlı sıralayıcı gibi çalar; yer değişince durmaz (I/K/J/M ile gezilir, zaman korunur). Menzil 500 / 2000 / 5000 km. Sesli lejant (L) ve özet (S) tekrar basınca durur. Sesli rehber (G): düğme adlarını ve duyuruları konuşur; kapalıyken duyurular aria-live ile ekran okuyucuya gider. Kod: src/audio/engine.ts, radarPlayer.ts, speech.ts, src/lib/radar.ts (PARTS).
- Ek özellikler (src/components/Extras.tsx, mantık App.tsx): iki yeri karşılaştır (B; bir tur A bir tur B, "Farkı söyle"), Dünya hikâyeleri (Y; seçilen yerden başlar, kodda sabit yer yok: Gezegenin nefesi, Ekvatora yolculuk, Havadaki yolcular), Dünya olayları (E; NASA EONET canlı, en yakın 8 açık olay), Ses sahnem (V; katman başına ses düzeyi + enstrüman, yankı, konuşma hızı; localStorage), Anlatıcı (N; kural tabanlı, her tur kısa bilgi — yapay zekâ değil). Tarih seçimi: CO₂ ay seçici (tarih çubuğu), sıcaklık ve okyanus tarih seçicileri (katman paneli).
- Görsel (yalnız görsel, ses DEĞİŞMEZ): taban NASA Blue Marble NG (public/media/bluemarble_4096.jpg, dokunmatikte 2048; kredi Kaynaklar'da); veri katmanı 1440×720 dokuya yumuşak (Layer.sample / M24.visual 'smooth') çizilir, opaklık 0.65; yalnız kara/deniz katmanları Natural Earth 50m kara poligonlarıyla kırpılır (lib/nemask.ts, public/data/land_50m.json, meta domain). "Veri hücrelerini göster" = ham hücreler; üstte "Veri çözünürlüğü: ~X km" etiketi. Radar/ses 'sound' örneklemesini (gerçek hücreler) kullanır. Eller serbest dinlemede uyandırma kelimesi "Dünya"/"EarthEar" (EN "Earth"); olmayan konuşma sessizce yok sayılır; bas-konuş/Alt+T/Konuş/yazılı kutuda gerekmez. Düğme dili index.css sonunda (birincil/ikincil/öneri, ≥44 px).
- 3B küre keskinliği (Adım 5, hızlı kısım): dokularda en yüksek anizotropi, pixelRatio = min(devicePixelRatio, 2), vektör kıyı çizgileri Natural Earth 1:50m (kamu malı; scripts/coastline.mjs → public/data/coastline_50m.json, 323 KB; yüklenince raster kıyı kapanır). 8K Blue Marble dokusu ve LOD YAPILMADI. Veri katmanlarının çözünürlüğü yapay artırılmaz.
- Performans: CO₂ ay aralığı (monthRange) önbellekli, küre dokuları 720x360 ve önbellekli; 3D→2D düşüşü 4 sn ısınmadan sonra ortanca kare süresine bakar.
- Sesli komut (T ya da mikrofon düğmesi; src/audio/listen.ts, komut çözümleme App.tsx `runCommand`): bas-konuş, Web Speech API (Chrome/Edge, internet + mikrofon izni). Örnekler: "Ankara'ya git", "çal", "dur", "sıcaklığı aç", "temmuz", "menzil iki bin", "kuzeye git", "Tokyo ile karşılaştır", "nefes hikâyesini anlat", "özet", "yardım". Geliştirmede `window.__cmd('…')` ile mikrofonsuz sınanır.
- Kör kullanıcı için sesli kullanım: açılışta başlatma katmanı (sayfanın ilk h1'i: "Başlamak için herhangi bir tuşa basın ya da ekranın herhangi bir yerine dokunun."); herhangi bir tuş (Tab/Shift/Ctrl/Alt/ekran okuyucu tuşları hariç) ya da dokunuş → AudioContext + mikrofon izni + sesli karşılama + ELLER SERBEST sürekli dinleme (listen.ts handsFree; bitince kendini yeniden başlatır; EarthEar kendi sesiyle konuşurken başlayan tanımalar yok sayılır; kullanıcı konuşunca müzik kısılır). "sus"/"dinlemeyi durdur"/"stop listening" → kapanır; herhangi bir tuş/dokunuş ya da "dinlemeye başla" → açılır. Boşluk kısa = çal/durdur, 400 ms+ basılı = bas-konuş (App.tsx; useRadar Boşluk işlemez). Mobilde altta tam genişlik Konuş. Web Speech yoksa/izin ya da internet yoksa sesli uyarı + odak yazılı kutuya.
- EarthEar AI Guide paneli (src/components/Guide.tsx; sağ sütun): yazılı komut kutusu (sesli komutla AYNI çözümleyici, internetsiz), mikrofon (Web Speech yoksa gizli), durum, önerilen komut çipleri, son 6 komut, anlatıcı. "AI" arayüz adı; çözümleyici kural tabanlı. Komut → onay sesi (engine.confirm) + "Anlaşıldı: …" + komutun kendi duyurusu tek duyuruda (announce yakalama; speech.say öncekini keser); anlaşılmazsa 3 örnek. Sesli komut hatasında (izin/internet/destek yok) yazılı kutuya odak. Sekme sırasında ilk öğe büyük Konuş düğmesi (TopBar; mobilde altta sabit); Alt+T her yerde (yazı alanı/diyalog dahil), ? yardım. 2024 katmanları komutla: "deniz sıcaklığını aç" (sst_24; "okyanus" = ECCO2), "yağışı aç", "deniz buzu", "SO2", "albedo", "hava sıcaklığı", "2024 karbon". Dil: "Switch to English"/"English"/"İngilizceye geç"/"Türkçeye geç"/"Turkish" → arayüz + tanıma dili + rehber sesi birlikte; onay yeni dilde; localStorage.
- Ceyhun paketi sürüm 3 (referans/v3/; denetim: node scripts/audit-ceyhun.mjs referans/v3 → data/audit_ceyhun_v3.json + data/audit_ceyhun.md "v3 denetimi"; dışa aktarma: node scripts/ceyhun-export.mjs → public/data/m24/). Uygulamada UYGUN 13 aylık katman + günlük CO₂ (SMAP/GWETTOP deniz dolgusu aynı lnd dosyasının kara tanımıyla maskelendi → UYGUN); CO ve FIRE (BCCMASS) KAPALI (büyüklük 2–3 kat, kaynağa dayalı düzeltme yok; ham granül doğrulaması scripts/verify-granule.mjs, Earthdata _netrc gerekir). Katmanlar panelinde en üstte Hazır temalar, aylık katmanlar her zaman görünür; AI Guide katlanabilir. CO₂ katmanı ve günlük CO₂ 2021 (diğerleri MERRA-2 2024); her katmanın yılı meta'da. Paket anahtar adları yanıltıcıysa (IMERG, GRACE, NDVI) gerçek değişkene göre adlandırılır. Presetler meta'dan, UYGUN olmayan katman çıkarılır. API (jukebox-api-h5ve.onrender.com) sürüm 3, statik dosyalarla birebir aynı (scripts/compare-api.mjs → data/api_v3_tutarlilik.json); uygulamada YEDEK: monthly.bin yüklenemezse lib/m24.ts hücreleri /api/point-sonify?id= ile çeker (yüklenirken radar sessiz), statik kipte API isteği yok.
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

## Plan
Pazar: 09–12 kullanıcı testi (Ceyhun) + video (Tugay) · 12–13 analiz · 13:00 kod dondurma · 13–18 video/slayt/proje sayfası · 18–20 teslim.
Kesilenler: AI rehber, ayrı bilim/hikâye modu (tek anahtar kalır), titreşim (vakit kalırsa). Kullanıcı testi ve radar kesilmez.
