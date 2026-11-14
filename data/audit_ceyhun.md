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


---

# v3 denetimi (paket sürüm 3, 14 Kasım 2026 gece)

Girdi: `referans/v3/` (meta.json sürüm 3, monthly_cube.bin [15,12,12960], daily_CO2.bin [365,12960]). Dosyalar `referans/` içine tarayıcı adlarıyla gelmişti (`meta (2).json`, `monthly_cube (1).bin`, `daily_CO2 (1).bin`); dokunmadan `referans/v3/` altına kopyalandı. Ölçümler: `node scripts/audit-ceyhun.mjs referans/v3` → `data/audit_ceyhun_v3.json` (katman sırası `cube_offset_index`'ten; `katman_sirasi` ile aynı).

## Özet

**13 UYGUN · 3 ŞÜPHELİ · 0 UYGUN DEĞİL** (15 aylık katman + günlük CO₂). v2: 11 UYGUN · 6 ŞÜPHELİ · 6 UYGUN DEĞİL (23 kalem).

Ceyhun'un iddiaları:
- **5 sorunlu katman silindi — doğru:** CH4, SIF, NO2, CHL, NIGHTLIGHTS yok; günlük FIRE yok.
- **Kırpma kaldırıldı — doğru:** uçlarda yığılma yok (q = 0 / 1000 oranı ≈ 0; yalnız fiziksel sınırı olan katmanlarda: deniz buzu 0, toprak nemi 1). Sahra (18–30°K, 5°B–30°D) Temmuz 2 m sıcaklığı ort. **34,3 °C**, en çok 39,9 °C (v2'de üstten kırpılmıştı); deri sıcaklığı ort. 36,5 °C.
- **Her katmana "kanit" eklendi — doğru, 15/15 dolu.** Örnek granül adlarının hepsi gerçek NASA adlandırmasına uyuyor (`MERRA2_400.tavgM_2d_<grup>_Nx.YYYYMM.nc4`, `oco2_GEOS_L3CO2_day_YYYYMMDD_B….nc4`). Her değişken gerçekten o dosya grubunda (TO3 → slv, COSC → chm, BCCMASS → aer, TWLAND/LAI/GWETTOP/PRECTOTLAND → lnd …). **Küçük hata:** `nasa_koleksiyon` alanlarına "_2024" eklenmiş (`M2TMNXSLV_2024`); gerçek NASA kısa adı `M2TMNXSLV`. Uygulamada kısa adı granül adından türetip ikisini birlikte gösteriyoruz.
- **Önemli düzeltme (bizim v2 etiketimiz yanlıştı):** CO₂ katmanı ve günlük CO₂ **2021** yılına ait, 2024'e değil. Kanıt: granül `oco2_GEOS_L3CO2_day_20210101`, 365 dosya, `gunluk.baslangic` 2021-01-01. Günlük ilk gün, ekip OCO-2 2021 paketinin 1 Ocak'ıyla r = 0,997 (en büyük fark 2,6 ppm, nicemleme). v2'de "2024 artık yıl, 365 gün → 31 Aralık eksik" diye yorumladığımız durum da bu: dosya 2021'di. Aylık katman 2021'in aylık ortalaması.

## Tablo (v3)

| Katman (paket adı) | Kanıt: ürün · değişken | Bulgular | Sınıf | Uygulamadaki ad |
|---|---|---|---|---|
| CO2 | OCO2_GEOS_L3CO2_DAY · XCO2 | 407–421 ppm; 2021 (yukarıya bak); ekip 2021 verisiyle r 0,976 | **UYGUN** | Atmosferik CO₂ (aylık ort.) — **2021** |
| Günlük CO2 | aynı | 365 gün, gerçek günlük (ikinci fark ≈ 0 yalnız %8,7); 2021 | **UYGUN** | "2021 yılının 365 günü" dinleme düğmesi |
| TEMP | M2TMNXSLV · T2M | −68…40 °C, kırpma yok, SVS 5147 deseniyle r 0,966 | **UYGUN** | 2 m hava sıcaklığı |
| LST | M2TMNXSLV · TS | T2M ile r 0,999 (fiziksel olarak beklenen); uydu LST değil | **UYGUN** | Yüzey deri sıcaklığı |
| O3 | M2TMNXSLV · TO3 | **v2'de enleme bağlı formüldü (enlem R² 0,997); v3'te gerçek:** enlem R² 0,888; 134–544 DU (medyan 290); tropik Ocak ort. 245 DU, **Ekim Antarktika ort. 213 DU (ozon deliği)**, Mart Arktik ort. 501 DU. TO3 gerçekten slv dosyasında | **UYGUN** (yeni) | Toplam sütun ozonu |
| AOD | M2TMNXAER · TOTEXTTAU | küresel ort. 0,135 (gerçekçi), kırpma yok | **UYGUN** | Aerosol optik derinliği (550 nm) |
| SO2 | M2TMNXAER · SO2SMASS | 0,0003–85 µg/m³, medyan 0,08 | **UYGUN** | Yüzey SO₂ kütle derişimi |
| FIRE | M2TMNXAER · **BCCMASS** | Kanıt: siyah karbon **sütun kütlesi**, yangına özgü değil (fosil yakıt dahil) → "Biyokütle yanma" adı yanlış. Desen makul (Orta Afrika Ağustos ort. 10,3 mg/m²) ama küresel ort. 0,61 mg/m² ve uzak Güney Pasifik 0,25 mg/m² beklenen BC yükünün (~0,2 mg/m² küresel) yaklaşık 3 katı | **ŞÜPHELİ** | — (uygulamada yok) |
| CO | M2TMNXCHM · COSC | v2'de enlem formülüydü (R² 0,996); v3'te gerçek desen (R² 0,84; Orta Afrika Ağustos 737 ppbv, Doğu Çin Ocak 562 ppbv). Ama arka plan yüksek: küresel medyan 266 ppbv, Güney Pasifik Ocak 103 ppbv (gözlenen uzak arka plan ~50–60 ppbv; ~2 kat) | **ŞÜPHELİ** | — |
| ALBEDO | M2TMNXRAD · ALBEDO | 0,06–0,84; kutup gecesinde boş (%11,6, beklenen) | **UYGUN** | Yüzey albedosu |
| SST | M2TMNXOCN · TSKINWTR | −1,8…34,8 °C; SVS 3912 deseniyle r 0,978 | **UYGUN** | Açık su yüzeyi sıcaklığı |
| SEAICE | M2TMNXOCN · FRSEAICE | 0–100 %; karadaki 0'lar bizde "veri yok" yapılıyor | **UYGUN** | Deniz buzu oranı |
| SMAP | M2TMNXLND · **GWETTOP** | Uydu SMAP değil, model toprak nemi. **v2 hatası sürüyor:** denizde 8.489 hücre "1,0" (aynı lnd dosyasından gelen PRECTOTLAND/TWLAND/LAI'de deniz doğru biçimde "yok"); hücrelerin %65,8'i = 1 | **ŞÜPHELİ** | — |
| IMERG | M2TMNXLND · PRECTOTLAND | Uydu IMERG değil, MERRA-2 model yağışı (yalnız kara); ort. 3,3 mm/gün | **UYGUN** (ad düzeltildi) | Kara üstü toplam yağış |
| GRACE | M2TMNXLND · **TWLAND** | GRACE uydusu değil, model. Değerler işaretli: **her hücrenin 2024 ortalamasından aylık fark** (denetim: hücre 12-ay ortalaması ≈ 0, en çok 0,76 kg/m²; nicemleme adımı 2,3). p2–p98 ±150 kg/m² (mm su) | **UYGUN** (ad düzeltildi, taban belirtildi) | Kara su depolaması: 2024 ortalamasından aylık fark |
| NDVI | M2TMNXLND · **LAI** | Uydu NDVI değil, model yaprak alanı indeksi; 0–7,1 m²/m² | **UYGUN** (ad düzeltildi) | Yaprak alanı indeksi |

Kopya taraması: yalnız TEMP–LST (r 0,999, birebir eşitlik %3,4); fiziksel olarak beklenen, kopya değil.

## Presetler (meta.presets)

Uygulamada "Hazır seçimler" düğmeleri; yalnız UYGUN katmanlar açılıyor, çıkarılan katman düğmede `*` ile işaretli ve sesli söyleniyor:
- Gezegenin Nabzı: TEMP, CO2, AOD — **FIRE çıkarıldı**
- Yangın ve Karbon: NDVI (LAI), CO2, AOD — **CO çıkarıldı**
- Atmosfer ve Emisyon: LST, CO2, SO2, O3 — tam
- Okyanuslar ve Su Döngüsü: SST, GRACE (TWLAND), IMERG (PRECTOTLAND) — **SMAP çıkarıldı**
- Kutup Erimesi ve Enerji: SEAICE, GRACE (TWLAND), ALBEDO, O3 — tam

## Canlı API

`jukebox-api-h5ve.onrender.com` hâlâ sürüm 2'yi veriyor (20 katman, kanıt yok). Uygulama yalnız statik v3 dosyalarını kullanıyor (`public/data/m24/`). Uygulama kodunda API çağrısı yok; API yedeği sürüm 3'e geçene kadar kapalı.

## Ceyhun'a sorular (v3)

1. **CO (COSC):** Ocak 2024'te 40°G 120°B civarında bir hücre için `.nc4` dosyasındaki ham COSC değeri ne? Bizde ~103 ppbv; gözlenen arka plan ~50–60 ppbv.
2. **FIRE (BCCMASS):** Aynı hücrede ham BCCMASS (kg m⁻²) ne? mg/m²'ye çevirirken ×1e6 mı kullanıldı? Ayrıca ad "Siyah karbon sütun kütlesi" olmalı; yangına özgü değil.
3. **SMAP (GWETTOP):** Deniz hücreleri neden −1 değil de 1,0? Aynı lnd dosyasındaki diğer üç değişkende deniz −1.
4. **GRACE (TWLAND):** Anomali tabanı gerçekten hücrenin 2024 ortalaması mı? Meta'ya yazılması iyi olur.
5. `nasa_koleksiyon` alanından "_2024" ekini kaldırıp gerçek kısa adı (`M2TMNXSLV` …) yazabilir misin?
6. CO2'nin 2021 olduğunu doğrular mısın? Meta'da yıl alanı yok; yalnız granül adından ve `gunluk.baslangic`'ten anlaşılıyor.


---

# Düzeltmeler (v3 üzerinde, 15 Kasım 2026)

Kural: düzeltme yalnız kaynağa dayanıyorsa yapılır; doğrulanamayan değer uydurulmaz, o katman kapalı kalır. Betikler: `scripts/ceyhun-export.mjs` (düzeltme + dışa aktarma), `scripts/audit-fire-co.mjs` (FIRE/CO hata araması), `scripts/verify-granule.mjs` (ham granülle karşılaştırma; Earthdata girişi gerekir).

**Sonuç: 14 UYGUN (13 aylık katman + günlük CO₂), 2 KAPALI (CO, FIRE).**

## 1. SMAP (GWETTOP) — DÜZELTİLDİ → UYGUN

- **Hata:** deniz hücreleri 1,0 dolgu değeriyle gelmişti (Ocak'ta 8.489 hücre). Bu yüzden hücrelerin %65,8'i "tam doygun" görünüyordu.
- **Neye dayanarak:** MERRA-2 kara (lnd) dosyası yalnız kara için tanımlı. Aynı dosyadan gelen PRECTOTLAND, TWLAND ve LAI pakette denizde doğru biçimde −1. GWETTOP'u da **aynı kaynağın kara tanımıyla** (o ayın PRECTOTLAND hücresi −1 ise −1) maskeledik. Bu hücre-ay sayısı 101.868.
  - Bizim 0,5°'lik kara maskemizi (SVS 5544) kullanmadık. Kaynağın kendi tanımı daha doğru; bizim maskeyle farklar kıyıdaki karışık hücreler (%16) ve MERRA-2'nin kara saymadığı buz örtüleri (Antarktika, Grönland).
- **Düzeltme sonrası denetim:** kara üstünde 0,034–1,0, medyan 0,76, p10 0,26. Tam 1,0 kalan oran %0,96; bunlar doygun bölgeler, fiziksel olarak mümkün.
- **Ad ve birim:** "Üst toprak nemi (MERRA-2 GWETTOP)"; özgün birim `1` (boyutsuz oran, 0 = kuru, 1 = doygun). SMAP uydusu değil, model.
- **Ses:** tamamen deniz olan ışın sessiz. Pasifik ortasında 500 km'de yalnız bir ada hücresinin yönü çaldı. Kıyıdaki bir yerden denize bakan ışın, ilk halkası karaya düştüğü için o kara değerini çalar.

## 2. FIRE (BCCMASS) — KAPALI

- **Ad düzeltmesi hazır** (katman açılırsa kullanılacak): "Siyah karbon sütun kütlesi (MERRA-2 BCCMASS) — yangın + fosil yakıt kaynaklı". Özgün birim: kg m⁻².
- **Birim çevirisi doğru:** kg m⁻² → mg/m² = ×10⁶; paket değerleri bu çarpanla tutarlı aralıkta.
- **Büyüklük karşılaştırması:**
  - Alan ağırlıklı (cos enlem) 2024 ortalaması **0,74 mg/m²**. Tipik küresel BC yükü ~0,1–0,15 Tg, bu da ~0,2–0,3 mg/m² eder; yani yaklaşık 3 kat.
  - Uzak Güney Pasifik medyanı 0,23 mg/m²; beklenen ~0,02–0,05.
- **Bulunan olası neden (kesin değil):** paket dönüşümü yalnız "log" diyor.
  - log1p tersiyle FIRE ortalaması 0,74; **saf log** tersiyle **0,16 mg/m²** (beklenen aralıkta).
  - Ama aynı paketteki AOD (log1p: 0,158 ✓ / log: 0,018 ✗), SO₂ (uzak deniz log1p: 0,04 µg/m³ ✓ / log: 0,0003 ✗) ve yağış (vmin = 0 olduğu için saf log imkânsız) log1p ile tutarlı.
  - Tek bir katmanı beklentiye uysun diye farklı bir dönüşümle okumak kaynağa dayanmaz. **Bu yüzden kapalı.**
- **Açılması için:** Ceyhun'un dönüşümü katman başına netleştirmesi ya da ham granülle karşılaştırmada (aşağıda) oranın ≈ 1 çıkması.

## 3. CO (COSC) — KAPALI

- **Birim:** özgün birim `1e-9` = ppbv (NASA uzun adı "CO Surface Concentration in ppbv"); pakette ppbv. Çeviri yok, dolayısıyla çeviri hatası da yok.
- **Dönüşüm:** log1p ile saf log farkı önemsiz (297 ve 294 ppbv); vmin 35 olduğu için ikisi pratikte aynı.
- **Büyüklük:** alan ağırlıklı ortalama 297 ppbv, uzak Güney Pasifik medyanı 134 ppbv. Gözlenen yüzey CO arka planı ~50–60 ppbv (Güney Yarıküre), küresel ~90–100 ppbv; yani 2–3 kat yüksek.
- **Temiz bir birim çarpanı yok:** 2–3 kat; 10, 1000 ya da mol kütlesi oranı (28/29) değil. Net bir birim ya da dönüşüm hatası bulunamadı. **Kapalı.**

## 4. Hazır temalar (güncel)

| Tema | Açılan | Eklenmeyen (sesli söylenir) |
|---|---|---|
| Gezegenin Nabzı | 2 m sıcaklık, CO₂ (2021), AOD | FIRE |
| Yangın ve Karbon | Yaprak alanı, CO₂ (2021), AOD | CO |
| Atmosfer ve Emisyon | Yüzey deri sıcaklığı, CO₂ (2021), SO₂, ozon | — |
| Okyanuslar ve Su Döngüsü | Açık su sıcaklığı, kara su depolaması farkı, yağış, **toprak nemi (geri eklendi)** | — |
| Kutup Erimesi ve Enerji | Deniz buzu, kara su depolaması farkı, albedo, ozon | — |

Tema seçilince yalnız o katmanlar çalar; ana katmanlar kapanır.

## 5. Ham veriyle doğrulama — HAZIR, Earthdata girişi bekliyor

GES DISC'teki granüller ve OPeNDAP, Earthdata girişine yönlendiriyor (denendi: 302 → urs.earthdata.nasa.gov). `scripts/verify-granule.mjs` OPeNDAP'ın metin alt kümesiyle yalnız birkaç hücre indirir ve 5 noktada (Orta Afrika, Güney Pasifik, Doğu Çin, Sahra, Orta Avrupa) paketi ham değerle karşılaştırır. Denetim AOD ve SO₂ ile (yöntem doğru mu), sınama FIRE ve CO ile yapılır.

Kullanıcının adımları (şifre sohbete yazılmaz):
1. https://urs.earthdata.nasa.gov adresinde hesap aç ya da giriş yap.
2. Profil → **Applications → Authorized Apps → "Approve More Applications"** → **"NASA GESDISC DATA ARCHIVE"** → Approve.
3. `C:\Users\w11\_netrc` dosyasını oluştur (tek satır, uzantısız):
   `machine urs.earthdata.nasa.gov login KULLANICI_ADIN password ŞİFREN`
4. Bana "netrc hazır" de. Ben `node scripts/verify-granule.mjs` çalıştırıp sonucu `data/verify_granule.json`'a yazarım.
   - Oran ≈ 1 ise beklentimiz yanlıştır ve katman açılır.
   - Oran ≈ 3 (FIRE) ya da ≈ 2–3 (CO) ise paket hatalıdır; Ceyhun düzeltene kadar kapalı kalır.
