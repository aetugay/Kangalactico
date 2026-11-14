# EarthEar

**Ekip:** Kangalactico · **NASA Space Apps Challenge 2026 – The Earth Information Jukebox** (Sivas yerel etkinliği)

EarthEar, Dünya'nın herhangi bir yerinin çevresini sesle dinlemeyi sağlayan erişilebilir bir veri radarıdır. Kullanıcı bir yer seçer (şehir arama, haritaya dokunma ya da "Konumumu kullan"); radar o yerin çevresinde döner ve veriyi sese çevirir:

- **yön → stereo konum** (batı sol kulak, doğu sağ kulak; kuzey her turda bir "tık")
- **uzaklık → perde** (yakın pes, uzak tiz)
- **katman → enstrüman**, **değer → ses şiddeti**
- menzil 500 / 2000 / 5000 km; 15 saniyelik sesli lejant; klavye (Boşluk, ←/→, S) ve ekran okuyucu desteği

Hiçbir şehir kodda sabit değildir; radar dünyanın her yerinde çalışır.

## Çalıştırma

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # statik site → dist/
npm run test:radar # radar hesaplarını gerçek veriyle sınar (Tokyo, Lagos, Sivas)
```

Gereksinim: Node.js 22+ (testler Node 24'ün TypeScript desteğini kullanır).

## Veri hattı

İşlenmiş veriler `public/data/*.json` içinde hazırdır. Yeniden üretmek için (ffmpeg gerekir; ham NASA medyası `raw/` altına iner ve depoya girmez):

```bash
node scripts/download.mjs     # SVS medyası → raw/
node scripts/calibrate.mjs    # projeksiyon kalibrasyonu → data/calibration.json
node scripts/colorscales.mjs  # renk skalası → değer tabloları
node scripts/process.mjs      # görüntü/video → 1° ızgara JSON
node scripts/co2.mjs          # ekip CO₂ paketi → co2_2021_*.json (referans/ gerekir)
```

Ayrıntılar: `data/catalog.md` (SVS kataloğu), `data/stage3_notes.md` (doğrulama ve kalibrasyon), `data/calibration.json`.

## Veri kaynakları ve krediler

| Katman | Kredi |
|---|---|
| Karbondioksit (radarın ilk katmanı) | Veri: NASA OCO-2 GEOS Level 3 Daily CO2 (OCO2_GEOS_L3CO2_DAY), GES DISC. 2021; ekibimiz GES DISC verisinden üretti. Aylık katmanlar ayın 1. gününün değeridir. |
| Yüzey sıcaklığı | Visualization: NASA Scientific Visualization Studio, Joseph V. Ardizzone (NASA/GSFC) — GEOS-FP, [SVS 5147](https://svs.gsfc.nasa.gov/5147/) |
| Aerosoller | Visualization: NASA Scientific Visualization Studio, Joseph V. Ardizzone (NASA/GSFC), Helen-Nicole Kostis (STC); scientific consulting Lesley Ott (NASA/GSFC) — [SVS 5669](https://svs.gsfc.nasa.gov/5669/) |
| Yıldırım (ISS LIS) | Visualization: NASA Scientific Visualization Studio, Michala Garrison (SSAI) — [SVS 5011](https://svs.gsfc.nasa.gov/5011/) |
| Deniz yüzeyi sıcaklığı | Visualization: NASA Scientific Visualization Studio, Greg Shirah (NASA/GSFC); scientists Hong Zhang, Dimitris Menemenlis (ECCO2) — [SVS 3912](https://svs.gsfc.nasa.gov/3912/) |
| Gece ışıkları | Visualization: NASA Scientific Visualization Studio, Kel Elkins (USRA) — Black Marble, [SVS 5313](https://svs.gsfc.nasa.gov/5313/) |
| Bitki örtüsü (NDVI) ve kıyı maskesi | Visualization: NASA Scientific Visualization Studio, Alex Kekesi (GST) — [SVS 5544](https://svs.gsfc.nasa.gov/5544/) |
| Orman yüksekliği (GEDI) | Visualization: NASA Scientific Visualization Studio, Kel Elkins (USRA) — [SVS 4950](https://svs.gsfc.nasa.gov/4950/) |
| Küresel CO₂ (DYAMOND) | Visualization: NASA Scientific Visualization Studio, AJ Christensen (SSAI); scientific consulting Lesley Ott (NASA/GSFC) — [SVS 5196](https://svs.gsfc.nasa.gov/5196/) |
| Şehirler | GeoNames (geonames.org), CC BY 4.0 |

SVS görsellerindeki değerler, görselin kendi renk skalasından okunmuştur. Renk skalasında sayı olmayan görseller (NDVI, DYAMOND, gece ışıkları değişimi, aerosol yoğunluğu) "göreli" olarak kullanılır; değer uydurulmaz.

---

Bu proje NASA verisi kullanılarak NASA Space Apps Challenge 2026 için hazırlanmıştır; NASA tarafından onaylanmamıştır.
