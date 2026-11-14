// Plak kataloğu. Yeni veri seti eklemek = public/data/<id>.json koy + burada dataFile ver.
// dataFile yoksa plak "Yakında" görünür; değer UYDURULMAZ.

export type Group = 'orchestra' | 'lakes';

export interface RecordDef {
  id: string;
  group: Group;
  title: string;
  desc: string;
  /** Plak etiketinin rengi (görsel). */
  color: string;
  /** public/data altındaki dosya adı. Yoksa plak henüz çalınamaz. */
  dataFile?: string;
}

/** public/data/*.json biçimi. */
export interface Dataset {
  id: string;
  title: string;
  unit: string;
  decimals?: number;
  source: string;
  sourceUrl: string;
  /** [yıl, değer] çiftleri, yıla göre artan. */
  series: [number, number][];
}

export const GROUPS: { id: Group; title: string; desc: string }[] = [
  { id: 'orchestra', title: 'Dünya orkestrası', desc: 'Her iklim göstergesi bir enstrüman.' },
  { id: 'lakes', title: 'Türkiye’nin kuruyan gölleri', desc: 'Landsat su alanı ölçümleri.' },
];

export const RECORDS: RecordDef[] = [
  { id: 'co2', group: 'orchestra', title: 'Karbondioksit', desc: 'Mauna Loa, 1959–2023. Atmosferdeki CO₂ yıllık ortalaması.', color: '#e8590c', dataFile: 'co2.json' },
  { id: 'temp', group: 'orchestra', title: 'Küresel sıcaklık', desc: 'NASA GISTEMP yıllık anomali.', color: '#dc2626' },
  { id: 'ice', group: 'orchestra', title: 'Arktik deniz buzu', desc: 'Eylül minimum alanı (NSIDC/NASA).', color: '#0284c7' },
  { id: 'sea', group: 'orchestra', title: 'Deniz seviyesi', desc: 'Uydu altimetrisi (NASA).', color: '#0f766e' },
  { id: 'fire', group: 'orchestra', title: 'Orman yangınları', desc: 'MODIS/VIIRS aktif yangın sayısı.', color: '#b45309' },
  { id: 'burdur', group: 'lakes', title: 'Burdur Gölü', desc: 'Landsat su yüzeyi alanı.', color: '#2563eb' },
  { id: 'tuz', group: 'lakes', title: 'Tuz Gölü', desc: 'Landsat su yüzeyi alanı.', color: '#7c3aed' },
  { id: 'van', group: 'lakes', title: 'Van Gölü', desc: 'Landsat su yüzeyi alanı.', color: '#0891b2' },
];

export const isLive = (r: RecordDef) => Boolean(r.dataFile);
