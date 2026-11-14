# SVS medya kataloğu

> Üretildi: 2026-11-14. Kaynak: `https://svs.gsfc.nasa.gov/api/<id>` JSON'u.
> **Hiçbir medya indirilmedi.** Boyutlar HTTP HEAD `Content-Length` ile, kare sayıları SVS klasör listesi (HTML) ile alındı.
> Kare seti toplam boyutu = kare sayısı × ilk karenin boyutu (tahmin).
> Küçük önizlemeler (_thm, _searchweb, _web) tablolara alınmadı; sayıları her başlığın altında yazıyor.

## Özet

| ID | Konu | Tür | Colorbar | Sonifikasyon uygunluğu |
|---|---|---|---|---|
| [5313](https://svs.gsfc.nasa.gov/5313/) | Night Lights 2012–2023 | mp4 (8K, 32:9) | Yok (mor/turuncu nitel) | Orta: düz harita, sadece parlaklık/ton |
| [5011](https://svs.gsfc.nasa.gov/5011/) | ISS-LIS yıldırım 2017–2023 | mp4 (1080p, 4K, 8K, SOS 4096x2048) | Yok | İyi: SOS sürümü eşdikdörtgen, olay = vuruş |
| [5669](https://svs.gsfc.nasa.gov/5669/) | GEOS aerosoller (tek an) | png (1080p → 8K) | **Var** (kategorik, 4 tür) | Çok iyi: 4 aerosol türü = 4 enstrüman |
| [3912](https://svs.gsfc.nasa.gov/3912/) | Deniz akıntıları + SST | mp4 + tif/png kare setleri | **Var** (0–32 °C) | **En iyi nicel aday:** 2:1 harita, °C geri okunabilir |
| [5196](https://svs.gsfc.nasa.gov/5196/) | DYAMOND CO₂ 2020 | mp4 + exr/png kareler | **Var** (renk + opaklık) | Zayıf/nitel: 3B küre, opaklık değeri bozar |
| [13786](https://svs.gsfc.nasa.gov/13786/) | Caldwell 73 sonifikasyonu | mp4/webm (1920x1920) | Yok | Veri değil: önceki çalışma/referans |
| [4950](https://svs.gsfc.nasa.gov/4950/) | GEDI orman yüksekliği | mp4 + tif/exr kare setleri | **Var** (0–40/50/75 m) | İyi: colorbar var ama küre görünümü |

---

## 5313 – Change in Night Lights between 2012 and 2023 - EIC Version

- **Türkçe:** Night Lights (Black Marble, EIC sürümü)
- **Sayfa:** https://svs.gsfc.nasa.gov/5313/ · yayın 2024-06-14 · tür: Visualization
- **Veri setleri:** Black Marble: Next Generation
- **Kredi satırı:** NASA's Scientific Visualization Studio. Visualizations by Kel Elkins (USRA)
- **Tüm emeği geçenler:** Visualizer: Kel Elkins · Scientist: Zhuosen Wang, Miguel Román, Ranjay Shrestha, Srija Chakraborty, Virginia Kalb
- **Renk skalası:** YOK. Renkler nitel: mor = ışık arttı, turuncu = ışık azaldı (2012→2023). Video önce yıllık ortalamaları (2012–2023), sonra değişim haritasını gösterir.
- **EarthEar için:** Düz dünya haritası (32:9) → boylam → stereo pan uygulanabilir. Değer iddiası yok: parlaklık ve mor/turuncu tonu sonifiye edilir. Kare klasörü HTTP 403 (erişime kapalı); yalnızca mp4/mov var.

| Tür | Dosya | Çözünürlük | Boyut | Not |
|---|---|---|---|---|
| jpg | [nightlights_flat_series_and_change_wZooms_13_EIC.02599_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a005300/a005313/nightlights_flat_series_and_change_wZooms_13_EIC.02599_print.jpg) | 1024x288 | 63.5 KB |  |
| kare seti | [nightlights_2012-2023_change_flat_eic/](https://svs.gsfc.nasa.gov/vis/a000000/a005300/a005313/frames/7680x2160_32x9_30p/nightlights_2012-2023_change_flat_eic/) | 7680x2160 | erişilemiyor (HTTP 403) |  |
| mp4 | [nightlights_flat_series_and_change_wZooms_13_EIC_2160p30_h265.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a005300/a005313/nightlights_flat_series_and_change_wZooms_13_EIC_2160p30_h265.mp4) | 7680x2160 (sayfa açıklamasından) | 34.3 MB |  |
| mov | [nightlights_flat_series_and_change_wZooms_13_EIC_prores.mov](https://svs.gsfc.nasa.gov/vis/a000000/a005300/a005313/nightlights_flat_series_and_change_wZooms_13_EIC_prores.mov) | 7680x2160 (sayfa açıklamasından) | 4.29 GB | ProRes, web için değil |

_+ 2 küçük önizleme görseli (thm/searchweb/web) listelenmedi._

---

## 5011 – Lightning Events Detected from the International Space Station (ISS) 2017-2023

- **Türkçe:** ISS-LIS yıldırım olayları 2017–2023
- **Sayfa:** https://svs.gsfc.nasa.gov/5011/ · yayın 2023-10-19 · tür: Visualization
- **Veri setleri:** CPC (Climate Prediction Center) Cloud Composite; Gray Earth with Shaded Relief, Hypsography, and Flat Water; Quality Controlled Lightning Imaging Sensor (LIS) on International Space Station (ISS) Science Data V1; Land Cover Climate Modeling Grid (CMG)
- **Kredi satırı:** NASA's Scientific Visualization Studio. Visualizations by Michala Garrison (SSAI)
- **Tüm emeği geçenler:** Visualizer: Michala Garrison, Greg Shirah, Kel Elkins, Alex Kekesi
- **Renk skalası:** YOK. Olaylar nokta/parlama olarak çiziliyor, sayısal skala yok.
- **EarthEar için:** 4096x2048 SOS sürümü küresel eşdikdörtgen projeksiyon (Science On a Sphere formatı) → boylam→pan, enlem→perde mümkün. Olay = vurmalı tık (olay alarmı fikriyle uyumlu). 10 günlük kayan pencere → zaman ekseni.

| Tür | Dosya | Çözünürlük | Boyut | Not |
|---|---|---|---|---|
| jpg | [iss_lightning_preview.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005011/iss_lightning_preview.jpg) | 1024x576 | 267.0 KB |  |
| mp4 | [iss_lightning_sphere_07312023.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005011/iss_lightning_sphere_07312023.mp4) | 1920x1080 | 133.2 MB |  |
| mp4 | [iss_lightning_sphere_07312023_60p4k.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005011/iss_lightning_sphere_07312023_60p4k.mp4) | 3840x2160 | 434.4 MB |  |
| mp4 | [iss_lightning_eic_display_2160p30_h2652.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005011/iss_lightning_eic_display_2160p30_h2652.mp4) | 7680x2160 | 608.1 MB |  |
| hyperwall | iss_lightning_sphere_07312023.mp4.hwshow | – | 195 B | kullanılmaz |
| jpg | [iss_lightning_sos_yearly_debug_2023_sos_2048p60.00420_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005011/iss_lightning_sos_yearly_debug_2023_sos_2048p60.00420_print.jpg) | 1024x512 | 50.7 KB |  |
| mp4 | [iss_lightning_sos_yearly_07312023_2048p60.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005011/iss_lightning_sos_yearly_07312023_2048p60.mp4) | 4096x2048 | 350.2 MB |  |
| mp4 | [iss_lightning_sos_yearly_debug_2023_sos_2048p60.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005011/iss_lightning_sos_yearly_debug_2023_sos_2048p60.mp4) | 4096x2048 | 691.9 MB |  |
| jpg | [iss_lightning_SOS_thumb.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a005000/a005011/iss_lightning_SOS_thumb.jpg) | 800x800 | 269.0 KB |  |

_+ 2 küçük önizleme görseli (thm/searchweb/web) listelenmedi._

---

## 5669 – GEOS Aerosols (2025)

- **Türkçe:** GEOS aerosoller (19 Ağu 2025 20:00 UTC, tek kare)
- **Sayfa:** https://svs.gsfc.nasa.gov/5669/ · yayın 2026-08-10 · tür: Visualization
- **Veri setleri:** GEOS Forward Processing 2Km Replay
- **Kredi satırı:** NASA's Scientific Visualization Studio. Visualizations by Joseph V. Ardizzone (NASA/GSFC), Helen-Nicole Kostis (Science and Technology Corporation). Scientific consulting by Lesley Ott (NASA/GSFC)
- **Tüm emeği geçenler:** Data visualizer: Joseph V. Ardizzone, Helen-Nicole Kostis · Scientist: Lesley Ott
- **Renk skalası:** VAR: Aerosols_cbar.png (1500x300). Renkler kategorik: deniz tuzu (mavi), toz (pembe/macenta), duman (turuncu/kırmızı), sülfat (yeşil).
- **EarthEar için:** Tek görüntü, video değil. Kategorik renk → enstrüman (tuz/toz/duman/sülfat = 4 enstrüman) → "Dünya orkestrası" fikrine birebir uyar. Projeksiyon sayfada yazmıyor; görüntüden kontrol et.

| Tür | Dosya | Çözünürlük | Boyut | Not |
|---|---|---|---|---|
| png | [Aerosols_2025-08-19T20_00_00_1920x1080.png](https://svs.gsfc.nasa.gov/vis/a000000/a005600/a005669/Aerosols_2025-08-19T20_00_00_1920x1080.png) | 1920x1080 | 2.8 MB |  |
| png | [Aerosols_2025-08-19T20_00_00_3840x2160.png](https://svs.gsfc.nasa.gov/vis/a000000/a005600/a005669/Aerosols_2025-08-19T20_00_00_3840x2160.png) | 3840x2160 | 9.3 MB |  |
| png | [Aerosols_2025-08-19T20_00_00_5760x3240.png](https://svs.gsfc.nasa.gov/vis/a000000/a005600/a005669/Aerosols_2025-08-19T20_00_00_5760x3240.png) | 5760x3240 | 17.7 MB |  |
| png | [Aerosols_2025-08-19T20_00_00_7680x4320.png](https://svs.gsfc.nasa.gov/vis/a000000/a005600/a005669/Aerosols_2025-08-19T20_00_00_7680x4320.png) | 7680x4320 | 24.6 MB |  |
| png | [Aerosols_2025-08-19T20_00_00_1500x1179_72dpi.png](https://svs.gsfc.nasa.gov/vis/a000000/a005600/a005669/Aerosols_2025-08-19T20_00_00_1500x1179_72dpi.png) | 1500x1179 | 2.4 MB |  |
| png | [Aerosols_2025-08-19T20_00_00_4200x3300_300dpi.png](https://svs.gsfc.nasa.gov/vis/a000000/a005600/a005669/Aerosols_2025-08-19T20_00_00_4200x3300_300dpi.png) | 4200x3300 | 13.5 MB |  |
| png | [Aerosols_cbar.png](https://svs.gsfc.nasa.gov/vis/a000000/a005600/a005669/Aerosols_cbar.png) | 1500x300 | 38.7 KB | **COLORBAR** |

---

## 3912 – Global Sea Surface Currents and Temperature

- **Türkçe:** Küresel deniz yüzeyi akıntıları + sıcaklık (ECCO2)
- **Sayfa:** https://svs.gsfc.nasa.gov/3912/ · yayın 2012-03-16 · tür: Visualization
- **Veri setleri:** GTOPO30 Topography and Bathymetry; ECCO2 High Resolution Ocean and Sea Ice Model
- **Kredi satırı:** NASA's Scientific Visualization Studio. Visualizations by Greg Shirah (NASA/GSFC)
- **Tüm emeği geçenler:** Animator: Greg Shirah, Horace Mitchell, Eric Sokolowsky · Project support: Eric Sokolowsky · Producer: Michael Starobin · Scientist: Hong Zhang, Dimitris Menemenlis
- **Renk skalası:** VAR: sst_ecco2_cbar.png (310x95). Sayfadaki tanım: mavi 0 °C, yeşil 10–20 °C, sarı ~25 °C, kırmızı 32 °C. Ayrıca "with_colorbar" kare seti ve _comp mp4 (colorbar görüntüye gömülü).
- **EarthEar için:** EN İYİ NİCEL ADAY: 2:1 eşdikdörtgen küresel harita (6840x3420 tam çözünürlük, kırpılmamış) → piksel → colorbar → °C → perde; boylam → pan doğrudan. Zaman aralığı 2007-03-25 → 2008-03-03. Model çıktısı, gözlem değil; sunumda belirt. Akış çizgileri arasındaki koyu pikseller = değer yok.

| Tür | Dosya | Çözünürlük | Boyut | Not |
|---|---|---|---|---|
| jpg | [flat_global_ecco2_2028x1024.25000.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/flat_global_ecco2_2028x1024.25000.jpg) | 2048x1024 | 1.0 MB |  |
| kare seti (tif) | [orig/](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/frames/2048x1024_1x1_30p/orig/) | 2048x1024 | 2001 kare × 6.3 MB ≈ 12.61 GB | flat_global_ecco2_2028x1024.23000.tif … flat_global_ecco2_2028x1024.31000.tif |
| webm | [ecco2_sst_flow.webmhd.webm](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/ecco2_sst_flow.webmhd.webm) | 960x540 | 15.7 MB |  |
| kare seti (tif) | [with_colorbar/](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/frames/2048x1024_1x1_30p/with_colorbar/) | 2048x1024 | 2001 kare × 3.7 MB ≈ 7.35 GB | colorbar karelere gömülü; flat_global_ecco2_2028x1024_comp.23000.tif … flat_global_ecco2_2028x1024_comp.31000.tif |
| mp4 | [ecco2_sst_flow.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/ecco2_sst_flow.mp4) | 2048x1024 | 256.3 MB |  |
| mp4 | [flat_global_ecco2_2028x1024_comp_p30.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/flat_global_ecco2_2028x1024_comp_p30.mp4) | 2048x1024 | 292.1 MB | colorbar görüntüye gömülü |
| m4v | [ecco2_sst_flow.m4v](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/ecco2_sst_flow.m4v) | 640x320 | 12.7 MB |  |
| kare seti (tif) | [6840x3420_1x1_30p/](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/frames/6840x3420_1x1_30p/) | 6840x3420 | 2001 kare × 34.7 MB ≈ 69.51 GB | flat_global_ecco2_6840x3420.23000.tif … flat_global_ecco2_6840x3420.31000.tif |
| sunum | the_motions_of_the_oceans.pptx | – | 57.3 MB | kullanılmaz |
| sunum | the_motions_of_the_oceans.key | – | 57.6 MB | kullanılmaz |
| mp4 | [Oceanflows-UHD-2160.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/Oceanflows-UHD-2160.mp4) | 3840x2160 | 339.7 MB |  |
| hyperwall | multiple-bigmovie.hwshow | – | 222 B | kullanılmaz |
| png | [ecco2_and_grid_crop1.png](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/ecco2_and_grid_crop1.png) | 320x180 | 136.3 KB |  |
| jpg | [ecco2_and_grid_crop1.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/ecco2_and_grid_crop1.jpg) | 320x180 | 78.8 KB |  |
| tif | [ecco2_and_grid_crop1.tif](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/ecco2_and_grid_crop1.tif) | 320x180 | 171.2 KB |  |
| png | [ecco2_and_grid_crop2.png](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/ecco2_and_grid_crop2.png) | 320x180 | 144.8 KB |  |
| jpg | [ecco2_and_grid_crop2.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/ecco2_and_grid_crop2.jpg) | 320x180 | 79.7 KB |  |
| tif | [ecco2_and_grid_crop2.tif](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/ecco2_and_grid_crop2.tif) | 320x180 | 188.3 KB |  |
| jpg | [ecco2_and_grid.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/ecco2_and_grid.jpg) | 6840x3420 | 13.5 MB |  |
| tif | [ecco2_and_grid.tif](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/ecco2_and_grid.tif) | 6840x3420 | 36.1 MB |  |
| png | [global-5x3-3-montage.png](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/global-5x3-3-montage.png) | 6840x2304 | 25.2 MB |  |
| jpg | [global_5x3-3_hw_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/global_5x3-3_hw_print.jpg) | 345x1024 | 184.6 KB |  |
| webm | [flat_global_ecco2_6840x3420_768p30-b1.webm](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/flat_global_ecco2_6840x3420_768p30-b1.webm) | 1368x768 | 8.3 MB |  |
| mp4 | [flat_global_ecco2_6840x3420_768p30-d1.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/flat_global_ecco2_6840x3420_768p30-d1.mp4) | 1368x768 | 26.2 MB |  |
| mp4 | [flat_global_ecco2_6840x3420_768p30-c1.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/flat_global_ecco2_6840x3420_768p30-c1.mp4) | 1368x768 | 193.5 MB |  |
| mp4 | [flat_global_ecco2_6840x3420_768p30-c2.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/flat_global_ecco2_6840x3420_768p30-c2.mp4) | 1368x768 | 187.2 MB |  |
| mp4 | [flat_global_ecco2_6840x3420_768p30-a1.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/flat_global_ecco2_6840x3420_768p30-a1.mp4) | 1368x768 | 281.7 MB |  |
| mp4 | [flat_global_ecco2_6840x3420_768p30-e3.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/flat_global_ecco2_6840x3420_768p30-e3.mp4) | 1368x768 | 291.4 MB |  |
| mp4 | [flat_global_ecco2_6840x3420_768p30-b1.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/flat_global_ecco2_6840x3420_768p30-b1.mp4) | 1368x768 | 213.3 MB |  |
| mp4 | [flat_global_ecco2_6840x3420_768p30-b2.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/flat_global_ecco2_6840x3420_768p30-b2.mp4) | 1368x768 | 257.5 MB |  |
| mp4 | [flat_global_ecco2_6840x3420_768p30-b3.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/flat_global_ecco2_6840x3420_768p30-b3.mp4) | 1368x768 | 290.1 MB |  |
| mp4 | [flat_global_ecco2_6840x3420_768p30-e1.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/flat_global_ecco2_6840x3420_768p30-e1.mp4) | 1368x768 | 253.4 MB |  |
| mp4 | [flat_global_ecco2_6840x3420_768p30-c3.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/flat_global_ecco2_6840x3420_768p30-c3.mp4) | 1368x768 | 326.9 MB |  |
| mp4 | [flat_global_ecco2_6840x3420_768p30-e2.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/flat_global_ecco2_6840x3420_768p30-e2.mp4) | 1368x768 | 347.3 MB |  |
| mp4 | [flat_global_ecco2_6840x3420_768p30-d3.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/flat_global_ecco2_6840x3420_768p30-d3.mp4) | 1368x768 | 363.3 MB |  |
| mp4 | [flat_global_ecco2_6840x3420_768p30-d2.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/flat_global_ecco2_6840x3420_768p30-d2.mp4) | 1368x768 | 334.4 MB |  |
| mp4 | [flat_global_ecco2_6840x3420_768p30-a3.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/flat_global_ecco2_6840x3420_768p30-a3.mp4) | 1368x768 | 344.1 MB |  |
| mp4 | [flat_global_ecco2_6840x3420_768p30-a2.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/flat_global_ecco2_6840x3420_768p30-a2.mp4) | 1368x768 | 406.5 MB |  |
| hyperwall | test-multiple-movies.hwshow.hwshow | – | erişilemiyor (HTTP 404) | kullanılmaz |
| hyperwall | test-multiple-movies.hwshow.hwshow | – | erişilemiyor (HTTP 404) | kullanılmaz |
| png | [atlantic-5x3-montage.png](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/atlantic-5x3-montage.png) | 6840x2304 | 20.0 MB |  |
| jpg | [flat_atlantic_ecco2_6840x2304.23000_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/flat_atlantic_ecco2_6840x2304.23000_print.jpg) | 1024x344 | 154.7 KB |  |
| kare seti (tif) | [6840x2304_1x1_30p/](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/frames/6840x2304_1x1_30p/) | 6840x2304 | 1750 kare × 21.8 MB ≈ 38.23 GB | flat_atlantic_ecco2_6840x2304.23000.tif … flat_atlantic_ecco2_6840x2304.29996.tif |
| png | [bigtext-ecco2-global_sst_currents_svs003912_caption-2x2-1920x1080.png](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/bigtext-ecco2-global_sst_currents_svs003912_caption-2x2-1920x1080.png) | 3840x2160 | 202.4 KB |  |
| png | [sst_ecco2_cbar.png](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/sst_ecco2_cbar.png) | 310x95 | 8.9 KB | **COLORBAR** |
| jpg | [pacificcurrents.00000_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/pacificcurrents.00000_print.jpg) | 1024x576 | 262.2 KB |  |
| kare seti (png) | [pacific/](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/frames/1920x1080_16x9_30p/pacific/) | 1920x1080 | 2001 kare × 2.7 MB ≈ 5.35 GB | pacificcurrents.00000.png … pacificcurrents.02000.png |
| webm | [pacificcurrents_1080p30.webm](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/pacificcurrents_1080p30.webm) | 1920x1080 | 9.1 MB |  |
| kare seti (png) | [pacific_bare/](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/frames/1920x1080_16x9_30p/pacific_bare/) | 1920x1080 | 2001 kare × 2.7 MB ≈ 5.32 GB | pacificcurrents.00000.png … pacificcurrents.02000.png |
| mp4 | [pacificcurrents_no_overlay_1080p30_2.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/pacificcurrents_no_overlay_1080p30_2.mp4) | 1920x1080 | 277.4 MB |  |
| mp4 | [pacificcurrents_1080p30.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/pacificcurrents_1080p30.mp4) | 1920x1080 | 498.2 MB |  |

_+ 4 küçük önizleme görseli (thm/searchweb/web) listelenmedi._

---

## 5196 – DYAMOND Global Carbon Dioxide

- **Türkçe:** DYAMOND küresel CO₂ (GEOS, Ocak–Mart 2020)
- **Sayfa:** https://svs.gsfc.nasa.gov/5196/ · yayın 2024-07-22 · tür: Visualization
- **Veri setleri:** DYAMOND
- **Kredi satırı:** NASA's Scientific Visualization Studio. Visualizations by AJ Christensen (SSAI). Scientific consulting by Lesley Ott (NASA/GSFC)
- **Tüm emeği geçenler:** Visualizer: AJ Christensen, Greg Shirah, Helen-Nicole Kostis, Mark SubbaRao · Technical support: Laurence Schuler, Ian Jones · Scientist: Lesley Ott, Brad Weir, William Putman, Tomohiro Oda
- **Renk skalası:** VAR: dyamondCbar_6-27-2024a.png (1920x1080). Sayfaya göre renk + OPAKLIK transfer fonksiyonunu gösteriyor (ppm).
- **EarthEar için:** Küre/kamera hareketli 3B nokta bulutu render; opaklık da veri taşıdığı için pikselden ppm geri okumak güvenilir değil. Yalnızca nitel (yoğunluk/parlaklık) sonifikasyon önerilir. Kareler EXR (~24 MB/kare), web için uygun değil; mp4 kullan.

| Tür | Dosya | Çözünürlük | Boyut | Not |
|---|---|---|---|---|
| jpg | [dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00200_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00200_print.jpg) | 1024x576 | 47.3 KB |  |
| mp4 | [dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4) | 1920x1080 | 7.2 MB |  |
| kare seti (exr) | [dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/](https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall/) | 5760x3240 | 1176 kare × 25.1 MB ≈ 29.54 GB | dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.00001.exr … dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_3x3Hyperwall.01176.exr |
| mp4 | [dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_2160p30.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_2160p30.mp4) | 3840x2160 | 71.8 MB |  |
| hyperwall | dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_2160p30.mp4.hwshow | – | 231 B | kullanılmaz |
| jpg | [dyamondPointCloud_3-29-2023a_dyamond_co2_anim_globe_zoom_3x3hyperwall.00800_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_3-29-2023a_dyamond_co2_anim_globe_zoom_3x3hyperwall.00800_print.jpg) | 1024x576 | 156.1 KB |  |
| mp4 | [dyamondPointCloud_3-29-2023a_dyamond_co2_anim_globe_zoom_1080p30.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_3-29-2023a_dyamond_co2_anim_globe_zoom_1080p30.mp4) | 1920x1080 | 45.6 MB |  |
| kare seti (exr) | [dyamondPointCloud_3-29-2023a_dyamond_co2_anim_globe_zoom_3x3hyperwall/](https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_3-29-2023a_dyamond_co2_anim_globe_zoom_3x3hyperwall/) | 5760x3240 | 1176 kare × 23.6 MB ≈ 27.75 GB | dyamondPointCloud_3-29-2023a_dyamond_co2_anim_globe_zoom_3x3hyperwall.00001.exr … dyamondPointCloud_3-29-2023a_dyamond_co2_anim_globe_zoom_3x3hyperwall.01176.exr |
| mp4 | [dyamondPointCloud_3-29-2023a_dyamond_co2_anim_globe_zoom_2160p30.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_3-29-2023a_dyamond_co2_anim_globe_zoom_2160p30.mp4) | 3840x2160 | 159.5 MB |  |
| hyperwall | dyamondPointCloud_3-29-2023a_dyamond_co2_anim_globe_zoom_2160p30.mp4.hwshow | – | 642 B | kullanılmaz |
| jpg | [dyamondPointCloud_4-3-2023a_dyamond_co2_anim_globe_zoom_hyperwall5x3.00800_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_4-3-2023a_dyamond_co2_anim_globe_zoom_hyperwall5x3.00800_print.jpg) | 1024x345 | 57.0 KB |  |
| jpg | [dyamondPointCloud_4-3-2023a_dyamond_co2_anim_globe_zoom_5x3_1080p30.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_4-3-2023a_dyamond_co2_anim_globe_zoom_5x3_1080p30.jpg) | 3200x1080 | 513.0 KB |  |
| kare seti (exr) | [dyamondPointCloud_4-3-2023a_dyamond_co2_anim_globe_zoom_hyperwall5x3/](https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/9600x3240_16x9_30p/dyamondPointCloud_4-3-2023a_dyamond_co2_anim_globe_zoom_hyperwall5x3/) | 9600x3240 | 1176 kare × 26.3 MB ≈ 30.89 GB | dyamondPointCloud_4-3-2023a_dyamond_co2_anim_globe_zoom_hyperwall5x3.00001.exr … dyamondPointCloud_4-3-2023a_dyamond_co2_anim_globe_zoom_hyperwall5x3.01176.exr |
| mp4 | [dyamondPointCloud_4-3-2023a_dyamond_co2_anim_globe_zoom_5x3_1080p30.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_4-3-2023a_dyamond_co2_anim_globe_zoom_5x3_1080p30.mp4) | 3200x1080 | 44.3 MB |  |
| kare seti (png) | [dyamondPointCloud_4-3-2023a_dyamond_co2_anim_globe_zoom_hyperwall5x3_pngs/](https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/9600x3240_16x9_30p/dyamondPointCloud_4-3-2023a_dyamond_co2_anim_globe_zoom_hyperwall5x3_pngs/) | 9600x3240 | 1176 kare × 6.9 MB ≈ 8.06 GB | dyamondPointCloud_4-3-2023a_dyamond_co2_anim_globe_zoom_hyperwall5x3.00001.png … dyamondPointCloud_4-3-2023a_dyamond_co2_anim_globe_zoom_hyperwall5x3.01176.png |
| jpg | [dyamondPointCloud_1-22-2025a_dyamond_co2_anim_globe_zoomwest_3x3hyperwall.01080_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_1-22-2025a_dyamond_co2_anim_globe_zoomwest_3x3hyperwall.01080_print.jpg) | 1024x576 | 136.3 KB |  |
| mp4 | [dyamondPointCloud_1-22-2025a_dyamond_co2_anim_globe_zoomwest_3x3hyperwall_1080p30_2.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_1-22-2025a_dyamond_co2_anim_globe_zoomwest_3x3hyperwall_1080p30_2.mp4) | 1920x1080 | 44.6 MB |  |
| kare seti (exr) | [dyamondPointCloud_1-22-2025a_dyamond_co2_anim_globe_zoomwest_3x3hyperwall/](https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_1-22-2025a_dyamond_co2_anim_globe_zoomwest_3x3hyperwall/) | 5760x3240 | 1176 kare × 24.1 MB ≈ 28.35 GB | dyamondPointCloud_1-22-2025a_dyamond_co2_anim_globe_zoomwest_3x3hyperwall.00001.exr … dyamondPointCloud_1-22-2025a_dyamond_co2_anim_globe_zoomwest_3x3hyperwall.01176.exr |
| mp4 | [dyamondPointCloud_1-22-2025a_dyamond_co2_anim_globe_zoomwest_3x3hyperwall_3240p30_h265_2.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_1-22-2025a_dyamond_co2_anim_globe_zoomwest_3x3hyperwall_3240p30_h265_2.mp4) | 5760x3240 | 166.9 MB |  |
| jpg | [dyamondPointCloud_12-4-2023b_dyamond_co2_anim_globe_tilt_3x3Hyperwall.01085_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-4-2023b_dyamond_co2_anim_globe_tilt_3x3Hyperwall.01085_print.jpg) | 1024x576 | 129.5 KB |  |
| mp4 | [dyamondPointCloud_12-4-2023b_dyamond_co2_anim_globe_tilt_1080p30.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-4-2023b_dyamond_co2_anim_globe_tilt_1080p30.mp4) | 1920x1080 | 25.7 MB |  |
| kare seti (exr) | [dyamondPointCloud_12-4-2023b_dyamond_co2_anim_globe_tilt_3x3Hyperwall/](https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/frames/5760x3240_16x9_30p/dyamondPointCloud_12-4-2023b_dyamond_co2_anim_globe_tilt_3x3Hyperwall/) | 5760x3240 | 1176 kare × 59.7 MB ≈ 70.26 GB | dyamondPointCloud_12-4-2023b_dyamond_co2_anim_globe_tilt_3x3Hyperwall.00001.exr … dyamondPointCloud_12-4-2023b_dyamond_co2_anim_globe_tilt_3x3Hyperwall.01176.exr |
| png | [dyamondCbar_6-27-2024a.png](https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondCbar_6-27-2024a.png) | 1920x1080 | 48.7 KB | **COLORBAR** |
| jpg | [dyamondCbar_6-27-2024a_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondCbar_6-27-2024a_print.jpg) | 1024x576 | 30.0 KB | **COLORBAR** |

_+ 13 küçük önizleme görseli (thm/searchweb/web) listelenmedi._

---

## 13786 – Data Sonification: Caldwell 73

- **Türkçe:** Data Sonification: Caldwell 73 (Hubble, küresel yıldız kümesi)
- **Sayfa:** https://svs.gsfc.nasa.gov/13786/ · yayın 2020-12-23 · tür: Produced Video
- **Veri setleri:** —
- **Kredi satırı:** NASA Goddard Media Studios. Sonifikasyon: SYSTEM Sounds (M. Russo, A. Santaguida). Görüntü: Hubble (API missions alanı). Teknik destek: Aaron E. Lepsch.
- **Tüm emeği geçenler:** Technical support: Aaron E. Lepsch
- **Renk skalası:** YOK (uzay görüntüsü, sayısal skala yok).
- **EarthEar için:** VERİ DEĞİL, REFERANS/ÖNCEKİ ÇALIŞMA: NASA'nın kendi sonifikasyon videosu (SYSTEM Sounds). Radar taraması: merkeze uzaklık → perde; renk → enstrüman (turuncu/kırmızı = marimba, mavi = glockenspiel, tüm görüntü = koro). Dünya verisi değil. Bizim farkımız: gerçek Dünya verisi + colorbar ile nicel değer + kullanıcı testi. Sunumda "NASA da bu yöntemi kullanıyor" referansı olarak iyi.

| Tür | Dosya | Çözünürlük | Boyut | Not |
|---|---|---|---|---|
| jpg | [print.jpg](https://svs.gsfc.nasa.gov/vis/a010000/a013700/a013786/print.jpg) | 1920x1080 | 871.1 KB |  |
| jpg | [wide.jpg](https://svs.gsfc.nasa.gov/vis/a010000/a013700/a013786/wide.jpg) | 1920x1080 | 871.1 KB |  |
| mp4 | [Caldwell73_2K_Final.mp4](https://svs.gsfc.nasa.gov/vis/a010000/a013700/a013786/Caldwell73_2K_Final.mp4) | 1920x1920 | 77.5 MB |  |
| webm | [Caldwell73_2K_Final.webm](https://svs.gsfc.nasa.gov/vis/a010000/a013700/a013786/Caldwell73_2K_Final.webm) | 1920x1920 | 5.9 MB |  |
| altyazı (srt) | [CALDWELL73.en_US.SRT](https://svs.gsfc.nasa.gov/vis/a010000/a013700/a013786/CALDWELL73.en_US.SRT) | – | 49 B |  |

_+ 1 küçük önizleme görseli (thm/searchweb/web) listelenmedi._

---

## 4950 – GEDI Forest Height

- **Türkçe:** GEDI orman yüksekliği
- **Sayfa:** https://svs.gsfc.nasa.gov/4950/ · yayın 2021-10-29 · tür: Visualization
- **Veri setleri:** Relative Height
- **Kredi satırı:** NASA's Scientific Visualization Studio. Visualizations by Kel Elkins (USRA)
- **Tüm emeği geçenler:** Visualizer: Kel Elkins, Horace Mitchell, Greg Shirah · Technical support: Laurence Schuler, Ian Jones · Scientist: Temilola Fatoyinbo, Atticus Stovall
- **Renk skalası:** VAR: 3 ayrı colorbar TIF: 0–50 m, 0–75 m, 0–40 m (her biri 3840x2160 + print JPG). Hangi videoya hangisinin ait olduğu API'de yazmıyor; "_w_colorbar" videolardaki gömülü bara bakarak eşleştir.
- **EarthEar için:** Küre üzerinde hareketli kamera (düz harita değil) → boylam→pan doğrudan değil. Renk: kahverengi/koyu yeşil = kısa, parlak yeşil/beyaz = uzun bitki örtüsü; yükseklik görselde abartılı. Bölgesel videolar: Kaliforniya, Florida, Goddard, Laurentides, Senegal. Not: sayfa bir yerde 2019–2020, başka yerlerde 2018–2019 veri aralığı yazıyor (tutarsız; GEDI Aralık 2018'de fırlatıldı).

| Tür | Dosya | Çözünürlük | Boyut | Not |
|---|---|---|---|---|
| jpg | [GEDI_global_w_colorbar_0900_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_0900_print.jpg) | 1024x576 | 85.4 KB | colorbar görüntüye gömülü |
| mp4 | [GEDI_global_w_colorbar_1080p60.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_1080p60.mp4) | 1920x1080 | 18.6 MB | colorbar görüntüye gömülü |
| webm | [GEDI_global_w_colorbar_1080p60.webm](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_1080p60.webm) | 1920x1080 | 6.3 MB | colorbar görüntüye gömülü |
| kare seti (tif) | [GEDI_global_w_colorbar/](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/frames/3840x2160_16x9_60p/GEDI_global_w_colorbar/) | 3840x2160 | 2999 kare × 33.2 MB ≈ 99.58 GB | colorbar karelere gömülü; GEDI_global_w_colorbar_0000.tif … GEDI_global_w_colorbar_2998.tif |
| mp4 | [GEDI_global_w_colorbar_2160p30.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_2160p30.mp4) | 3840x2160 | 64.5 MB | colorbar görüntüye gömülü |
| mp4 | [GEDI_global_w_colorbar_2160p60.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_2160p60.mp4) | 3840x2160 | 68.6 MB | colorbar görüntüye gömülü |
| altyazı (srt) | [captions_silent.31845.en_US.srt](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/captions_silent.31845.en_US.srt) | – | 43 B |  |
| jpg | [GEDI_CA_w_colorbar_0850_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_CA_w_colorbar_0850_print.jpg) | 1024x576 | 161.5 KB | colorbar görüntüye gömülü |
| mp4 | [GEDI_CA_w_colorbar_1080p60.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_CA_w_colorbar_1080p60.mp4) | 1920x1080 | 25.7 MB | colorbar görüntüye gömülü |
| webm | [GEDI_CA_w_colorbar_1080p60.webm](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_CA_w_colorbar_1080p60.webm) | 1920x1080 | 3.9 MB | colorbar görüntüye gömülü |
| mp4 | [GEDI_CA_w_colorbar_2160p30.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_CA_w_colorbar_2160p30.mp4) | 3840x2160 | 91.1 MB | colorbar görüntüye gömülü |
| mp4 | [GEDI_CA_w_colorbar_2160p60.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_CA_w_colorbar_2160p60.mp4) | 3840x2160 | 97.8 MB | colorbar görüntüye gömülü |
| kare seti (tif) | [GEDI_CA_w_colorbar/](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/frames/3840x2160_16x9_60p/GEDI_CA_w_colorbar/) | 3840x2160 | 1401 kare × 33.2 MB ≈ 46.52 GB | colorbar karelere gömülü; GEDI_CA_w_colorbar_0000.tif … GEDI_CA_w_colorbar_1400.tif |
| altyazı (srt) | [captions_silent.31846.en_US.srt](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/captions_silent.31846.en_US.srt) | – | 43 B |  |
| jpg | [GEDI_colorbar_0to50_01_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_colorbar_0to50_01_print.jpg) | 1024x576 | 11.0 KB | **COLORBAR** |
| tif | [GEDI_colorbar_0to50_01.tif](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_colorbar_0to50_01.tif) | 3840x2160 | 66.4 MB | **COLORBAR** |
| jpg | [GEDI_colorbar_0to75_01_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_colorbar_0to75_01_print.jpg) | 1024x576 | 11.0 KB | **COLORBAR** |
| tif | [GEDI_colorbar_0to75_01.tif](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_colorbar_0to75_01.tif) | 3840x2160 | 66.4 MB | **COLORBAR** |
| jpg | [GEDI_colorbar_0to40_01_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_colorbar_0to40_01_print.jpg) | 1024x576 | 7.7 KB | **COLORBAR** |
| tif | [GEDI_colorbar_0to40_01.tif](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_colorbar_0to40_01.tif) | 3840x2160 | 66.4 MB | **COLORBAR** |
| jpg | [GEDI_global.0900_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global.0900_print.jpg) | 1024x576 | 82.0 KB |  |
| kare seti (tif) | [GEDI_global/](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/frames/3840x2160_16x9_60p/GEDI_global/) | 3840x2160 | 2999 kare × 66.4 MB ≈ 199.00 GB | GEDI_global.0001.tif … GEDI_global.2999.tif |
| mp4 | [GEDI_global_2160p60.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_2160p60.mp4) | 3840x2160 | 74.1 MB |  |
| webm | [GEDI_global_2160p60.webm](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_2160p60.webm) | 3840x2160 | 21.5 MB |  |
| mov | [GEDI_global_prores.mov](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_prores.mov) | 3840x2160 | 3.33 GB | ProRes, web için değil |
| jpg | [GEDI_CA.4900_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_CA.4900_print.jpg) | 1024x576 | 152.3 KB |  |
| kare seti (tif) | [GEDI_CA/](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/frames/3840x2160_16x9_60p/GEDI_CA/) | 3840x2160 | 1401 kare × 66.4 MB ≈ 92.96 GB | GEDI_CA.4000.tif … GEDI_CA.5400.tif |
| mp4 | [GEDI_CA_2160p60.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_CA_2160p60.mp4) | 3840x2160 | 99.1 MB |  |
| webm | [GEDI_CA_2160p60.webm](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_CA_2160p60.webm) | 3840x2160 | 13.7 MB |  |
| mov | [GEDI_CA_prores.mov](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_CA_prores.mov) | 3840x2160 | 4.03 GB | ProRes, web için değil |
| jpg | [GEDI_FL_w_colorbar1400_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_FL_w_colorbar1400_print.jpg) | 1024x576 | 118.4 KB | colorbar görüntüye gömülü |
| mp4 | [GEDI_FL_w_colorbar_1080p60.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_FL_w_colorbar_1080p60.mp4) | 1920x1080 | 15.4 MB | colorbar görüntüye gömülü |
| webm | [GEDI_FL_w_colorbar_1080p60.webm](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_FL_w_colorbar_1080p60.webm) | 1920x1080 | 3.1 MB | colorbar görüntüye gömülü |
| kare seti (tif) | [GEDI_FL_w_colorbar/](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/frames/3840x2160_16x9_60p/GEDI_FL_w_colorbar/) | 3840x2160 | 1401 kare × 33.2 MB ≈ 46.52 GB | colorbar karelere gömülü; GEDI_FL_w_colorbar0000.tif … GEDI_FL_w_colorbar1400.tif |
| mp4 | [GEDI_FL_w_colorbar_2160p30.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_FL_w_colorbar_2160p30.mp4) | 3840x2160 | 49.9 MB | colorbar görüntüye gömülü |
| mp4 | [GEDI_FL_w_colorbar_2160p60.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_FL_w_colorbar_2160p60.mp4) | 3840x2160 | 53.5 MB | colorbar görüntüye gömülü |
| jpg | [GEDI_Goddard_w_colorbar1394_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_Goddard_w_colorbar1394_print.jpg) | 1024x576 | 228.7 KB | colorbar görüntüye gömülü |
| mp4 | [GEDI_Goddard_w_colorbar_1080p60.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_Goddard_w_colorbar_1080p60.mp4) | 1920x1080 | 45.7 MB | colorbar görüntüye gömülü |
| webm | [GEDI_Goddard_w_colorbar_1080p60.webm](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_Goddard_w_colorbar_1080p60.webm) | 1920x1080 | 5.1 MB | colorbar görüntüye gömülü |
| kare seti (tif) | [GEDI_Goddard_w_colorbar/](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/frames/3840x2160_16x9_60p/GEDI_Goddard_w_colorbar/) | 3840x2160 | 1395 kare × 33.2 MB ≈ 46.32 GB | colorbar karelere gömülü; GEDI_Goddard_w_colorbar0000.tif … GEDI_Goddard_w_colorbar1394.tif |
| mp4 | [GEDI_Goddard_w_colorbar_2160p60.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_Goddard_w_colorbar_2160p60.mp4) | 3840x2160 | 153.6 MB | colorbar görüntüye gömülü |
| mp4 | [GEDI_Goddard_w_colorbar_2160p30.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_Goddard_w_colorbar_2160p30.mp4) | 3840x2160 | 142.1 MB | colorbar görüntüye gömülü |
| jpg | [GEDI_Laurentides_w_colorbar1395_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_Laurentides_w_colorbar1395_print.jpg) | 1024x576 | 206.9 KB | colorbar görüntüye gömülü |
| mp4 | [GEDI_Laurentides_w_colorbar_1080p60.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_Laurentides_w_colorbar_1080p60.mp4) | 1920x1080 | 44.6 MB | colorbar görüntüye gömülü |
| webm | [GEDI_Laurentides_w_colorbar_1080p60.webm](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_Laurentides_w_colorbar_1080p60.webm) | 1920x1080 | 4.9 MB | colorbar görüntüye gömülü |
| kare seti (tif) | [GEDI_Laurentides_w_colorbar/](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/frames/3840x2160_16x9_60p/GEDI_Laurentides_w_colorbar/) | 3840x2160 | 1396 kare × 33.2 MB ≈ 46.35 GB | colorbar karelere gömülü; GEDI_Laurentides_w_colorbar0000.tif … GEDI_Laurentides_w_colorbar1395.tif |
| mp4 | [GEDI_Laurentides_w_colorbar_2160p30.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_Laurentides_w_colorbar_2160p30.mp4) | 3840x2160 | 139.0 MB | colorbar görüntüye gömülü |
| mp4 | [GEDI_Laurentides_w_colorbar_2160p60.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_Laurentides_w_colorbar_2160p60.mp4) | 3840x2160 | 148.0 MB | colorbar görüntüye gömülü |
| jpg | [GEDI_senegal_w_colorbar.11345_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_senegal_w_colorbar.11345_print.jpg) | 1024x576 | 183.5 KB | colorbar görüntüye gömülü |
| mp4 | [GEDI_senegal_w_colorbar_1080p60.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_senegal_w_colorbar_1080p60.mp4) | 1920x1080 | 28.2 MB | colorbar görüntüye gömülü |
| webm | [GEDI_senegal_w_colorbar_1080p60.webm](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_senegal_w_colorbar_1080p60.webm) | 1920x1080 | 4.0 MB | colorbar görüntüye gömülü |
| kare seti (tif) | [GEDI_Senegal_w_colorbar/](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/frames/3840x2160_16x9_60p/GEDI_Senegal_w_colorbar/) | 3840x2160 | 1346 kare × 66.4 MB ≈ 89.31 GB | colorbar karelere gömülü; GEDI_senegal_w_colorbar.10000.tif … GEDI_senegal_w_colorbar.11345.tif |
| mp4 | [GEDI_senegal_w_colorbar_2160p60.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_senegal_w_colorbar_2160p60.mp4) | 3840x2160 | 92.8 MB | colorbar görüntüye gömülü |
| mp4 | [GEDI_senegal_w_colorbar_2160p30.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_senegal_w_colorbar_2160p30.mp4) | 3840x2160 | 87.3 MB | colorbar görüntüye gömülü |
| jpg | [GEDI_FL_04.6900_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_FL_04.6900_print.jpg) | 1024x576 | 112.7 KB |  |
| mp4 | [GEDI_FL_1080p60.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_FL_1080p60.mp4) | 1920x1080 | 15.3 MB |  |
| webm | [GEDI_FL_1080p60.webm](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_FL_1080p60.webm) | 1920x1080 | 3.0 MB |  |
| kare seti (exr) | [GEDI_FL/](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/frames/3840x2160_16x9_60p/GEDI_FL/) | 3840x2160 | 1401 kare × 10.9 MB ≈ 15.24 GB | GEDI_FL_04.5500.exr … GEDI_FL_04.6900.exr |
| mp4 | [GEDI_FL_2160p60.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_FL_2160p60.mp4) | 3840x2160 | 53.8 MB |  |
| mp4 | [GEDI_FL_2160p30.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_FL_2160p30.mp4) | 3840x2160 | 50.8 MB |  |
| jpg | [GEDI_Goddard_02.8394_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_Goddard_02.8394_print.jpg) | 1024x576 | 221.6 KB |  |
| mp4 | [GEDI_Goddard_02_1080p60.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_Goddard_02_1080p60.mp4) | 1920x1080 | 45.0 MB |  |
| webm | [GEDI_Goddard_02_1080p60.webm](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_Goddard_02_1080p60.webm) | 1920x1080 | 4.8 MB |  |
| kare seti (exr) | [GEDI_Goddard/](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/frames/3840x2160_16x9_60p/GEDI_Goddard/) | 3840x2160 | 1395 kare × 22.3 MB ≈ 31.16 GB | GEDI_Goddard_02.7000.exr … GEDI_Goddard_02.8394.exr |
| mp4 | [GEDI_Goddard_2160p60.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_Goddard_2160p60.mp4) | 3840x2160 | 161.7 MB |  |
| mp4 | [GEDI_Goddard_2160p30.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_Goddard_2160p30.mp4) | 3840x2160 | 151.7 MB |  |
| jpg | [GEDI_Laurentides_02.9894_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_Laurentides_02.9894_print.jpg) | 1024x576 | 205.5 KB |  |
| mp4 | [GEDI_Laurentides_02_1080p60.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_Laurentides_02_1080p60.mp4) | 1920x1080 | 44.5 MB |  |
| webm | [GEDI_Laurentides_02_1080p60.webm](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_Laurentides_02_1080p60.webm) | 1920x1080 | 4.9 MB |  |
| kare seti (exr) | [GEDI_Laurentides/](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/frames/3840x2160_16x9_60p/GEDI_Laurentides/) | 3840x2160 | 1395 kare × 27.9 MB ≈ 38.88 GB | GEDI_Laurentides_02.8500.exr … GEDI_Laurentides_02.9894.exr |
| mp4 | [GEDI_Laurentides_02_2160p30.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_Laurentides_02_2160p30.mp4) | 3840x2160 | 149.4 MB |  |
| mp4 | [GEDI_Laurentides_02_2160p60.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_Laurentides_02_2160p60.mp4) | 3840x2160 | 157.5 MB |  |
| jpg | [GEDI_senegal.11345_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_senegal.11345_print.jpg) | 1024x576 | 177.9 KB |  |
| mp4 | [GEDI_senegal_1080p60.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_senegal_1080p60.mp4) | 1920x1080 | 28.0 MB |  |
| webm | [GEDI_senegal_1080p60.webm](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_senegal_1080p60.webm) | 1920x1080 | 3.9 MB |  |
| kare seti (tif) | [GEDI_Senegal/](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/frames/3840x2160_16x9_60p/GEDI_Senegal/) | 3840x2160 | 1346 kare × 66.4 MB ≈ 89.31 GB | GEDI_senegal.10000.tif … GEDI_senegal.11345.tif |
| mp4 | [GEDI_senegal_2160p60.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_senegal_2160p60.mp4) | 3840x2160 | 92.4 MB |  |
| mp4 | [GEDI_senegal_2160p30.mp4](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_senegal_2160p30.mp4) | 3840x2160 | 86.7 MB |  |
| jpg | [GEDI_global_w_colorbar_0230_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_0230_print.jpg) | 1024x576 | 84.8 KB | colorbar görüntüye gömülü |
| tif | [GEDI_global_w_colorbar_0230_print.tif](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_0230_print.tif) | 3840x2160 | 33.2 MB | colorbar görüntüye gömülü |
| jpg | [GEDI_global_w_colorbar_0600_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_0600_print.jpg) | 1024x576 | 82.1 KB | colorbar görüntüye gömülü |
| tif | [GEDI_global_w_colorbar_0600_print.tif](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_0600_print.tif) | 3840x2160 | 33.2 MB | colorbar görüntüye gömülü |
| jpg | [GEDI_global_w_colorbar_1055_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_1055_print.jpg) | 1024x576 | 85.4 KB | colorbar görüntüye gömülü |
| tif | [GEDI_global_w_colorbar_1055_print.tif](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_1055_print.tif) | 3840x2160 | 33.2 MB | colorbar görüntüye gömülü |
| jpg | [GEDI_global_w_colorbar_1900_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_1900_print.jpg) | 1024x576 | 69.9 KB | colorbar görüntüye gömülü |
| tif | [GEDI_global_w_colorbar_1900_print.tif](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_1900_print.tif) | 3840x2160 | 33.2 MB | colorbar görüntüye gömülü |
| jpg | [GEDI_CA_w_colorbar_0150_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_CA_w_colorbar_0150_print.jpg) | 1024x576 | 207.4 KB | colorbar görüntüye gömülü |
| tif | [GEDI_CA_w_colorbar_0150_print.tif](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_CA_w_colorbar_0150_print.tif) | 3840x2160 | 33.2 MB | colorbar görüntüye gömülü |
| jpg | [GEDI_CA_w_colorbar_0300_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_CA_w_colorbar_0300_print.jpg) | 1024x576 | 231.0 KB | colorbar görüntüye gömülü |
| tif | [GEDI_CA_w_colorbar_0300_print.tif](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_CA_w_colorbar_0300_print.tif) | 3840x2160 | 33.2 MB | colorbar görüntüye gömülü |
| jpg | [GEDI_CA_w_colorbar_1000_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_CA_w_colorbar_1000_print.jpg) | 1024x576 | 143.9 KB | colorbar görüntüye gömülü |
| tif | [GEDI_CA_w_colorbar_1000_print.tif](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_CA_w_colorbar_1000_print.tif) | 3840x2160 | 33.2 MB | colorbar görüntüye gömülü |
| jpg | [GEDI_CA_w_colorbar_1400_print.jpg](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_CA_w_colorbar_1400_print.jpg) | 1024x576 | 120.8 KB | colorbar görüntüye gömülü |
| tif | [GEDI_CA_w_colorbar_1400_print.tif](https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_CA_w_colorbar_1400_print.tif) | 3840x2160 | 33.2 MB | colorbar görüntüye gömülü |

_+ 3 küçük önizleme görseli (thm/searchweb/web) listelenmedi._

---

## Notlar

- Tüm URL'ler `https://svs.gsfc.nasa.gov/vis/...` altında. SVS içeriği genelde kamu malıdır; yine de her kullanımda yukarıdaki kredi satırını göster (CLAUDE.md kuralı).
- Web uygulaması için öneri: 1080p mp4 (tarayıcıda `<video>` → canvas → piksel okuma) ya da tek PNG. TIF/EXR kare setleri tarayıcıda okunmaz ve çok büyük.
- Piksel→değer yalnızca colorbar'ı olan kaynaklarda (3912, 4950; 5669 kategorik) söylenir; diğerlerinde "parlaklık/ton" denir.
- 5313 kare klasörü HTTP 403 döndü. 3912'deki iki hyperwall .hwshow bağlantısı HTTP 404 (API'deki yol bozuk).
