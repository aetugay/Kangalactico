// Yer sözlüğü: ülkeler (Natural Earth 1:50m admin-0, kamu malı: NAME_TR, NAME_EN, LABEL_X/Y) + başkentler
// (Natural Earth populated places, adm0cap) + elle yazılmış yaygın alternatif adlar + kıta/bölge/deniz listesi.
// Girdi : raw/natural_earth/ne_50m_admin_0_countries.geojson, ne_50m_populated_places_simple.geojson (git'e girmez)
// Çıktı : public/data/places.json — { countries: [...], regions: [...], cityAliases: {...} }
// Kullanım: node scripts/places.mjs
import fs from 'node:fs';

const C = JSON.parse(fs.readFileSync('raw/natural_earth/ne_50m_admin_0_countries.geojson', 'utf8')).features.map((f) => f.properties);
const P = JSON.parse(fs.readFileSync('raw/natural_earth/ne_50m_populated_places_simple.geojson', 'utf8')).features.map((f) => f.properties);
const r2 = (x) => Math.round(x * 100) / 100;

// yaygın alternatif adlar (TR + EN), ISO-A3 (ADM0_A3) anahtarlı
const ALT = {
  USA: ['Amerika', 'ABD', 'A.B.D.', 'Birleşik Devletler', 'Amerika Birleşik Devletleri', 'USA', 'US', 'United States', 'America', 'Amerika Birlesik Devletleri', 'abede', 'a b d'],
  GBR: ['Birleşik Krallık', 'İngiltere', 'Britanya', 'Büyük Britanya', 'UK', 'England', 'Britain', 'Great Britain', 'United Kingdom'],
  NLD: ['Hollanda', 'Holland', 'Netherlands', 'Felemenk'], KOR: ['Güney Kore', 'Kore', 'South Korea', 'Korea'], PRK: ['Kuzey Kore', 'North Korea'],
  CIV: ['Fildişi Sahili', 'Fildisi', 'Ivory Coast', "Côte d'Ivoire"], DEU: ['Almanya', 'Germany'], RUS: ['Rusya', 'Rusya Federasyonu', 'Russia'],
  CHN: ['Çin', 'Çin Halk Cumhuriyeti', 'China'], JPN: ['Japonya', 'Japan'], EGY: ['Mısır', 'Egypt'], IND: ['Hindistan', 'India'], ZAF: ['Güney Afrika', 'Güney Afrika Cumhuriyeti', 'South Africa'],
  CZE: ['Çekya', 'Çek Cumhuriyeti', 'Czechia', 'Czech Republic'], ARE: ['Birleşik Arap Emirlikleri', 'BAE', 'Emirlikler', 'UAE', 'Emirates'], SAU: ['Suudi Arabistan', 'Saudi Arabia', 'Suudi'],
  COD: ['Kongo Demokratik Cumhuriyeti', 'Demokratik Kongo', 'DR Congo', 'Congo Kinshasa'], COG: ['Kongo', 'Congo', 'Kongo Cumhuriyeti'], CAF: ['Orta Afrika Cumhuriyeti', 'Central African Republic'],
  BIH: ['Bosna Hersek', 'Bosna', 'Bosnia'], MKD: ['Kuzey Makedonya', 'Makedonya', 'North Macedonia', 'Macedonia'], TUR: ['Türkiye', 'Turkey', 'Türkiye Cumhuriyeti'],
  CYN: ['Kuzey Kıbrıs', 'KKTC', 'Kuzey Kıbrıs Türk Cumhuriyeti', 'Northern Cyprus'], CYP: ['Kıbrıs', 'Güney Kıbrıs', 'Cyprus'], GRC: ['Yunanistan', 'Greece'],
  IRN: ['İran', 'Iran'], IRQ: ['Irak', 'Iraq'], SYR: ['Suriye', 'Syria'], ISR: ['İsrail', 'Israel'], PSX: ['Filistin', 'Palestine'], JOR: ['Ürdün', 'Jordan'], LBN: ['Lübnan', 'Lebanon'],
  AZE: ['Azerbaycan', 'Azerbaijan'], GEO: ['Gürcistan', 'Georgia'], ARM: ['Ermenistan', 'Armenia'], UKR: ['Ukrayna', 'Ukraine'], BLR: ['Belarus', 'Beyaz Rusya'], KAZ: ['Kazakistan', 'Kazakhstan'],
  UZB: ['Özbekistan', 'Uzbekistan'], TKM: ['Türkmenistan', 'Turkmenistan'], KGZ: ['Kırgızistan', 'Kyrgyzstan'], TJK: ['Tacikistan', 'Tajikistan'], AFG: ['Afganistan', 'Afghanistan'], PAK: ['Pakistan'],
  MNG: ['Moğolistan', 'Mongolia'], NZL: ['Yeni Zelanda', 'New Zealand'], AUS: ['Avustralya', 'Australia'], BRA: ['Brezilya', 'Brazil'], ARG: ['Arjantin', 'Argentina'], MEX: ['Meksika', 'Mexico'],
  CAN: ['Kanada', 'Canada'], NOR: ['Norveç', 'Norway'], SWE: ['İsveç', 'Sweden'], FIN: ['Finlandiya', 'Finland'], DNK: ['Danimarka', 'Denmark'], ISL: ['İzlanda', 'Iceland'], IRL: ['İrlanda', 'Ireland'],
  ESP: ['İspanya', 'Spain'], PRT: ['Portekiz', 'Portugal'], FRA: ['Fransa', 'France'], ITA: ['İtalya', 'Italy'], CHE: ['İsviçre', 'Switzerland'], AUT: ['Avusturya', 'Austria'], BEL: ['Belçika', 'Belgium'],
  POL: ['Polonya', 'Poland'], HUN: ['Macaristan', 'Hungary'], ROU: ['Romanya', 'Romania'], BGR: ['Bulgaristan', 'Bulgaria'], SRB: ['Sırbistan', 'Serbia'], HRV: ['Hırvatistan', 'Croatia'], ALB: ['Arnavutluk', 'Albania'],
  KEN: ['Kenya'], NGA: ['Nijerya', 'Nigeria'], ETH: ['Etiyopya', 'Ethiopia'], MAR: ['Fas', 'Morocco'], DZA: ['Cezayir', 'Algeria'], TUN: ['Tunus', 'Tunisia'], LBY: ['Libya'], SDN: ['Sudan'], SOM: ['Somali', 'Somalia'],
  GRL: ['Grönland', 'Greenland'], IDN: ['Endonezya', 'Indonesia'], MYS: ['Malezya', 'Malaysia'], THA: ['Tayland', 'Thailand'], VNM: ['Vietnam'], PHL: ['Filipinler', 'Philippines'], BGD: ['Bangladeş', 'Bangladesh'],
  CHL: ['Şili', 'Chile'], PER: ['Peru'], COL: ['Kolombiya', 'Colombia'], VEN: ['Venezuela'], CUB: ['Küba', 'Cuba'], ATA: ['Antarktika', 'Antarktida', 'Antarctica'],
};
// başkentlerin yaygın Türkçe adları
const CAP_TR = { London: 'Londra', Moscow: 'Moskova', Athens: 'Atina', Vienna: 'Viyana', Cairo: 'Kahire', Beijing: 'Pekin', Tehran: 'Tahran', Baghdad: 'Bağdat', Damascus: 'Şam', Jerusalem: 'Kudüs', Algiers: 'Cezayir', Lisbon: 'Lizbon', Warsaw: 'Varşova', Prague: 'Prag', Copenhagen: 'Kopenhag', Brussels: 'Brüksel', 'The Hague': 'Lahey', Rome: 'Roma', Bucharest: 'Bükreş', Belgrade: 'Belgrad', Sofia: 'Sofya', Budapest: 'Budapeşte', Tbilisi: 'Tiflis', Yerevan: 'Erivan', Baku: 'Bakü', Nicosia: 'Lefkoşa', 'Washington, D.C.': 'Washington', Washington: 'Washington', Tunis: 'Tunus', Tripoli: 'Trablus', Beirut: 'Beyrut', Amman: 'Amman', Riyadh: 'Riyad', Kabul: 'Kabil', 'Mexico City': 'Meksiko', Bern: 'Bern', Stockholm: 'Stockholm', Helsinki: 'Helsinki', Seoul: 'Seul', Kyiv: 'Kiev', Pretoria: 'Pretoria' };

const caps = new Map();
// asıl başkent ('Admin-0 capital') yedek başkentten ('capital alt') önce; eşitse kalabalık olan
const rank = (p) => (p.featurecla === 'Admin-0 capital' ? 2 : 1);
const PREF = { ZAF: 'Pretoria', NLD: 'Amsterdam', BOL: 'La Paz' }; // birden çok başkent: yürütme merkezi
for (const p of P) if (p.adm0cap === 1 && (!PREF[p.adm0_a3] || PREF[p.adm0_a3] === p.name)) { const k = p.adm0_a3, o = caps.get(k); if (!o || rank(p) > rank(o) || (rank(p) === rank(o) && p.pop_max > o.pop_max)) caps.set(k, p); }
const countries = [];
for (const c of C) {
  const a3 = c.ADM0_A3, cap = caps.get(a3);
  const tr = ALT[a3]?.[0] ?? (c.NAME_TR || c.NAME), en = c.NAME_EN || c.NAME;
  const names = [...new Set([tr, en, c.NAME, c.NAME_LONG, c.BRK_NAME, c.NAME_SORT, ...(c.NAME_ALT ? String(c.NAME_ALT).split('|') : []), ...(ALT[a3] ?? [])].filter(Boolean))];
  countries.push({ a3, cc: c.ISO_A2_EH && c.ISO_A2_EH !== '-99' ? c.ISO_A2_EH : c.ISO_A2, tr, en, names, lat: r2(c.LABEL_Y), lon: r2(c.LABEL_X), pop: c.POP_EST, cap: cap ? { name: cap.name.replace(/\s+/g, ' '), tr: CAP_TR[cap.name.replace(/\s+/g, ' ')] ?? cap.name.replace(/\s+/g, ' '), lat: r2(cap.latitude), lon: r2(cap.longitude) } : null });
}
// Kıtalar, bölgeler, denizler (coğrafi merkezler; ses için yeterli doğrulukta). poss: Türkçede iyelik ekli ad ("Kuzey Kutbu'na").
const regions = [
  ['Avrupa', 'Europe', 50, 15], ['Asya', 'Asia', 45, 90], ['Afrika', 'Africa', 5, 20], ['Kuzey Amerika', 'North America', 45, -100], ['Güney Amerika', 'South America', -15, -60],
  ['Orta Amerika', 'Central America', 14, -87], ['Okyanusya', 'Oceania', -22, 140], ['Ortadoğu', 'Middle East', 29, 45, ['Orta Doğu']], ['Uzak Doğu', 'Far East', 35, 125],
  ['Sahra', 'Sahara', 23, 12, ['Sahra Çölü', 'Sahara Desert', 'Büyük Sahra']], ['Amazon', 'Amazon', -3.5, -62, ['Amazonlar', 'Amazon Ormanı', 'Amazon Ormanları', 'Amazon rainforest', 'Amazonia']],
  ['Sibirya', 'Siberia', 62, 100], ['Himalayalar', 'Himalayas', 28.5, 85, ['Himalaya', 'Everest']], ['Alpler', 'Alps', 46.5, 10, ['Alp Dağları']], ['And Dağları', 'Andes', -15, -71, ['Andlar']],
  ['Gobi Çölü', 'Gobi Desert', 43, 105, ['Gobi']], ['Kongo Havzası', 'Congo Basin', -1.5, 22], ['Karayipler', 'Caribbean', 15, -75, ['Karayip Denizi', 'Caribbean Sea']],
  ['Kuzey Kutbu', 'North Pole', 88, 0, ['Arktik', 'Arctic', 'Kutup'], true], ['Güney Kutbu', 'South Pole', -88, 0, [], true],
  ['Akdeniz', 'Mediterranean Sea', 35, 18, ['Mediterranean']], ['Karadeniz', 'Black Sea', 43.3, 34], ['Ege Denizi', 'Aegean Sea', 38.5, 25, ['Ege']], ['Marmara Denizi', 'Sea of Marmara', 40.7, 28.2, ['Marmara']],
  ['Kızıldeniz', 'Red Sea', 20, 38.5], ['Hazar Denizi', 'Caspian Sea', 41.5, 50.5, ['Hazar']], ['Baltık Denizi', 'Baltic Sea', 58, 20, ['Baltık']], ['Kuzey Denizi', 'North Sea', 56, 3],
  ['Basra Körfezi', 'Persian Gulf', 27, 51.5, ['Körfez']], ['Meksika Körfezi', 'Gulf of Mexico', 25, -90], ['Bengal Körfezi', 'Bay of Bengal', 15, 88],
  ['Atlas Okyanusu', 'Atlantic Ocean', 25, -40, ['Atlantik', 'Atlantik Okyanusu', 'Atlantic']], ['Kuzey Atlantik', 'North Atlantic', 55, -30], ['Güney Atlantik', 'South Atlantic', -30, -15],
  ['Pasifik Okyanusu', 'Pacific Ocean', 0, -160, ['Pasifik', 'Büyük Okyanus', 'Pacific']], ['Hint Okyanusu', 'Indian Ocean', -20, 80, ['Indian']],
  ['Arktik Okyanusu', 'Arctic Ocean', 82, 0, ['Kuzey Buz Denizi']], ['Güney Okyanusu', 'Southern Ocean', -60, 90, ['Antarktik Okyanusu']],
].map(([tr, en, lat, lon, alt = [], poss = false]) => ({ tr, en, lat, lon, names: [tr, en, ...alt], poss }));
// şehirlerin yaygın Türkçe adları → GeoNames (İngilizce) adı
const cityAliases = {
  Roma: 'Rome', Londra: 'London', Moskova: 'Moscow', Atina: 'Athens', Viyana: 'Vienna', Kahire: 'Cairo', Pekin: 'Beijing', Tahran: 'Tehran', 'Bağdat': 'Baghdad', 'Şam': 'Damascus', 'Kudüs': 'Jerusalem',
  Lizbon: 'Lisbon', 'Varşova': 'Warsaw', Prag: 'Prague', Kopenhag: 'Copenhagen', 'Brüksel': 'Brussels', Lahey: 'The Hague', 'Münih': 'Munich', Napoli: 'Naples', Venedik: 'Venice', 'Lefkoşa': 'Nicosia', Tiflis: 'Tbilisi',
  Erivan: 'Yerevan', 'Bakü': 'Baku', 'Selanik': 'Thessaloniki', Cenevre: 'Geneva', Floransa: 'Florence', Belgrad: 'Belgrade', 'Budapeşte': 'Budapest', Sofya: 'Sofia', 'Bükreş': 'Bucharest', Beyrut: 'Beirut',
  Trablus: 'Tripoli', Riyad: 'Riyadh', Kabil: 'Kabul', Meksiko: 'Mexico City', 'Yeni Delhi': 'New Delhi', 'New York': 'New York City', Kiev: 'Kyiv', Minsk: 'Minsk', Kuveyt: 'Kuwait City',
  Mekke: 'Mecca', Medine: 'Medina', Halep: 'Aleppo', Musul: 'Mosul', 'İskenderiye': 'Alexandria', Tebriz: 'Tabriz', Saraybosna: 'Sarajevo', 'Üsküp': 'Skopje', 'Priştine': 'Pristina',
  Lahor: 'Lahore', 'Karaçi': 'Karachi', Bombay: 'Mumbai', Kalküta: 'Kolkata', 'Sankt Petersburg': 'Saint Petersburg', Seul: 'Seoul', Tokyo: 'Tokyo', 'İstanbul': 'Istanbul', 'İzmir': 'Izmir', 'İskenderun': 'Iskenderun', 'İzmit': 'Izmit', 'İnegöl': 'Inegol', Washington: 'Washington',
};
fs.writeFileSync('public/data/places.json', JSON.stringify({ source: 'Natural Earth 1:50m admin-0 ülkeleri + başkentler (kamu malı, naturalearthdata.com); alternatif adlar ve bölge merkezleri elle', countries, regions, cityAliases }));
console.log('ülke', countries.length, '· başkentli', countries.filter((c) => c.cap).length, '· bölge', regions.length, '· şehir eş adı', Object.keys(cityAliases).length, '→', Math.round(fs.statSync('public/data/places.json').size / 1024), 'KB');
