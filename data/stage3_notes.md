# Veri hattı — doğrulama notları (14 Kasım 2026)

Tekrar üretmek için (sırayla):

```
node scripts/download.mjs        # raw/<id>/  (300 MB üstünü indirmez; 5011 kullanıcı onaylı)
ffmpeg -i raw/5011/iss_lightning_sos_yearly_07312023_2048p60.mp4 -vf scale=2048:1024:flags=area -c:v libx264 -crf 18 -an raw/5011/iss_lightning_sos_2048x1024.mp4
node scripts/calibrate.mjs       # data/calibration.json
node scripts/colorscales.mjs     # public/data/<id>_colorscale.json
node scripts/process.mjs         # public/data/<id>.json + cities.json
node scripts/query.mjs Sivas     # "herhangi bir yer" sınaması
```

## Projeksiyon (karelerden doğrulandı)

| ID | Sonuç | Yöntem | 5 şehir hatası |
|---|---|---|---|
| 5544 | Tam küre eşdikdörtgen (REFERANS) | API + görsel kırpım | ≤1 px (≤10 km) |
| 3912 | Tam küre eşdikdörtgen | maske oturtma (uyum %97.6) | 0–1 px, ≤19.4 km |
| 5011 | Tam küre eşdikdörtgen | medyan arka plan maskesi + kontrastlı görsel | 0–1.4 px (≤25.5 km); NY maskede 8 px ama görsel ≤1 px (bkz. calibration.json) |
| 5147 | Tam küre eşdikdörtgen | görsel (kıyı sıcaklık sınırı) | Samsun/Tokyo/NY ≤1 px; Lagos, Sidney ölçülemedi |
| 5669 | Tam küre, 1920x1080'e (16:9) gerilmiş | şehir ışığı merkezi | 0.5–1.1 px (8–19 km) |
| 5313 | İKİ kopya yan yana; her biri 3840x2160 tam küre, 16:9'a gerilmiş, boylam −168.6…191.3 (11.4° kaydırılmış) | maske oturtma (uyum %99.0; FULL varsayımı %83.7) | 0–1.4 px (≤12.2 km) |
| 4950, 5196 | Küre / 3B, hareketli kamera | görsel | lat/lon yok |

## Renk skalaları (görselden okunanlar)

- **3912**: 0, 10, 20, 32 °C etiketleri; merkezler x = 12.5, 100.5, 187.5, 291.5 → doğrusal (artık ≤0.8 px).
- **5147**: −40…40 °C; etiketli görselde 2. etiket "−10" yazıyor, çentik aralığına göre −30 olmalı (NASA görselinde yazım hatası). Çubuk x 73..462, çentik 48.75 px = 10 °C.
- **5544**: "Land Vegetation (NDVI)", uçlarda yalnız "Low" / "High" — **sayı yok** → göreli 0..1.
- **4950**: 0–40, 0–50, 0–75 m TIF'leri **aynı renk geçişini** kullanıyor (yalnız etiket farklı). Küresel videoda ekrandaki skala 0–50 m.
- **5669**: kategorik — Black Carbon, Dust, Sea Salt, Sulfate (API metni "duman / deniz tuzu mavi" diyor; renk skalası esas alındı). Miktar yok.
- **5196**: etiket/sayı **yok** (yalnız renk + opaklık) → ppm bilinmiyor; videoda renk eşleme başarısız (%0.15) → yalnız parlaklık.
- **5313**: değişim bölümünde (kare 300–630) **videoya gömülü skala** bulundu: "Change in Lighting Intensity from 2012 to 2023", lights out / no change / new lights — sayı yok → göreli −1..+1.

## Zaman

- **5147**: kare üstü etiket: kare 0 = 2026-10-30 09:00 UTC, saatlik, kare 371 = 2026-11-14 20:00 UTC. İndirme 11:23 UTC → kare 363–371 kesin TAHMİN.
- **5313**: yıl etiketi geçiş kareleri 15, 33, 51, 69, 86, 104, 122, 139, 157, 175, 193 → 2012–2023. Harita etiketle aynı karede değişiyor (geçiş efekti yok). H.265 anahtar kare gürültüsü (≈30 karede bir) yıl farkı kadar büyük → yıl katmanları tüm karelerin ortalaması.
- **5011**: tarih etiketi YOK → kare→tarih bilinmiyor.
- **5544**: tarihsiz sürüm indirildi → kare→tarih bilinmiyor.
- **3912**: yalnız aralık (2007-03-25 → 2008-03-03); kare başına tarih yok.

## Bilinen sınırlar

- 3912: soğuk sulardaki koyu lacivert akış çizgileri parlaklık eşiğine (≥70) takılıyor → yüksek enlemlerde değer seyrek, ortalamalar sıcağa kayabilir.
- 5669: türler toplanarak karışıyor; baskın tür seçiliyor. Gri (kara/buz/şehir ışığı) → "yok".
- 5147: logo (sol üst) ve tarih kutusu (sol alt) maskeli → o hücreler boş.
