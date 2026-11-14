# Ceyhun'un veri paketi — denetim raporu (14 Kasım 2026)

Paket: `referans/meta.json`, `monthly_cube.bin` (20 katman × 12 ay × 12960 nokta, 2024), `daily_CO2.bin`, `daily_FIRE.bin` (365 gün × 12960) ve API `jukebox-api-h5ve.onrender.com`. Ayrıca 2021 OCO-2 paketi (`jukebox_1yillik_tam_paket.json`).
Yeniden üretmek için: `node scripts/audit-ceyhun.mjs` → `data/audit_ceyhun.json` (ham ölçümler), `node scripts/ceyhun-export.mjs` (uygun katmanlar → `public/data/m24/`).

## Özet

| Sınıf | Sayı | Katmanlar |
|---|---|---|
| **UYGUN** | 11 | CO2 (aylık), CO2 (günlük), SO2, AOD, TEMP, LST → *yüzey deri sıcaklığı*, ALBEDO, SST, IMERG → *kara üstü yağış*, SEAICE, 2021 OCO-2 paketi |
| **ŞÜPHELİ** | 6 | CH4, NO2, SMAP (GWETTOP), GRACE (TWLAND_ANOM), NDVI (LAI), FIRE aylık (BCCMASS) |
| **UYGUN DEĞİL** | 6 | CO, O3, SIF, CHL, NIGHTLIGHTS, FIRE günlük |

**Uygulamaya eklenen:** yalnız UYGUN olanlar. 9 aylık katman ve günlük CO₂ 2024, `public/data/m24/` altında statik dosya olarak. 2021 paketi zaten uygulamadaydı. ŞÜPHELİ ve UYGUN DEĞİL olanlar eklenmedi.

### Bütün paket için geçerli bulgular
- **Kodlama:** int16 little-endian, q ∈ 0…1000 (×1000 normalize), −1 = eksik. Meta'da veri tipi yazmıyor; değerlerden çıkarıldı.
- **Log dönüşümü belgelenmemiş:** `transform: "log"` katmanlarının ters dönüşümü meta'da yok. `log1p` varsayıldı. Gerekçe: yalnızca bu yorumla AOD'nin küresel ortalaması (0.134) ve kara yağışı (3.2 mm/gün) fiziksel olarak makul çıkıyor; `log` yorumu 0.046 ve 0.31 veriyor. CHL'de vmin = 0, yani `log` yorumu tanımsız. **Ceyhun'a doğrulatılacak.**
- **Uçlar kırpılmış:** vmin/vmax yaklaşık %2 ve %98 yüzdelikleri. Her katmanda uçlardaki ~%2'lik değer bu sınırlara kırpılmış; örneğin Sahra'nın Temmuz 2 m sıcaklığı 29.7 °C (= vmax), gerçekte ~35 °C. Uygulamada sınırdaki değerler "≥ / ≤" diye okunuyor.
- **Ortalamalar:** Aşağıdaki ortalamalar alan ağırlıksız ızgara noktası ortalamaları. 2°×2.5° ızgara kutuplarda sık olduğu için soğuk tarafa kayıktır.
- **Günlük dosyalar:** 2024 artık yıl ama dosyalarda 365 gün var. Ay hizalaması (Şubat 29 gün sayıldığında aylık küple fark 5.7, 28 gün sayıldığında 8.2) 31 Aralık'ın eksik olduğunu gösteriyor.
- **Dosya ↔ API tutarlılığı:** Sivas, Tokyo, Lagos, Amazon ve Svalbard'da API ile `.bin` dosyası birebir aynı. Her noktada 946/946 değer (18 aylık katman × 12 + 2 günlük × 365). API de normalize değer döndürüyor, gerçek birim vermiyor.

## Tablo

NASA kaynakları: challenge SVS sayfaları ve EIC galerileri (`data/svs_api/`, `data/catalog.md`). "Aynı ürün" = SVS sayfasında aynı ürün/ürün ailesi kullanılmış; "aynı konu" = konu EIC'de var, ürün farklı ama resmi NASA ürünü.

| Katman | Gerçek kaynak ürün / değişken | NASA eşleşmesi (SVS) | Etiket doğru mu? | Gerçek birimde min / ort / max | Sınıf | Gerekçe |
|---|---|---|---|---|---|---|
| CO2 (aylık) | OCO-2 GEOS L3 (OCO2_GEOS_L3CO2_DAY), XCO2; aylık = günlüklerin ay ortalaması | Aynı ürün: 5115, 5110, 5119 (OCO-2/GEOS CO₂); 2021 paketimizle aynı ürün | Doğru | 416.3 / 420.8 / 425.7 ppm | **UYGUN** | 2021 OCO-2 paketiyle mekânsal desen r = 0.976; 2024 küresel düzeyi makul (~421 ppm); eksik yok |
| CO2 (günlük) | Aynı ürün, 365 gün | Aynı ürün | Doğru | aynı aralık | **UYGUN** | Gerçek günlük: ikinci farkın ≈ 0 olduğu gün oranı %6 (ara değer değil); ay ortalamaları aylık küple tutarlı. 31 Aralık eksik |
| CH4 | "NASA Fiziksel/Klimatolojik Model (CH4)" — ürün **belirsiz** | Aynı konu: 5116, 5118 (GEOS metan) | Ad doğru, kaynak belirsiz | 1831.8 / 1877.3 / 1934.3 ppb | ŞÜPHELİ | Değer aralığı makul ama ürün ve değişken bilinmiyor. Uzaysal varyansın %97'si enlemle açıklanıyor; Sivas'ta 5 ay tavana (q = 1000) dayanıyor |
| CO | "NASA Fiziksel/Klimatolojik Model (CO)" — belirsiz | Aynı konu: 5153 (GEOS-CF CO) | Kaynak belirsiz | 44.5 / 75.3 / 82.6 ppb | UYGUN DEĞİL | Uzaysal varyansın **%99.6'sı yalnız enlemle** açıklanıyor; boylamda yapı yok (gerçek CO'da Afrika yangınları ve Doğu Asya belirgindir). Her nokta tek bir sinüs (R² 0.97). Kuzey yarımkürede zirve yazda; gerçek yüzey CO'su kış sonu/ilkbaharda zirve yapar. Sentetik/klimatolojik formül görünümünde |
| SIF | M2TMNXLND **LAI** (yaprak alanı indeksi) | Eşleşme yok (EIC'de SIF yok); LAI ≠ SIF | **Yanlış** (SIF değil LAI) | 0 / 0.476 / 2.54 "mW/m²/sr/nm" | UYGUN DEĞİL | **NDVI ile birebir kopya** (hücrelerin %100'ü eşit, r = 1); birim ve ad yanlış |
| NO2 | "NASA Fiziksel/Klimatolojik Model (NO2)" — belirsiz | Aynı konu: 5154 (GEOS-CF NOx), 4810 (OMI NO₂), 5175 (TEMPO) | Kaynak belirsiz | 0.30 / 0.83 / 12.07 ×10¹⁵ molekül/cm² | ŞÜPHELİ | Aralık troposferik NO₂ sütunu için makul ve gerçekçi uzaysal yapı var; ama ürün/değişken bilinmiyor |
| SO2 | MERRA-2 M2TMNXAER **SO2SMASS** (yüzey SO₂ kütle derişimi) | Aynı konu: 4810 (OMI SO₂); ürün ailesi MERRA-2: 4960, 5047, 5191 | Doğru (yüzey SO₂ kütle derişimi) | 0.005 / 0.94 / 50.5 µg/m³ | **UYGUN** | Resmi ürün/değişken açık; birim dönüşümü (kg/m³ → µg/m³) tutarlı; değerler makul |
| AOD | MERRA-2 M2TMNXAER **TOTEXTTAU** (550 nm toplam aerosol optik derinliği) | Aynı konu: 5669 (GEOS aerosoller), Air Quality 40529 | Doğru | 0.016 / 0.134 / 0.768 | **UYGUN** | Küresel ortalama literatürle uyumlu (~0.13); Sahra yüksek (0.38) |
| O3 | "NASA Fiziksel/Klimatolojik Model (O3)" — belirsiz | Aynı konu: 5152 (yüzey O₃), 4810 | **Yanlış birim** ("toplam ozon, DU") | 44.5 / 69.1 / 81.5 "DU" | UYGUN DEĞİL | Toplam sütun ozonu ~200–500 DU olmalı; 44–82 yüzey ozonu (ppb) aralığına benziyor. Uzaysal varyansın %99.7'si enlem; küresel aylık ortalama 12 ay boyunca sabit (664–666) — sentetik görünüm |
| TEMP | MERRA-2 M2TMNXSLV **T2M** (2 m hava sıcaklığı) | Aynı ürün ailesi: 5147 (GEOS-FP T2M), 5191 (MERRA-2) | Doğru | −54.4 / 5.9 / 29.7 °C (uçlar kırpılmış) | **UYGUN** | SVS 5147 desenimizle r = 0.966; ortalama ağırlıksız olduğu için düşük |
| LST | MERRA-2 M2TMNXSLV **TS** (yüzey deri sıcaklığı, kara + deniz) | Aynı konu: 5147 | **Kısmen yanlış**: uydu "kara yüzey sıcaklığı" değil → *Yüzey deri sıcaklığı (kara + deniz)* | −57.4 / 6.2 / 30.8 °C | **UYGUN** (adı düzeltildi) | Resmi değişken; denizde de değer var (yani TS). T2M ile r = 0.999 (neredeyse aynı bilgi) |
| ALBEDO | MERRA-2 M2TMNXRAD **ALBEDO** | Konu EIC'de doğrudan yok; ürün ailesi MERRA-2: 4960, 5047, 5191 | Doğru | 0.071 / 0.250 / 0.807 | **UYGUN** | Değerler makul (deniz ~0.08, Sahra ~0.39, buz yüksek); %2.3 eksik (kutup gecesi) |
| SST | MERRA-2 M2TMNXOCN **TSKINWTR** (deniz deri sıcaklığı) | Aynı konu: 5101, 5176 (MUR SST), 3912 (ECCO2) | "(El Niño)" eki yanıltıcı → *Deniz yüzeyi (deri) sıcaklığı* | −1.8 / 13.8 / 30.3 °C | **UYGUN** (adı düzeltildi) | SVS 3912 desenimizle r = 0.978; taban −1.8 °C = deniz suyu donma noktası (%14 hücre, buzlu denizler) |
| IMERG | MERRA-2 M2TMNXLND **PRECTOTLAND** (model kara yağışı) | Aynı konu: 4285, 4897 (IMERG), 5149 (GEOS-FP yağış) | **Yanlış** (IMERG uydu ürünü değil) → *Kara üstü toplam yağış (MERRA-2)* | 0.0005 / 3.2 / 35.3 mm/gün | **UYGUN** (adı düzeltildi) | Resmi değişken, değerler makul; yalnız kara (%65.5 eksik = okyanus) |
| CHL | "NASA Fiziksel/Klimatolojik Model (CHL)" | Eşleşme yok | — | **veri yok** | UYGUN DEĞİL | Değerlerin %100'ü −1 (boş katman) |
| SMAP | MERRA-2 M2TMNXLND **GWETTOP** (yüzey toprak nemliliği, 0–1) | Aynı konu: 5584 (SMAP + GPM) | **Yanlış** (SMAP uydu ürünü değil) → *Yüzey toprak nemliliği (MERRA-2)* | 0.168 / 0.89 (karada ~0.71) / 1.0 | ŞÜPHELİ | Deniz hücrelerinin %99'u tam 1.0 ("tam doygun") — dolgu değeri kalmış; katmanın %66'sı tavanda. Denizde −1 olmalı |
| SEAICE | MERRA-2 M2TMNXOCN **FRSEAICE** | Aynı konu: 5046, 5064, 5099, 5382 (deniz buzu) | Doğru | 0 / 10.1 / 99.0 % | **UYGUN** | Değerler makul; karadaki 0'lar uygulamada "veri yok" yapıldı |
| GRACE | "M2TMNXLND TWLAND_ANOM" — MERRA-2'de bu adla değişken yok; TWLAND'den türetilmiş anomali | Konu: GRACE yalnız 5067'de (uydu filosu) | **Yanlış** (GRACE uydu ürünü değil) | −181 / −0.2 / 181 kg/m² | ŞÜPHELİ | Anomalinin referans dönemi bilinmiyor; vmin = −vmax simetrik ölçek |
| NDVI | M2TMNXLND **LAI** | Aynı konu: 5544 (NDVI) | **Yanlış** (LAI ≠ NDVI) | 0 / 0.169 / 0.90 "NDVI" | ŞÜPHELİ | LAI'nin gerçek birimi m²/m² (0–7); 0–0.9 ölçeği LAI ile de NDVI ile de tutarsız. SIF ile kopya |
| FIRE (aylık) | MERRA-2 M2TMNXAER **BCCMASS** (kara karbon sütun kütlesi) | Aynı konu: 5669 (GEOS kara karbon), yangın 5113 / 4993 | **Ciddi yanlış** ("aktif yangın, MW" değil) | 61 / 1798 / 13267 "MW" | ŞÜPHELİ | Değişken resmi, ama birim belirsiz. Aralık µg/m² olarak makul görünüyor; bu bir tahmin, doğrulanmadı |
| FIRE (günlük) | BCCMASS aylık değerlerinden ara değerle | — | Ciddi yanlış | — | UYGUN DEĞİL | Günlerin %98'inde ikinci fark ≈ 0, %50'sinde tam 0: **aylık değerlerden doğrusal ara değerle üretilmiş**, gerçek günlük veri değil |
| NIGHTLIGHTS | "NASA Fiziksel/Klimatolojik Model" — belirsiz | Konu: 5313 (Black Marble) — ama **eşleşmiyor** | Yanlış (Black Marble değil) | 3.5 / 7.2 / 86.0 nW/cm²/sr | UYGUN DEĞİL | NASA Black Marble görselimizle (SVS 5313) yalnız r = 0.17; **NO2 katmanıyla r = 0.989** (ondan türetilmiş görünüyor); karanlık okyanusta da ışık var; 12 ay neredeyse sabit |
| 2021 OCO-2 paketi | OCO2_GEOS_L3CO2_DAY 2021, 96×60 (6×6 blok ortalaması) | Aynı ürün: 5115, 5110, 5119 | Doğru | 405.7 / ~413 / 422.3 ppm | **UYGUN** (uygulamada) | Daha önce doğrulandı; aylık katmanlar ayın 1. günü (ortalama değil) — uygulamada böyle etiketli |

## Ceyhun'a sorular

1. **Log dönüşümü:** `transform: "log"` olan katmanlarda normalize değer `log` mu `log1p` mi kullanılarak üretildi? (CHL'de vmin = 0 olduğu için `log` mümkün görünmüyor.)
2. **Kırpma:** vmin/vmax %2/%98 yüzdelik mi? Kırpılmamış (ham) değerleri de verebilir misin?
3. **CH4, NO2** (ve CO, O3, NIGHTLIGHTS, CHL): "NASA Fiziksel/Klimatolojik Model" tam olarak hangi ürün ve değişken? (Kısa ad, ör. M2TMNXCHM, GEOS-CF, OMI…) Dosyayı nereden indirdin?
4. **CO ve O3** neden yalnız enleme bağlı ve sinüs biçiminde? Bir formülle mi üretildi? O3'ün birimi DU mu, ppb mi?
5. **NIGHTLIGHTS:** NO₂ ile r = 0.99. Black Marble'ın hangi ürününden geldi (VNP46A3?), yoksa NO₂'den mi türetildi?
6. **SMAP (GWETTOP):** Denizdeki 1.0 değerleri dolgu mu? Denizi −1 yapıp yeniden verebilir misin?
7. **GRACE (TWLAND_ANOM):** Anomali hangi referans döneme göre? Kaynak TWLAND mı?
8. **NDVI/SIF:** İkisi de LAI. Ölçek (0–0.90) nereden geliyor? LAI'yi m²/m² olarak verebilir misin?
9. **FIRE:** BCCMASS'in birimi ne (kg/m² × ?)? Günlük seri aylıktan ara değerle mi üretildi?
10. **Günlük dosyalar:** 2024 artık yıl; hangi gün eksik (31 Aralık mı)?
