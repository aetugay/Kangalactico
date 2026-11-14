# Veri envanteri (15 Kasım 2026)

Challenge kaynakları: SVS 13786, 5313, 3912, 5669, 5533, 5425, 5196, 5011, 4960, 4950 + EIC galerisi (5147, 5544 dahil).

| Katman | Kaynak | Sınıf | Uygulamada aktif mi | public/data dosyası |
|---|---|---|---|---|
| Yüzey hava sıcaklığı | SVS 5147 (GEOS-FP) | EIC GALERİSİ | evet (radar) | 5147.json, 5147_colorscale.json |
| Bitki örtüsü NDVI (göreli) | SVS 5544 | EIC GALERİSİ | evet (radar) — bu sürümde açıldı | 5544.json, 5544_colorscale.json |
| Okyanus sıcaklığı + akıntılar | SVS 3912 (ECCO2) | LİSTEDEN | evet (radar + küre videosu) | 3912.json, 3912_colorscale.json; media/sst_3912_1024.mp4 |
| Aerosoller (4 tür, göreli) | SVS 5669 (GEOS) | LİSTEDEN | evet (radar) | 5669.json, 5669_colorscale.json; media/aerosols_5669_2048.jpg |
| Gece ışıkları 2012–2023 (göreli) | SVS 5313 (Black Marble) | LİSTEDEN | evet (radar) — bu sürümde açıldı | 5313.json, 5313_colorscale.json |
| Yıldırım 2017–2023 | SVS 5011 (ISS LIS) | LİSTEDEN | evet (radar, vurmalı olay) — bu sürümde açıldı | 5011.json |
| Orman yüksekliği (göreli) | SVS 4950 (GEDI) | LİSTEDEN | evet ("görüntüyü dinle"; küre, radar değil) — bu sürümde açıldı | 4950.json, 4950_colorscale.json |
| Küresel CO₂ modeli (göreli) | SVS 5196 (DYAMOND) | LİSTEDEN | evet ("görüntüyü dinle"; küre, radar değil) — bu sürümde açıldı | 5196.json, 5196_colorscale.json |
| Caldwell 73 sonifikasyonu | SVS 13786 | LİSTEDEN | yöntem referansı (veri değil) | — |
| Air Quality Model Runs | SVS 5533 | LİSTEDEN | hayır (indirilmedi) | — |
| Perpetual Ocean 2 | SVS 5425 | LİSTEDEN | hayır (küre, indirilmedi) | — |
| Atmospheric River 3D | SVS 4960 | LİSTEDEN | hayır (3B, indirilmedi) | — |
| Karbondioksit 2021 (ppm) | OCO2_GEOS_L3CO2_DAY (GES DISC) | LİSTE DIŞI NASA | evet (radar) | co2_2021_grid.json, co2_2021_stations.json |
| 13 aylık katman (MERRA-2 2024, OCO-2 2021) | GES DISC (Ceyhun paketi v3) | LİSTE DIŞI NASA | evet (radar) | m24/meta.json, monthly.bin, co2_daily.bin |
| Dünya olayları | NASA EONET (canlı) | LİSTE DIŞI NASA | evet (liste) | — (canlı) |
| Taban Dünya görüntüsü | NASA Blue Marble NG | LİSTE DIŞI NASA | yalnız görsel altlık | media/bluemarble_4096.jpg, _2048.jpg |
| Kara maskesi (eski 2D kıyı) | SVS 5544'ten türetildi | EIC GALERİSİ (türev) | yalnız görsel | land_mask.json |
| Kıyı çizgileri, kara poligonları | Natural Earth (kamu malı) | NASA DEĞİL — yardımcı, sonifiye edilmez | yalnız görsel | coastline_50m.json, land_50m.json |
| Şehir adları | GeoNames (CC BY 4.0) | NASA DEĞİL — yardımcı, sonifiye edilmez | yer arama | cities.json |
| ~~Mauna Loa CO₂ 1959–2023~~ | NOAA | NASA DEĞİL | **kaldırıldı** (src/legacy, demo/, co2.json silindi) | — |
