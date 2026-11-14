// Hakkında → veri envanteri: her katmanın kaynağı ve challenge listesine göre sınıfı + doğrulama sonuçları.
// Kaynak ve sayılar: data/envanter.md, data/audit_ceyhun_v3.json, data/api_v3_tutarlilik.json.
import type { Lang } from '../i18n.ts';

type Row = { name: [string, string]; src: string; cls: 'list' | 'eic' | 'nasa' | 'aux'; how: [string, string] };
const ROWS: Row[] = [
  { name: ['Yüzey hava sıcaklığı', 'Surface air temperature'], src: 'SVS 5147 (GEOS-FP)', cls: 'eic', how: ['ses dünyası: buzlu rüzgâr ↔ ağustos böcekleri', 'sound world: icy wind ↔ cicadas'] },
  { name: ['Orman ve bitki örtüsü (NDVI, göreli)', 'Forest & vegetation (NDVI, relative)'], src: 'SVS 5544', cls: 'eic', how: ['ses dünyası: yaprak + kuşlar', 'sound world: leaves + birds'] },
  { name: ['Okyanus sıcaklığı ve akıntılar', 'Ocean temperature & currents'], src: 'SVS 3912 (ECCO2)', cls: 'list', how: ['ses dünyası: dalgalar (+ küre videosu)', 'sound world: waves (+ globe video)'] },
  { name: ['Aerosoller (4 tür, göreli)', 'Aerosols (4 types, relative)'], src: 'SVS 5669 (GEOS)', cls: 'list', how: ['ses dünyası: kum fırtınası, yangın, serpinti, volkan', 'sound world: sandstorm, fire, spray, volcano'] },
  { name: ['Gece ışıkları 2012–2023 (göreli)', 'Night lights 2012–2023 (relative)'], src: 'SVS 5313 (Black Marble)', cls: 'list', how: ['ses dünyası: şehir uğultusu', 'sound world: city hum'] },
  { name: ['Yıldırım 2017–2023', 'Lightning 2017–2023'], src: 'SVS 5011 (ISS LIS)', cls: 'list', how: ['ses dünyası: gök gürültüsü', 'sound world: thunder'] },
  { name: ['Orman yüksekliği (göreli)', 'Forest height (relative)'], src: 'SVS 4950 (GEDI)', cls: 'list', how: ['görüntüyü dinle: orman sesi (küre, radar değil)', 'listen to image: forest sound (globe, not radar)'] },
  { name: ['Küresel CO₂ modeli (göreli)', 'Global CO₂ model (relative)'], src: 'SVS 5196 (DYAMOND)', cls: 'list', how: ['kullanılmıyor (6 ses dünyasında yok)', 'not used (not one of the 6 sound worlds)'] },
  { name: ['Karbondioksit 2021 (ppm)', 'Carbon dioxide 2021 (ppm)'], src: 'OCO2_GEOS_L3CO2_DAY (GES DISC)', cls: 'nasa', how: ['veri doğrulaması (ana deneyimde değil)', 'data validation (not in the main experience)'] },
  { name: ['13 aylık katman (MERRA-2 2024 + OCO-2 2021)', '13 monthly layers (MERRA-2 2024 + OCO-2 2021)'], src: 'GES DISC (Ceyhun, paket v3)', cls: 'nasa', how: ['veri doğrulaması (ana deneyimde değil)', 'data validation (not in the main experience)'] },
  { name: ['Dünya olayları (canlı)', 'Earth events (live)'], src: 'NASA EONET', cls: 'nasa', how: ['liste + yere git', 'list + go to place'] },
  { name: ['Taban Dünya görüntüsü', 'Base Earth image'], src: 'NASA Blue Marble NG', cls: 'nasa', how: ['yalnız görsel altlık', 'display base only'] },
  { name: ['Kıyı çizgileri, kara poligonları', 'Coastlines, land polygons'], src: 'Natural Earth (kamu malı)', cls: 'aux', how: ['yalnız görsel; veri değil', 'display only; not data'] },
  { name: ['Şehir adları', 'City names'], src: 'GeoNames (CC BY 4.0)', cls: 'aux', how: ['yer arama; veri değil', 'place search; not data'] },
];
const CLS: Record<Row['cls'], [string, string]> = {
  list: ['Challenge listesinden', 'From the challenge list'], eic: ['EIC galerisinden', 'From the EIC gallery'],
  nasa: ['Liste dışı NASA', 'Other NASA'], aux: ['NASA değil (yardımcı, sonifiye edilmez)', 'Not NASA (auxiliary, not sonified)'],
};

export function DataInventory({ lang }: { lang: Lang }) {
  const en = lang === 'en', i = en ? 1 : 0;
  return (
    <>
      <h3>{en ? 'Data inventory' : 'Veri envanteri'}</h3>
      <p className="small">{en
        ? 'Two kinds of data: (1) layers read from NASA EIC visualizations (challenge list SVS 13786, 5313, 3912, 5669, 5533, 5425, 5196, 5011, 4960, 4950 + EIC gallery) — the primary experience; (2) NASA raw data (OCO-2, MERRA-2) with numeric values everywhere, used to validate the visual layers. SVS 13786 (Caldwell 73) is the method reference, not data. 5533, 5425 and 4960 are not used (no suitable flat map / not downloaded). Nothing non-NASA is sonified.'
        : 'İki tür veri: (1) NASA EIC görsellerinden okunan katmanlar (challenge listesi SVS 13786, 5313, 3912, 5669, 5533, 5425, 5196, 5011, 4960, 4950 + EIC galerisi) — ana deneyim; (2) her yerde sayısal değer veren NASA ham verisi (OCO-2, MERRA-2), görsel katmanları doğrulamak için. SVS 13786 (Caldwell 73) veri değil, yöntem referansı. 5533, 5425 ve 4960 kullanılmıyor (uygun düz harita yok / indirilmedi). NASA dışı hiçbir veri sonifiye edilmez.'}</p>
      <div className="inv-wrap">
        <table className="inv">
          <thead><tr><th>{en ? 'Layer' : 'Katman'}</th><th>{en ? 'Source' : 'Kaynak'}</th><th>{en ? 'Class' : 'Sınıf'}</th><th>{en ? 'Used as' : 'Kullanım'}</th></tr></thead>
          <tbody>{ROWS.map((r) => <tr key={r.src + r.name[0]}><td>{r.name[i]}</td><td>{r.src}</td><td>{CLS[r.cls][i]}</td><td>{r.how[i]}</td></tr>)}</tbody>
        </table>
      </div>
      <h3>{en ? 'Data validation' : 'Veri doğrulaması'}</h3>
      <p className="small">{en ? 'The main experience uses only the 6 sound worlds made from challenge visualizations. NASA raw data (OCO-2 CO₂ 2021, MERRA-2 2024) stays in the project only to check that the values we read from the images are right:' : 'Ana deneyim yalnız challenge görsellerinden yapılan 6 ses dünyasını kullanır. NASA ham verisi (OCO-2 CO₂ 2021, MERRA-2 2024) projede yalnız görsellerden okuduğumuz değerlerin doğru olduğunu sınamak için durur:'}</p>
      <ul className="small">
        <li>{en ? 'MERRA-2 T2M (Nov 2024) ↔ SVS 5147 GEOS-FP 2 m temperature (image-derived): spatial correlation r = 0.966 (12,536 cells).' : 'MERRA-2 T2M (Kasım 2024) ↔ SVS 5147 GEOS-FP 2 m sıcaklığı (görselden okunan): mekânsal korelasyon r = 0,966 (12.536 hücre).'}</li>
        <li>{en ? 'MERRA-2 TSKINWTR (Jan 2024) ↔ SVS 3912 ECCO2 sea surface temperature (image-derived, 2007): r = 0.978 (5,693 sea cells; different years, pattern only).' : 'MERRA-2 TSKINWTR (Ocak 2024) ↔ SVS 3912 ECCO2 deniz yüzeyi sıcaklığı (görselden okunan, 2007): r = 0,978 (5.693 deniz hücresi; farklı yıllar, yalnız desen).'}</li>
        <li>{en ? 'OCO-2 2021 internal consistency: package daily CO₂ day 1 ↔ team OCO-2 2021 grid (1 Jan): r = 0.997 (max difference 2.6 ppm, quantization); package monthly ↔ team grid: r = 0.976.' : 'OCO-2 2021 iç tutarlılık: paket günlük CO₂ 1. gün ↔ ekip OCO-2 2021 ızgarası (1 Ocak): r = 0,997 (en büyük fark 2,6 ppm, nicemleme); paket aylık ↔ ekip ızgarası: r = 0,976.'}</li>
        <li>{en ? 'Team API (version 3) ↔ static files: 15 series identical at 5 places (Sivas, Tokyo, Lagos, Amazon, Svalbard).' : 'Ekip API\'si (sürüm 3) ↔ statik dosyalar: 5 yerde (Sivas, Tokyo, Lagos, Amazon, Svalbard) 15 seri birebir aynı.'}</li>
        <li>{en ? 'Not shown (failed the audit): CO and black carbon (2–3× too high, no source-based fix yet).' : 'Gösterilmeyen (denetimden geçmedi): CO ve siyah karbon (2–3 kat yüksek, kaynağa dayalı düzeltme henüz yok).'}</li>
      </ul>
    </>
  );
}
