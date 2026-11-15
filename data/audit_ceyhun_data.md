# Ceyhun veri paketi — referans/data (2026-11-15) denetimi

Betik: `node scripts/audit-ceyhun-data.mjs` → `data/audit_ceyhun_data.json`. Uygulamaya EKLENMEDİ (onay bekliyor).

## Ne geldi
- 28 JSON (≈ 48,9 MB). `data.zip` ile klasör **bayt bayt aynı**. meta.json YOK; yerine `jukebox_6_kategori_ana_indeks.json` (sürüm numarası yok, `sahte_veri: false`, her akış `durum: OK`, değişiklik notu yok).
- 9 akış × 3 dosya (`kure_12ay`, `istasyonlar_365gun`, `1yillik_tam_paket`). `tam_paket` içindeki küre = `kure_12ay` (aynı). Biçim v3'ten tamamen farklı: ikili küp değil, nokta listesi (`lat, lon, deger, ppm, norm, midi`).
- Izgara **5° × 5°** hücre (≈ 550 km; v3 2° × 2,5°, SVS görselleri 1°). Koordinat hücreyi temsil eder: SST noktalarının %15'i, akıntının %26'sı Natural Earth karasında; orman noktalarının %27'si denizde → kıyı hücreleri karışık.
- "istasyonlar_365gun" aslında 12 aylık (SST'de 74 adım, 5 günde bir). `ppm` alanı her katmanda `deger` ile aynı (eski ad). `midi/hz` alanları kullanılmaz (eşlemeyi motor yapar).
- Dönem: 2025-10 … 2026-09 (SST 2026-10'a kadar, akıntı 2025-02 … 2026-01, yıldırım klimatoloji, gece ışıkları yalnız 2025-01).

## Ne değişti (v3 / uygulamadaki public/data/m24 = v3 dışa aktarımı)
- **Yeni katmanlar:** okyanus yüzey akıntı hızı (OSCAR L4 V2.0, m/s), yıldırım (LIS/OTD LRMC, flaş/km²/gün), orman kanopi yüksekliği (GEDI L3 V3 + LAI), gece ışıkları (VIIRS), SST artık AVHRR OI (v3'te MERRA-2 SST).
- **FIRE ve CO: pakette YOK** → düzeltilmedi, KAPALI kalır. `verify-granule` çıktısı ya da başka doğrulama dosyası YOK.
- v3'te olup burada olmayan: CO2, O3, SO2, ALBEDO, SEAICE, SMAP, IMERG, GRACE, NDVI, FIRE, CO.
- AOD artık fiziksel birimde. v3'teki "log mu log1p mi" belirsizliği çözülüyor: v3'ü **log1p** ile çözünce yeni değerlerle tutarlı (Lagos Ocak 0,86 ↔ 0,71; Tokyo Temmuz 0,31 ↔ 0,30; Sivas Ocak 0,11 ↔ 0,16).

### 5 nokta (en yakın 5° hücre; v3 = 2024'ün aynı takvim ayı)
| | 2 m hava °C (Oca / Tem) yeni · v3 | Deri sıcaklığı °C (Oca / Tem) yeni · v3 | SST °C (Oca / Tem) yeni · v3 | AOD (Oca / Tem) | Akıntı m/s | Yıldırım /gün (Nis / Eki) | Kanopi m |
|---|---|---|---|---|---|---|---|
| Sivas (hücre 278 km) | 4,6 / 22,5 · 0,0 / 22,4 | 5,4 / 23,5 · −0,2 / 24,5 | 20,3 / 27,0 (hücre K.Maraş, karada!) · — | 0,16 / 0,14 | — | 0,021 / 0,022 | 5,6 |
| Tokyo (284 km) | 2,5 / 24,7 · 8,1 / 26,3 | 6,9 / 24,7 · 11,1 / 26,1 | 14,4 / 23,1 · 18,1 / 26,8 | 0,24 / 0,30 | 0,29 | 0,002 / 0,009 | 18,4 |
| Lagos (154 km) | 27,7 / 25,9 · 26,8 / 25,6 | 28,4 / 26,2 · 26,7 / 25,9 | 28,5 / 27,6 · 29,4 / 27,0 | 0,71 / 0,23 | 0,33 | 0,089 / 0,075 | 6,6 |
| Amazon (246 km) | 26,3 / 26,8 · 27,3 / 27,5 | 26,6 / 27,0 · 27,9 / 28,0 | (en yakın deniz 836 km) | 0,12 / 0,07 | 0,42 (kıyı) | 0,022 / 0,144 | 24,9 |
| Svalbard | −5,9 / 4,5 · −16,3 / 3,3 | −4,8 / 4,2 · −16,3 / 2,5 | 1,4 / 6,0 · −0,7 / 3,2 | 0,06 / 0,09 | 0,03 | 0 / 0 | (GEDI kapsamı dışında; 2941 km) |

Mevsim döngüsü doğru. Farklar çoğunlukla yıl farkı + hücre konumu (5° hücre şehirden 150–300 km uzakta). Dikkat: Svalbard Ocak (−5,9 ↔ −16,3) ve Tokyo Ocak (2,5 ↔ 8,1, farklı hücre) büyük; ham granülle doğrulanmadı.

## Denetim (her katman)
| Katman | Kaynak / etiket | Fiziksel makullük | Kopya | Kırpma / ref | Eksik | Karar |
|---|---|---|---|---|---|---|
| aerosoller (AOD) | M2TMNXAER, toplam AOD ✓ (toz/duman/sülfat AYRIMI YOK) | 0,008–0,95; Lagos Ocak 0,71 (harmattan) ✓; Sahra Tem 0,38 (biraz düşük, tek hücre) | yok | ref 0–1, aşan yok | %0 | **UYGUN** |
| yuzey_sicakligi (TS) | M2TMNXSLV ✓ | −73…41 °C (Antarktika kışı −73 makul) | yok | ref −35…45 dışına çıkan var; `norm` formülü tutarlı | %0 | **UYGUN** |
| hava_sicakligi_2m (T2M) | M2TMNXSLV ✓ | −67…40 °C ✓ | yok | aynı | %0 | **UYGUN** |
| okyanus_sicakligi | AVHRR OI v2.1 ✓; her ay ayın 1. günü (anlık) | −1,8…34,9 °C (Basra Körfezi 32,8 ✓) | — | ref üstü 20 nokta (sıcak körfezler) | %0 | **UYGUN** (kıyı hücreleri karada) |
| okyanus_sicakligi_akintilar | ad "SST + akıntı" | — | **okyanus_sicakligi'nin BİREBİR KOPYASI** (13 ay); akıntı yok | — | — | **UYGUN DEĞİL** (yinelenen) |
| okyanus_akintilari | OSCAR L4 FINAL V2.0, √(u²+v²) ✓ | 0,006–2,09 m/s (Agulhas / Gulf Stream ✓) | yok | ref 0–1,2, aşan 13 | %0 | **UYGUN** (kaba; dönem farklı) |
| yildirim | LIS/OTD LRMC (`lohrmc`) ✓ | yıllık en yüksek Kongo 61 /km²/yıl, Florida 21, Maracaibo 30 (5° hücrede yumuşamış; makul) | yok | **ref 0–0,15 dar: 79 değer üstünde**; %54 sıfır (yüksek enlem/okyanus) | %0 | **UYGUN** (ölçek için ref kullanılmamalı) |
| orman_yuksekligi | GEDI L3 V3 rh100 + "LAI mevsimsel bağlama" | 1,4–37,5 m; Amazon 25 m ✓ | yok | — | %0 | **ŞÜPHELİ**: GEDI çok yıllık tek değerdir; aylık ±%7 değişim LAI'den TÜRETİLMİŞ (ölçüm değil). Izgara düzensiz (0,52° × 5°), 51,8° ötesi yok |
| gece_isiklari | indeks VNP46A4 ↔ dosya VNP46A3 (**uyuşmuyor**) | 0,5–1324 nW/cm²/sr | — | `norm` formülü TUTMUYOR | 1 ay (veri_yok 1) | **UYGUN DEĞİL**: yalnız 2025-01; kapsam kısmi (boylam −80…119,5, enlem −7,5…80; Tokyo, Lagos, Avustralya, Amerika'nın batısı yok) |

## API
`https://jukebox-api-h5ve.onrender.com/api/meta` → `surum: 3`, katmanlar CO2…NDVI (v3). **Yeni paketi vermiyor**; API hâlâ v3.

## Öneri (onay bekliyor)
1. **okyanus_akintilari** → okyanus ses dünyasına akıntı hızı (şu an "ızgaradan çıkarılamadı" eksiği). En değerli yeni veri.
2. **aerosoller (AOD), yildirim, okyanus_sicakligi, hava/yüzey sıcaklığı** → SVS görsellerinin "göreli" değerlerinin yanına **sayısal okuma** (özet/anlatım: "AOD 0,71", "yılda ~60 flaş/km²", "deniz 28 °C"). Radar dokusu SVS'te kalsın (1° vs 5°).
3. **orman_yuksekligi** yalnız tek (çok yıllık) GEDI değeri olarak, aylık değişim olmadan — Ceyhun'dan LAI'siz ham rh100 istenmeli.
4. **gece_isiklari** ve **okyanus_sicakligi_akintilar** eklenmesin. FIRE/CO kapalı kalır.
5. Ceyhun'a: indeks dosyasına sürüm numarası + değişiklik notu; hücre mi nokta mı (değer hücre ortalaması mı, en yakın piksel mi?); "365gun" adlandırması; gece ışıklarının küresel tamamı; API'nin bu pakete güncellenmesi.
