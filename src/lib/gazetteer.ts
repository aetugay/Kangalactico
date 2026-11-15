// Yer çözümleyici (saf; DOM yok — Node testleri de kullanır: scripts/test-places.mjs).
// Ülkeler + bölgeler (public/data/places.json, Natural Earth) + şehirler (cities.json, GeoNames).
// Türkçe ekleri ayırır (Kanada'ya / kanadaya / Kanadayı / Türkiye'de / Bağdat'a / bağdada / Kuzey Kutbu'na),
// harf/aksan farkını yok sayar (fold), konuşma tanıma hataları için bulanık aday önerir (1–2 harf).
import { fold, type CityRow } from './places.ts';

export interface PlacesFile {
  countries: { a3: string; cc: string; tr: string; en: string; names: string[]; lat: number; lon: number; pop: number; cap: { name: string; tr: string; lat: number; lon: number } | null }[];
  regions: { tr: string; en: string; lat: number; lon: number; names: string[]; poss: boolean }[];
  cityAliases: Record<string, string>;
}
export interface Hit {
  kind: 'country' | 'region' | 'city';
  tr: string; en: string;          // görünen ad
  lat: number; lon: number;        // gidilecek nokta (ülkede başkent; yoksa coğrafi merkez)
  capital?: { tr: string; en: string } | null;
  cc?: string; pop: number;
}
export interface Resolved { query: string; tokens: string[]; hit: Hit | null; cands: Hit[]; intent: boolean; whole: boolean }

const WAKE = new Set(['dunya', 'earth', 'earthear', 'ortir', 'ort']);
const STOP = new Set([
  // Türkçe fiiller / dolgu
  'git', 'gidelim', 'gidin', 'gider', 'gitsene', 'gidiyoruz', 'gitmek', 'istiyorum', 'misin', 'musun', 'mi', 'mu', 'gotur', 'goturur', 'goturun', 'goster', 'gosterir', 'gostersene', 'ac', 'acar', 'acsana', 'sec', 'bul', 'getir',
  'ucalim', 'uc', 'yolculuk', 'gezelim', 'lutfen', 'bana', 'beni', 'bizi', 'hadi', 'haydi', 'simdi', 'su', 'yere', 'yer', 'yeri', 'oraya', 'haritada', 'harita', 'sehir', 'sehri', 'sehrine', 'ulke', 'ulkesi', 'ulkesine',
  'ile', 've', 'icin', 'dinle', 'dinlemek', 'dinleyelim', 'karsilastir', 'kiyasla', 'hava', 'durumu', 'nasil', 'burada', 'bugun', 'yarin', 'haftalik',
  // İngilizce
  'go', 'to', 'take', 'me', 'us', 'show', 'fly', 'open', 'find', 'navigate', 'please', 'the', 'choose', 'select', 'place', 'city', 'country', 'compare', 'with', 'listen', 'i', 'want', 'let', 'lets', 'and', 'weather', 'in', 'what', 'whats', 'is', 'like', 'forecast', 'now',
]);
const INTENT = ['git', 'gidelim', 'gidin', 'gotur', 'goturur', 'goster', 'gosterir', 'ac', 'sec', 'bul', 'ucalim', 'go', 'take', 'show', 'fly', 'open', 'find', 'navigate'];
// Türkçe hâl ekleri (fold edilmiş; uzun olan önce). Kesmesiz yazımda ("kanadaya", "sivasa") denenir.
const SUFFIXES = ['ndan', 'nden', 'nin', 'nun', 'dan', 'den', 'tan', 'ten', 'nda', 'nde', 'yla', 'yle', 'ya', 'ye', 'yi', 'yu', 'da', 'de', 'ta', 'te', 'in', 'un', 'na', 'ne', 'ni', 'nu', 'la', 'le', 'a', 'e', 'i', 'u'];
const SOFT: Record<string, string> = { d: 't', b: 'p', g: 'k', c: 'c' }; // ünsüz yumuşaması: bağdada → bagdad → bagdat

/** Metni temizle: noktalama, uyandırma kelimesi, fiiller. Kesme işaretli ekler ayrılır. */
export function tokenize(text: string): { tokens: string[]; cut: boolean[]; intent: boolean } {
  const raw = text.replace(/[.,!?;:"“”()]/g, ' ').replace(/[’‘`´]/g, "'").split(/\s+/).filter(Boolean);
  const tokens: string[] = [], cut: boolean[] = []; let intent = false;
  for (const w of raw) {
    const i = w.indexOf("'"), stem = fold(i > 0 ? w.slice(0, i) : w).replace(/[^a-z0-9.\- ]/g, '').replace(/\.$/, '');
    if (!stem) continue;
    if (INTENT.includes(stem)) intent = true;
    if (STOP.has(stem) || (tokens.length === 0 && WAKE.has(stem))) continue;
    tokens.push(stem); cut.push(i > 0);
  }
  return { tokens, cut, intent };
}
/** Kesmesiz eklerin olası kökleri (sözcüğün kendisi önce). */
export function stems(w: string): string[] {
  const out = [w];
  for (const s of SUFFIXES) if (w.length - s.length >= 3 && w.endsWith(s)) {
    const st = w.slice(0, -s.length); out.push(st);
    const last = st[st.length - 1]; if (SOFT[last] && SOFT[last] !== last) out.push(st.slice(0, -1) + SOFT[last]);
  }
  return [...new Set(out)];
}
/** Damerau-Levenshtein (sınırlı). */
export function dist(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

export class Gazetteer {
  private idx = new Map<string, Hit>();      // ülke + bölge adları (fold)
  private city = new Map<string, Hit>();     // şehir adları (fold) → en kalabalık
  private fuzzyPool: [string, Hit][] = [];
  constructor(pf: PlacesFile, cities: CityRow[] = [], asciiNames: Record<string, string> = {}) {
    const trOfCity: Record<string, string> = {};
    for (const [tr, en] of Object.entries(pf.cityAliases)) if (!trOfCity[en]) trOfCity[en] = tr[0].toLocaleUpperCase('tr') + tr.slice(1);
    const put = (m: Map<string, Hit>, k: string, h: Hit) => { const f = fold(k).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim(); if (f.length >= 2 && (!m.has(f) || m.get(f)!.pop < h.pop)) m.set(f, h); };
    for (const r of pf.regions) { const h: Hit = { kind: 'region', tr: r.tr, en: r.en, lat: r.lat, lon: r.lon, pop: 1e12 }; for (const n of r.names) put(this.idx, n, h); }
    for (const c of pf.countries) {
      const h: Hit = { kind: 'country', tr: c.tr, en: c.en, lat: c.cap?.lat ?? c.lat, lon: c.cap?.lon ?? c.lon, capital: c.cap ? { tr: c.cap.tr, en: c.cap.name } : null, cc: c.cc, pop: c.pop };
      for (const n of c.names) put(this.idx, n, h);
    }
    for (const row of cities) {
      const h: Hit = { kind: 'city', tr: trOfCity[row[0]] ?? row[0], en: row[0], lat: row[2], lon: row[3], cc: row[1], pop: row[4] };
      put(this.city, row[0], h); const a = asciiNames[`${row[0]}|${row[1]}`]; if (a) put(this.city, a, h);
    }
    for (const [tr, en] of Object.entries(pf.cityAliases)) { const h = this.city.get(fold(en)); if (h) this.city.set(fold(tr), h); }
    this.fuzzyPool = [...this.idx.entries(), ...[...this.city.entries()].filter(([, h]) => h.pop >= 100_000)];
  }
  /** Tam eşleşme: önce ülke/bölge, sonra şehir. */
  private exact(s: string): Hit | null { return this.idx.get(s) ?? this.city.get(s) ?? null; }
  /** Bir metindeki yeri bul. En uzun ad önce ("Güney Afrika" > "Afrika"); son sözcüğün ekleri denenir. */
  resolve(text: string): Resolved {
    const { tokens, cut, intent } = tokenize(text);
    const query = tokens.join(' ');
    const res: Resolved = { query, tokens, hit: null, cands: [], intent, whole: false };
    if (!tokens.length) return res;
    for (let len = Math.min(4, tokens.length); len >= 1; len--) {
      for (let s = 0; s + len <= tokens.length; s++) {
        const head = tokens.slice(s, s + len - 1), last = tokens[s + len - 1];
        const variants = cut[s + len - 1] ? [last] : stems(last);
        for (const v of variants) {
          if (v.length < 2 || (len === 1 && v.length < 3 && !this.idx.has(v))) continue;
          const h = this.exact([...head, v].join(' '));
          if (h) {
            // küçük bir şehir, 1 harf farkla bir ülke/bölgeye benziyorsa (konuşma tanıma "Kanada" → "Kanda") doğrudan gitme: ikisini de sor
            if (h.kind === 'city' && h.pop < 200_000 && len === 1 && v.length >= 4) {
              const near = [...this.idx.entries()].find(([k]) => k !== v && dist(v, k, 1) <= 1);
              if (near) { res.cands = [near[1], h]; return res; }
            }
            res.hit = h; res.whole = len === tokens.length; return res;
          }
        }
      }
    }
    // bulanık: en yakın adaylar (önce ülke/bölge, sonra nüfus)
    const qs = cut[tokens.length - 1] ? [query] : stems(tokens[tokens.length - 1]).map((v) => [...tokens.slice(0, -1), v].join(' '));
    const scored = new Map<Hit, number>();
    for (const [k, h] of this.fuzzyPool) {
      for (const q of qs) {
        if (q.length < 3) continue;
        const max = q.length <= 4 ? 1 : 2, d = dist(q, k, max);
        if (d <= max && (!scored.has(h) || scored.get(h)! > d)) scored.set(h, d);
      }
    }
    res.cands = [...scored.entries()].sort((a, b) => a[1] - b[1] || (a[0].kind === 'city' ? 1 : 0) - (b[0].kind === 'city' ? 1 : 0) || b[0].pop - a[0].pop).map(([h]) => h)
      .filter((h, i, A) => A.findIndex((x) => x.tr === h.tr) === i).slice(0, 2);
    return res;
  }
  /** Aday seçimi cevabı: "birincisi", "ikincisi", "evet", adın kendisi. */
  choose(text: string, cands: Hit[]): Hit | null | 'no' {
    const f = ` ${fold(text).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()} `;
    if (/ (hayir|iptal|vazgec|hicbiri|no|cancel|neither|none) /.test(f)) return 'no';
    if (/ (ikinci|ikincisi|iki|2|second|the second) /.test(f)) return cands[1] ?? null;
    for (const c of cands) if (f.includes(` ${fold(c.tr)} `) || f.includes(` ${fold(c.en)} `) || stems(f.trim().split(' ').pop() ?? '').includes(fold(c.tr))) return c;
    if (/ (birinci|birincisi|ilki|ilk|bir|1|evet|olur|tamam|first|yes|the first) /.test(f)) return cands[0] ?? null;
    return null;
  }
}

// ---------- Türkçe çekim (söylenen cümle için)
const lastVowel = (s: string) => { const m = s.match(/[aeıioöuüAEIİOÖUÜ](?=[^aeıioöuüAEIİOÖUÜ]*$)/); return m ? m[0].toLocaleLowerCase('tr') : 'a'; };
const back = (v: string) => 'aıou'.includes(v);
/** Yönelme hâli: Kanada'ya, Çin'e, Mısır'a, ABD'ye, Kuzey Kutbu'na, Pasifik Okyanusu'na, Amerika Birleşik Devletleri'ne. */
export function dative(name: string): string {
  const words = name.trim().split(/\s+/), w = words[words.length - 1];
  if (/^[A-ZÇĞİÖŞÜ.]{2,5}$/.test(w)) { const l = w.replace(/\./g, '').slice(-1); return `${name}'${'AIOU'.includes(l) ? 'ya' : l === 'K' ? 'ya' : 'ye'}`; }
  const v = lastVowel(w), a = back(v) ? 'a' : 'e', endsV = /[aeıioöuü]$/i.test(w);
  if (words.length > 1 && /[ıiuü]$/i.test(w)) return `${name}'n${a}`; // iyelik ekli bileşik ad
  return `${name}'${endsV ? 'y' : ''}${a}`;
}
/** Soru eki: Kanada mı, Kandahar mı, Tokyo mu, Berlin mi. */
export function soru(name: string): string { const v = lastVowel(name); return `${name} ${v === 'a' || v === 'ı' ? 'mı' : v === 'e' || v === 'i' ? 'mi' : v === 'o' || v === 'u' ? 'mu' : 'mü'}`; }
/** Gidiş cümlesi: "Kanada'ya gidiyorum, merkez: Ottawa." */
export function goLine(h: Hit, lang: 'tr' | 'en'): string {
  if (lang === 'en') return h.kind === 'country' ? `Going to ${h.en}${h.capital ? `, center: ${h.capital.en}` : ' (geographic center)'}.` : `Going to ${h.en}.`;
  return h.kind === 'country' ? `${dative(h.tr)} gidiyorum${h.capital ? `, merkez: ${h.capital.tr}` : ' (coğrafi merkez)'}.` : `${dative(h.tr)} gidiyorum.`;
}
export const hitName = (h: Hit, lang: 'tr' | 'en') => (lang === 'en' ? h.en : h.tr) + (h.kind === 'country' && h.capital ? ` (${lang === 'en' ? h.capital.en : h.capital.tr})` : '');
