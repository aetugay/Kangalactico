# SVS medya kataloğu (v2)

> Üretildi: 2026-11-14. Kaynak: `https://svs.gsfc.nasa.gov/api/<id>`. **Bu aşamada medya indirilmedi**: boyutlar HTTP HEAD ile alındı.
> **Projeksiyon kaynağı:** "API" = SVS metninde açıkça yazıyor · "boyut" = yalnızca en-boy oranı/dosya adından çıkarıldı, **doğrulanmadı** (Aşama 3'te kareden doğrulanacak).
> Renk skalası birimi/aralığı sadece API metninde yazıyorsa verildi; yoksa "görüntüden okunmalı" yazıyor. Hiçbir değer tahmin edilmedi.
> Galeriler: Earth Now (40509), Climate Vital Signs (40473), Greenhouse Gases (40477), CO2 Sources and Sinks (40479), Air Quality (40529), Wildland Fires (40531), Daily Visualizations (40512). 55 sayfa tarandı.
> "En küçük uygun dosya": A/B sınıfında elle seçildi; C/D/E sınıfında otomatik (genişliği ≥1280 olan en küçük video) — bir katman/ara sürüm olabilir, kullanmadan önce bak.
> Önceki ayrıntılı dosya listesi (7 sayfa, kare sayıları dahil): [catalog_v1_files.md](catalog_v1_files.md).

## A. Düz 2:1 harita + renk skalası (ana adaylar) (16)

| ID | Başlık | Kaynak | Projeksiyon (kaynak) | Renk skalası | En küçük uygun dosya | Boyut | Tarih aralığı | Kredi |
|---|---|---|---|---|---|---|---|---|
| [3912](https://svs.gsfc.nasa.gov/3912/) | Global Sea Surface Currents and Temperature | challenge | Düz 2:1 (6840x3420 "2x1 aspect", kırpılmamış) *(API)* | sst_ecco2_cbar.png — °C, 0–32 (API: mavi 0, yeşil 10–20, sarı ~25, kırmızı 32) | `ecco2_sst_flow.mp4` (2048x1024) | 256.3 MB | 2007-03-25 → 2008-03-03 (ECCO2 model) | NASA's Scientific Visualization Studio. Visualizations by Greg Shirah |
| [4285](https://svs.gsfc.nasa.gov/4285/) | Near Real-Time Global Precipitation from the Global Precipitation Measurement Constellation | Daily Visualizations | Düz 3600x1800 (2:1) "flat" kare setleri + tek kare; mp4 1920x1080 (16:9) *(boyut)* | rainbarwhite2.png / snowbarwhite2.png (440x90) — birim/aralık görüntüden | `imergert_composite.now.png` (3600x1800) | ? | En güncel IMERG (yakın gerçek zamanlı; tarih kare üstünde) | NASA's Scientific Visualization Studio. Visualizations by Horace Mitchell. Scientific consulting by George Huffman, Gail Skofronick Jackson, Dalia B Kirschbaum |
| [5101](https://svs.gsfc.nasa.gov/5101/) | Sea Surface Temperature (SST) - Near Real Time | Daily Visualizations | Düz 2:1 equirectangular (+ ayrı Robinson sürümü) *(API)* | sst_mur_colorbar.png — °C, −5…35 (API metni) | `sst_30_sec_no-dates_4096x2048_2x1_30p.mp4` (4096x2048) | 88.1 MB | Son ~2.5 yıl, GÜNLÜK güncelleniyor (indirme tarihi kaydedilmeli) | NASA's Scientific Visualization Studio. Visualizations by Kel Elkins |
| [5147](https://svs.gsfc.nasa.gov/5147/) | GEOS-FP Near-Surface Temperature | Earth Now, Daily Visualizations | 2048x1024 (2:1) — projeksiyon API'de yazmıyor *(boyut)* | NearSurfaceTemperature_colorbar.png — birim/aralık API'de YOK, görüntüden okunmalı | `MC01_stage3_GMAO_near_surface_temperature_2048x1024_en.mp4` (2048x1024) | 33.1 MB | bilinmiyor (API'de yok) | NASA's Scientific Visualization Studio. Visualizations by Joseph V. Ardizzone |
| [5148](https://svs.gsfc.nasa.gov/5148/) | GEOS-FP Near-Surface Wind Speed | Earth Now, Daily Visualizations | 2048x1024 (2:1) — projeksiyon API'de yazmıyor *(boyut)* | NearSurfaceWindSpeed_colorbar.png — birim/aralık görüntüden | `MC02_stage3_GMAO_near_surface_wind_2048x1024_en.mp4` (2048x1024) | 68.6 MB | bilinmiyor | NASA's Scientific Visualization Studio. Visualizations by Joseph V. Ardizzone |
| [5149](https://svs.gsfc.nasa.gov/5149/) | GEOS-FP Precipitation and Clouds | Earth Now, Daily Visualizations | 2048x1024 (2:1) — projeksiyon API'de yazmıyor *(boyut)* | Precipitation_colorbar.png — birim/aralık görüntüden | `MC03_stage3_GMAO_precipitation_2048x1024_en.mp4` (2048x1024) | 87.4 MB | bilinmiyor | NASA's Scientific Visualization Studio. Visualizations by Joseph V. Ardizzone |
| [5150](https://svs.gsfc.nasa.gov/5150/) | GEOS-FP Near-Surface Humidity | Earth Now, Daily Visualizations | 2048x1024 (2:1) — projeksiyon API'de yazmıyor *(boyut)* | NearSurfaceHumidity_colorbar.png — birim/aralık görüntüden | `MC04_stage3_GMAO_near_surface_humidity_2048x1024_en.mp4` (2048x1024) | 14.8 MB | bilinmiyor | NASA's Scientific Visualization Studio. Visualizations by Joseph V. Ardizzone, Helen-Nicole Kostis |
| [5151](https://svs.gsfc.nasa.gov/5151/) | Particulate Matter (PM) 2.5 | Earth Now, Air Quality, Daily Visualizations | 2048x1024 (2:1) — projeksiyon API'de yazmıyor *(boyut)* | PM2.5_colorbar.png — birim/aralık görüntüden | `MC01_stage4_GMAO_pm25_2048x1024_en.mp4` (2048x1024) | 19.7 MB | bilinmiyor | NASA's Scientific Visualization Studio. Visualizations by Joseph V. Ardizzone |
| [5152](https://svs.gsfc.nasa.gov/5152/) | Near surface Ozone (O3) | Earth Now, Air Quality, Daily Visualizations | 2048x1024 (2:1) — projeksiyon API'de yazmıyor *(boyut)* | O3_colorbar.png — birim/aralık görüntüden | `MC02_stage4_GMAO_O3_2048x1024_en.mp4` (2048x1024) | 21.9 MB | bilinmiyor | NASA's Scientific Visualization Studio. Visualizations by Joseph V. Ardizzone |
| [5153](https://svs.gsfc.nasa.gov/5153/) | Carbon Monoxide (CO) | Earth Now, Air Quality, Daily Visualizations | 2048x1024 (2:1) — projeksiyon API'de yazmıyor *(boyut)* | CO_colorbar.png — birim/aralık görüntüden | `MC03_stage4_GMAO_CO_2048x1024_en.mp4` (2048x1024) | 19.0 MB | bilinmiyor | NASA's Scientific Visualization Studio. Visualizations by Joseph V. Ardizzone |
| [5154](https://svs.gsfc.nasa.gov/5154/) | Nitrogen Oxides (NOx) | Earth Now, Air Quality, Daily Visualizations | 2048x1024 (2:1) — projeksiyon API'de yazmıyor *(boyut)* | NOx_colorbar.png — birim/aralık görüntüden | `MC04_stage4_GMAO_NO2_2048x1024_en.mp4` (2048x1024) | 30.3 MB | bilinmiyor | NASA's Scientific Visualization Studio. Visualizations by Joseph V. Ardizzone |
| [5176](https://svs.gsfc.nasa.gov/5176/) | Sea Surface Temperature (SST) Anomaly - Near Real Time | Daily Visualizations | Düz 2:1 equirectangular (+ Pasifik merkezli, Robinson sürümleri) *(API)* | sst_mur_anomaly_auto_colorbar_01.exr (+print jpg) — °C anomali, −4…4 (API metni) | `TÜM mp4 > 300 MB (348–363 MB) → kare seti gerekir` | ? | Son ~2.5 yıl, günlük güncelleniyor | NASA's Scientific Visualization Studio. Visualizations by Kel Elkins |
| [5207](https://svs.gsfc.nasa.gov/5207/) | Global Temperature Anomalies from 1880 to 2023 | Climate Vital Signs | SOS sürümü 4096x2048 equirectangular (ana sürüm Robinson, bir de ortografik) *(API)* | giss_navy_anomaly_Vertical-both.png (167x333, °F ve °C) — aralık görüntüden | `2023GISTEMP_Map_SOS.mp4` (4096x2048) | 119.8 MB | 1880–2023, 24 aylık kayan ortalama, taban 1951–1980 | NASA's Scientific Visualization Studio. Scientific consulting by Gavin A. Schmidt. Produced by Kathleen Gaeta. Visualizations by Mark SubbaRao |
| [5315](https://svs.gsfc.nasa.gov/5315/) | Daily Experimental Fire Weather Forecast | Wildland Fires, Daily Visualizations | Düz 2160x1080 (2:1) tek kare — projeksiyon API'de yazmıyor *(boyut)* | Kategorik (Very Low…; API metninde aralıklar kısmen), ayrı skala dosyası yok | `FWI_forecast_latest.png` (2160x1080) | ? | Günlük, "bugün" tahmini | NASA's Scientific Visualization Studio. Visualizations by Trent L. Schindler. Scientific consulting by Robert Field |
| [5544](https://svs.gsfc.nasa.gov/5544/) | Near Real-Time Normalized Difference Vegetation Index (NDVI) | Daily Visualizations | Düz 2:1 equirectangular (+ Robinson sürümü) *(API)* | NDVI_colorbar.png — NDVI (birimsiz); aralık API'de YOK, görüntüden okunmalı | `nrt_ndvi_equi_2048p30.mp4` (4096x2048) | 61.2 MB | Son ~2.5 yıl, yakın gerçek zamanlı | NASA's Scientific Visualization Studio. Visualizations by Alex Kekesi |
| [5584](https://svs.gsfc.nasa.gov/5584/) | Daily Global Landslide Exposure Map | Daily Visualizations | Düz 2048x1024 (2:1) tek kare — projeksiyon API'de yazmıyor *(boyut)* | Kategorik: kırmızı (çok yüksek) → sarı (düşük) (API metni); ayrı skala dosyası yok | `landslides_daily.png` (2048x1024) | ? | Günlük | NASA's Scientific Visualization Studio. Scientific consulting by Thomas A. Stanley. Visualizations by Zoey N. Armstrong |

## B. Düz harita ama skala yok / 2:1 değil / doğrulanmadı (5)

| ID | Başlık | Kaynak | Projeksiyon (kaynak) | Renk skalası | En küçük uygun dosya | Boyut | Tarih aralığı | Kredi |
|---|---|---|---|---|---|---|---|---|
| [5313](https://svs.gsfc.nasa.gov/5313/) | Change in Night Lights between 2012 and 2023 - EIC Version | challenge | Düz harita 32:9 (7680x2160) — kırpılmış, enlem aralığı kalibre edilmeli *(API)* | YOK (mor = artış, turuncu = azalış; nitel) | `nightlights_flat_series_and_change_wZooms_13_EIC_2160p30_h265.mp4` (7680x2160) | 34.3 MB | 2012–2023 yıllık ortalamalar | NASA's Scientific Visualization Studio. Visualizations by Kel Elkins |
| [5669](https://svs.gsfc.nasa.gov/5669/) | GEOS Aerosols (2025) | challenge | 16:9 tek kare — projeksiyon API'de yazmıyor, görüntüden doğrulanmalı *(—)* | Aerosols_cbar.png — KATEGORİK: deniz tuzu mavi, toz pembe/macenta, duman turuncu/kırmızı, sülfat yeşil (API metni) | `Aerosols_2025-08-19T20_00_00_1920x1080.png` (1920x1080) | ? | 2025-08-19 20:00 UTC (tek an) | NASA's Scientific Visualization Studio. Visualizations by Joseph V. Ardizzone, Helen-Nicole Kostis. Scientific consulting by Lesley Ott |
| [5011](https://svs.gsfc.nasa.gov/5011/) | Lightning Events Detected from the International Space Station (ISS) 2017-2023 | challenge | SOS sürümü 4096x2048 (2:1, SOS = equirectangular olmalı); diğerleri küre *(boyut)* | YOK | `iss_lightning_sos_yearly_07312023_2048p60.mp4` (4096x2048) | 350.2 MB | Mart 2017 – Temmuz 2023, 10 günlük kayan pencere | NASA's Scientific Visualization Studio. Visualizations by Michala Garrison |
| [4897](https://svs.gsfc.nasa.gov/4897/) | Seasonal Global Precipitation Variation from the Global Precipitation Measurement Constellation | Daily Visualizations | Robinson (dosya adı + API "robinson") *(API)* | YOK (dosya olarak) | `imergvar_composite_1080p15.mp4` (1920x1080) | 43.8 MB | En güncel mevsimsel değişim | NASA's Scientific Visualization Studio. Visualizations by Horace Mitchell. Scientific consulting by George Huffman, Gail Skofronick Jackson, Dalia B Kirschbaum |
| [5113](https://svs.gsfc.nasa.gov/5113/) | Active Fires As Observed by VIIRS, 2024-Present | Wildland Fires, Daily Visualizations | Düz 2:1 equirectangular *(API)* | YOK ("No dates or colorbar" — API) | `fires_frp_VIIRS_eq_nl_2048p30.mp4` (4096x2048) | 50.5 MB | 2024 başı → bugün, 5 günlük kayan pencere (FRP) | NASA's Scientific Visualization Studio. Visualizations by Trent L. Schindler |

## C. Küre / 3B (11)

| ID | Başlık | Kaynak | Projeksiyon (kaynak) | Renk skalası | En küçük uygun dosya | Boyut | Tarih aralığı | Kredi |
|---|---|---|---|---|---|---|---|---|
| [5533](https://svs.gsfc.nasa.gov/5533/) | Air Quality Model Runs | challenge | Küre ve harita sürümleri, etiketli; 5760x3240 / 3840x1080 *(API)* | YOK (dosya olarak) | `EIC_AirQuality_Preview_3840x1080.mp4` (3840x1080) | 187.5 MB | bilinmiyor | NASA's Scientific Visualization Studio. Visualizations by Helen-Nicole Kostis, Joseph V. Ardizzone. Scientific consulting by Lesley Ott |
| [5425](https://svs.gsfc.nasa.gov/5425/) | Perpetual Ocean 2: Western Boundary Currents | challenge | Dönen küre + yakınlaşan kamera *(API)* | perpetual_ocean2_CLOSE_101_cbar_temperature.png (°C 0–25), _100_salinity_cbar.png (33–36), _101_cbar_beauty.png (derinlik) | `perpetual_ocean2_CLOSE_095_equator_holdout_1080p30.mp4` (1920x1080) | 2.6 MB | 15 Oca 2021 – 25 Ara 2023 (ECCO) | NASA's Scientific Visualization Studio. Visualizations by Greg Shirah |
| [5196](https://svs.gsfc.nasa.gov/5196/) | DYAMOND Global Carbon Dioxide | challenge | Küre, hareketli kamera, 3B nokta bulutu *(API)* | dyamondCbar_6-27-2024a.png — ppm, renk + OPAKLIK transfer fonksiyonu | `dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4` (1920x1080) | 7.2 MB | Ocak–Mart 2020 | NASA's Scientific Visualization Studio. Visualizations by AJ Christensen. Scientific consulting by Lesley Ott |
| [4960](https://svs.gsfc.nasa.gov/4960/) | A 3D View of an Atmospheric River from an Earth System Model | challenge | 3B küre görünümü *(API)* | atmo_rivers_cbars01.png — katmanlı, birden çok tablo (aralıklar görüntüde) | `atmos_river_DATE_ONLY_HD.mp4` (1920x1080) | 6.9 MB | Model (Earth System Model) — tarih görüntüde | NASA's Scientific Visualization Studio. Visualizations by Greg Shirah. Produced by Jefferson Beck |
| [4950](https://svs.gsfc.nasa.gov/4950/) | GEDI Forest Height | challenge | Küre, abartılı 3B yükseklik, hareketli kamera *(API)* | GEDI_colorbar_0to40/0to50/0to75_01.tif — metre, 0–40 / 0–50 / 0–75 (API); hangisi hangi videoya ait yazmıyor | `GEDI_global_w_colorbar_1080p60.mp4` (1920x1080) | 18.6 MB | API çelişkili: Nis 2019–Nis 2020 / Nis 2018–Nis 2019 | NASA's Scientific Visualization Studio. Visualizations by Kel Elkins |
| [5047](https://svs.gsfc.nasa.gov/5047/) | Net Ecosystem Exchange of Carbon Dioxide | Greenhouse Gases | bilinmiyor (3840x2160, API'de yazmıyor) *(—)* | YOK (dosya olarak) | `co2_nee_5.webm` (3840x2160) | 14.9 MB | 2000–2018 | NASA's Scientific Visualization Studio. Visualizations by Mark SubbaRao. Scientific consulting by Lesley Ott |
| [5110](https://svs.gsfc.nasa.gov/5110/) | Atmospheric Carbon Dioxide Tagged by Source | CO2 Sources and Sinks | Küre / diorama / ortografik zaman çizelgesi *(API)* | 3B lejant (kategorik: fosil turuncu, biyokütle kırmızı, kara yeşil, okyanus mavi) | `JanToDec2021_TaggedCO2_6-9-2023a_TIMELINE_ORTHO_1080p30.mp4` (4096x1080) | 3.1 MB | 2021 | NASA's Scientific Visualization Studio. Visualizations by AJ Christensen, Mark SubbaRao. Scientific consulting by Lesley Ott |
| [5115](https://svs.gsfc.nasa.gov/5115/) | Global Atmospheric Carbon Dioxide (CO₂) | Greenhouse Gases | Hacimsel küre *(API)* | YOK (dosya olarak) | `CO2_Timeline_4096x1080p30.mp4` (4096x1080) | 9.3 MB | 2021 | NASA's Scientific Visualization Studio. Visualizations by Helen-Nicole Kostis. Scientific consulting by Lesley Ott, Brad Weir |
| [5116](https://svs.gsfc.nasa.gov/5116/) | Global Atmospheric Methane (CH₄) | Greenhouse Gases | Hacimsel küre *(API)* | YOK (dosya olarak) | `CH4_Timeline_4096x1080p30.mp4` (4096x1080) | 9.3 MB | 2021 | NASA's Scientific Visualization Studio. Visualizations by Helen-Nicole Kostis. Scientific consulting by Lesley Ott, Brad Weir |
| [5120](https://svs.gsfc.nasa.gov/5120/) | NOAA GOES-East and NOAA GOES-West True Color Imagery Over Past 5 Days | Earth Now, Daily Visualizations | Yer-sabit uydu diski (GOES-East/West), gerçek renk *(API)* | YOK (gerçek renk) | `PR_WorldView_geostationary_east_2160x2160_en.mp4` (2160x2160) | HTTP 404 | Son 5 gün | NASA's Scientific Visualization Studio. Visualizations by Alex Gurvich |
| [5121](https://svs.gsfc.nasa.gov/5121/) | ODIAC: a map of human made carbon dioxide emissions | Greenhouse Gases, CO2 Sources and Sinks | 2160x2160 küre (dosya adı "globe") *(boyut)* | YOK (dosya olarak) | `odiac_2023_2160p60.mp4` (2160x2160) | 132.8 MB | Aralık 2021 | NASA's Scientific Visualization Studio. Visualizations by Mark SubbaRao. Scientific consulting by Tomohiro Oda |

## D. Bölgesel / kutup (8)

| ID | Başlık | Kaynak | Projeksiyon (kaynak) | Renk skalası | En küçük uygun dosya | Boyut | Tarih aralığı | Kredi |
|---|---|---|---|---|---|---|---|---|
| [4993](https://svs.gsfc.nasa.gov/4993/) | Spread of the Dixie Fire - 2021 | challenge | Bölgesel (Kaliforniya, Dixie yangını) *(API)* | YOK (sarı çizgi = yangın cephesi, kırmızı nokta = aktif tespit; nitel) | `Dixie_fire_2021_4x_1080p30.mp4` (1920x1080) | 97.4 MB | 14 Tem – 22 Eki 2021, 12 saatte bir | NASA's Scientific Visualization Studio. Scientific consulting by Doug C. Morton. Visualizations by Cindy Starr |
| [4810](https://svs.gsfc.nasa.gov/4810/) | Reductions in Pollution Associated with Decreased Fossil Fuel Use Resulting from COVID-19 Mitigation | Air Quality | Bölgesel (ABD, Florida, Hindistan, LA…) *(API)* | cbar_NO2_0-5.png — ×10¹⁵ molekül/cm², 0–5 (+ 0–12, SO₂ 0–1 DU) (API) | `march_yearly_NO2.webm` (1920x1080) | 2.7 MB | Mart 2015–2019 ort. vs Mart 2020 | NASA's Scientific Visualization Studio. Visualizations by Trent L. Schindler. Scientific consulting by Bryan Duncan. Written by Bryan Duncan |
| [5046](https://svs.gsfc.nasa.gov/5046/) | Daily Arctic Sea Ice, By Year | Daily Visualizations | Kutup (Arktik) *(API)* | YOK | `arctic_sea_ice_2023.webm` (3840x2160) | 675.2 KB | Yıl bazında | NASA's Scientific Visualization Studio. Visualizations by Trent L. Schindler |
| [5064](https://svs.gsfc.nasa.gov/5064/) | Daily Antarctic Sea Ice, By Year | Daily Visualizations | Kutup (Antarktik) *(API)* | YOK | `antarctic_sea_ice_2023.webm` (3840x2160) | 515.5 KB | Yıl bazında | NASA's Scientific Visualization Studio. Visualizations by Trent L. Schindler |
| [5099](https://svs.gsfc.nasa.gov/5099/) | Daily Polar Sea Ice, Two Year History | Climate Vital Signs, Daily Visualizations | 4096x2048 ama iki kutup yan yana (polar), equirect DEĞİL *(API)* | YOK | `polar_sea_ice_sxs_no_date_2048p30_h265.webm` (4096x2048) | 6.5 MB | Son 2 yıl, günlük | NASA's Scientific Visualization Studio. Visualizations by Trent L. Schindler |
| [5107](https://svs.gsfc.nasa.gov/5107/) | Air Quality Monitoring Stations in Washington D.C. | Air Quality | Bölgesel (Washington D.C. istasyon haritası) *(API)* | YOK | `dc_air_stations_full_preview.png` (1920x1080) | ? | — | NASA's Scientific Visualization Studio. Visualizations by Michala Garrison |
| [5175](https://svs.gsfc.nasa.gov/5175/) | TEMPO - Nitrogen Dioxide Air Pollution Over North America - Additional Views | Air Quality | Bölgesel (Kuzey Amerika, TEMPO) *(API)* | YOK (dosya olarak) | `tempo_no2_el-paso_1080p60.mp4` (1920x1080) | 24.1 MB | API metninde gün içi; tarih görüntüde | NASA's Scientific Visualization Studio. Visualizer: Kel Elkins, Trent L. Schindler, Cindy Starr; Technical support: Laurence Schuler, Ian Jones; Scientist: Caroline Nowlan, Xiong Liu; Producer: Katie Jepson |
| [5382](https://svs.gsfc.nasa.gov/5382/) | Arctic Sea Ice Minimum 2024 | Climate Vital Signs | Kutup (Arktik) *(API)* | YOK | `sea_ice_2024_min_1080p60.mp4` (1920x1080) | 40.0 MB | 14 Mar – 11 Eyl 2024 | NASA's Scientific Visualization Studio. Visualizations by Trent L. Schindler. Produced by Grace Weikert. Scientific consulting by Walt Meier |

## E. Grafik / veri haritası değil (15)

| ID | Başlık | Kaynak | Projeksiyon (kaynak) | Renk skalası | En küçük uygun dosya | Boyut | Tarih aralığı | Kredi |
|---|---|---|---|---|---|---|---|---|
| [13786](https://svs.gsfc.nasa.gov/13786/) | Data Sonification: Caldwell 73 | challenge | Uzay görüntüsü (Hubble) — VERİ DEĞİL, yöntem referansı *(API)* | — | `Caldwell73_2K_Final.webm` (1920x1920) | 5.9 MB | — | NASA Goddard Media Studios; sonifikasyon: SYSTEM Sounds (M. Russo, A. Santaguida) |
| [5067](https://svs.gsfc.nasa.gov/5067/) | Earth Observing Fleet - Now | Daily Visualizations | Uydu filosu (veri haritası değil) *(API)* | — | `fleet_today_30sec` (3840x2160) | ? | Yakın gerçek zamanlı | NASA's Scientific Visualization Studio. Visualizations by Kel Elkins |
| [5072](https://svs.gsfc.nasa.gov/5072/) | Atlantic Hurricane Wind Speed Plots | Daily Visualizations | Grafik (zaman × rüzgâr hızı) *(API)* | — | `atlantic_jan_to_dec_singleYear.mp4` (3840x2160) | 2.3 MB | 1950 → bugün | NASA's Scientific Visualization Studio. Visualizations by Greg Shirah |
| [5081](https://svs.gsfc.nasa.gov/5081/) | National Carbon Dioxide (CO₂) budgets inferred from atmospheric observations | CO2 Sources and Sinks | Ülke bazlı grafik/küre (API: globe) *(API)* | YOK | `TerrestrialStockChange_Light_1920x1080_30fps.webm` (1920x1080) | 1.2 MB | 2015–2020 | NASA's Scientific Visualization Studio. Visualizations by Helen-Nicole Kostis, Greg Shirah. Scientific consulting by Brendan Byrne |
| [5111](https://svs.gsfc.nasa.gov/5111/) | Increase in Ocean Heat since 1957 Map - Spilhaus Projection | Climate Vital Signs | Spilhaus projeksiyonu + grafik *(API)* | YOK | `OceanHeatGraph.png` (1800x1440) | ? | 1957 → | NASA's Scientific Visualization Studio. Visualizations by Michala Garrison |
| [5117](https://svs.gsfc.nasa.gov/5117/) | Trends in atmospheric Nitrous Oxide (N₂O) | Greenhouse Gases | Grafik *(API)* | — | `N2O_Trends_1920x1080p30.mp4` (1920x1080) | 7.8 MB | Oca 2001 – Ara 2022 | NASA's Scientific Visualization Studio. Visualizations by Helen-Nicole Kostis |
| [5118](https://svs.gsfc.nasa.gov/5118/) | Trends in atmospheric Methane (CH₄) | Greenhouse Gases | Grafik *(API)* | — | `CH4_Trends_1920x1080.mp4` (1920x1080) | 4.6 MB | Tem 1983 – Ara 2022 | NASA's Scientific Visualization Studio. Visualizations by Helen-Nicole Kostis. Scientific consulting by Lesley Ott, Brad Weir |
| [5119](https://svs.gsfc.nasa.gov/5119/) | OCO-2 and Keeling Curve: Trends in global atmospheric Carbon Dioxide (CO₂) | Climate Vital Signs, Greenhouse Gases | Grafik (OCO-2 + Keeling) *(API)* | — | `OCO2_KeelingCurve_1920x1080p30.mp4` (1920x1080) | 5.6 MB | bilinmiyor | NASA's Scientific Visualization Studio. Visualizations by Helen-Nicole Kostis |
| [5126](https://svs.gsfc.nasa.gov/5126/) | NOAA Annual Greenhouse Gas Index | Greenhouse Gases | Grafik (AGGI halka grafik) *(API)* | — | `AGGI_1920x800_cc.png` (1920x800) | ? | 1979–2022/2023 (API metinleri çelişkili) | NASA's Scientific Visualization Studio. Visualizations by Mark SubbaRao. Scientific consulting by Lesley Ott |
| [5190](https://svs.gsfc.nasa.gov/5190/) | NASA Climate Spiral 1880-Present | Climate Vital Signs | Grafik (iklim sarmalı) *(API)* | — | `GISTEMP_Spiral_English_degC_2160p60.mp4` (2160x2160) | 19.9 MB | 1880 → bugün | NASA's Scientific Visualization Studio. Visualizations by Mark SubbaRao |
| [5191](https://svs.gsfc.nasa.gov/5191/) | Global Temperature Graph 1880-2024 | Climate Vital Signs | Grafik *(API)* | — | `GISTEMP_Curves_English_degC_2160p60.mp4` (3840x2160) | 35.4 MB | 1880–2024 | NASA's Scientific Visualization Studio. Visualizations by Mark SubbaRao |
| [5209](https://svs.gsfc.nasa.gov/5209/) | Zonal Climate Anomalies 1880-2023 | Climate Vital Signs | Grafik (enlem bantları) *(API)* | — | `GISTEMP_Zonal_1880-2023_C.mp4` (3840x2160) | 21.2 MB | 1880–2023 | NASA's Scientific Visualization Studio. Visualizations by Mark SubbaRao |
| [5235](https://svs.gsfc.nasa.gov/5235/) | Sea Level Through a Porthole (2023) | Climate Vital Signs | Kavramsal (lombar penceresi) *(API)* | — | `seaLevelWaveTankComp_noWW_3-5-5-2024a_2160p30.mp4` (2160x2160) | 64.4 MB | 2023 | NASA's Scientific Visualization Studio. Visualizations by AJ Christensen |
| [5453](https://svs.gsfc.nasa.gov/5453/) | Annual Wildfire Burned Area in the United States | Wildland Fires | Grafik *(API)* | — | `fireIncrease.mp4` (3840x2160) | 1.2 MB | 1983–2024 | NASA's Scientific Visualization Studio. Visualizations by Mark SubbaRao |
| [5577](https://svs.gsfc.nasa.gov/5577/) | SDO Sun This Week | Daily Visualizations | Güneş (SDO) — Dünya verisi değil *(API)* | — | `STWrolling_24hr_2048p30.mp4` (2048x2048) | 29.6 MB | Son 7 gün | NASA's Scientific Visualization Studio. Visualizations by AJ Christensen. Written by Miles S. Hatfield |

## Galerilerdeki dış bağlantılar (SVS sayfası değil)

API bu öğeler için yalnızca küçük resim veriyor (hedef URL yok). Worldview / FIRMS / NOAA gibi dış uygulamalara işaret ediyorlar; veri olarak kullanılamazlar.

| Galeri | Başlık |
|---|---|
| Earth Now | True color imagery from Terra satellite |
| Earth Now | Black Marble night time imagery from Suomi NPP satellite |
| Earth Now | Geostationary imagery from NOAA and JAXA satellites |
| Earth Now | Active fires detected by Suomi NPP satellite |
| Earth Now | Rain and Snow |
| Earth Now | Sea Surface Temperature |
| Earth Now | Land Surface Temperature |
| Earth Now | Polar Sea Ice concentration - Arctic animation |
| Earth Now | Polar Sea Ice - Antarctic animation |
| Air Quality | Active fires detected by Suomin NPP satellite |
| Air Quality | Carbon Monoxide (CO) by Aqua Satellite |
| Air Quality | Nitrogen Dioxide (NO2) by Aura satellite |
| Air Quality | Aerosol Optical Depth (AOD) by Suomi NPP |
| Air Quality | Air Quality Index for DC |
| Air Quality | Eyes on Earth: Aqua satellite |
| Air Quality | Eyes on Earth: Aura Satellte |
| Wildland Fires | Worldview Active Fires from VIIRS |
| Wildland Fires | NASA FIRMS Global Active Fires |
| Wildland Fires | Experimental Smoke Forecast by NOAA |
| Wildland Fires | Worldview Active Fires from VIIRS |
| Wildland Fires | NASA Firms: US/Canada Active Fires |
| Wildland Fires | NASA FIRMS: Red Flags abd Fire Weather for US |

## Aşama 2 için dikkat

- **5011** SOS videosu 350.2 MB (> 300 MB). Aynı 2:1 formatta daha küçük sürüm yok. Diğer sürümler: 1920x1080 küre 133.2 MB (2:1 değil).
- **5176** tüm mp4'ler 348–363 MB (> 300 MB) → sadece kare seti ile kullanılabilir.
- **5101 / 5176 / 5544 / 5113 / 4285 / 5315 / 5584** her gün güncelleniyor: indirilen dosya o günün anlık görüntüsü; indirme tarihi kaydedilmeli.
- **GEOS-FP/CF serisi (5147–5154)**: 2048x1024 ve küçük (15–87 MB), renk skalası PNG'leri var; ama projeksiyon ve tarih API'de yazmıyor → kareden doğrulanmalı.

## Aşama 3 doğrulaması sonrası düzeltmeler (14 Kasım 2026)

Ayrıntı: [stage3_notes.md](stage3_notes.md), [calibration.json](calibration.json).

- **5313**: "tek 32:9 harita" DEĞİL → iki tam küre kopyası yan yana (her biri 3840x2160, 16:9'a gerilmiş, 11.4° kaydırılmış). Değişim bölümünde videoya gömülü renk skalası VAR (göreli, sayısız).
- **5147**: projeksiyon tam küre eşdikdörtgen (doğrulandı); tarih aralığı 2026-10-30 09:00 UTC → 2026-11-14 20:00 UTC, saatlik (karelerden okundu); son 9 kare indirme anına göre tahmin.
- **5011**: SOS sürümü tam küre eşdikdörtgen (doğrulandı); tarih etiketi yok.
- **5669**: 1920x1080 = 16:9'a gerilmiş tam küre (doğrulandı). Kategori adları renk skalasından: Black Carbon / Dust / Sea Salt / Sulfate.
- **5544**: renk skalasında sayı yok ("Low"…"High").
- **4950**: üç renk skalası aynı renk geçişi; küresel video 0–50 m kullanıyor.
- **5196**: renk skalasında sayı yok; video renkleri skalaya eşlenemedi.
