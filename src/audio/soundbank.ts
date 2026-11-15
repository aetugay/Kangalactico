// Ses dünyası örnekleri (public/sounds/*.mp3; scripts/sounds.mjs üretir). İlgili katman / hava durumu ilk açıldığında yüklenir.
// Yüklenmemiş ya da hiç olmayan ses için motor SENTEZE düşer (eksikler: sehir_trafik, sehir_kalabalik, agustos_bocegi).
import type { World } from '../lib/worlds.ts';

/** Dünya → kullandığı dosyalar. */
export const WORLD_SOUNDS: Record<World, string[]> = {
  dust: ['toz_hafif', 'toz_siddetli'], smoke: ['ates_kucuk', 'ates_buyuk'], spray: ['deniz_serpinti'], volcano: ['volkan'],
  thunder: ['gok_yakin_1', 'gok_yakin_2', 'gok_yakin_3', 'gok_uzak_1', 'gok_uzak_2'], city: [],
  forest: ['orman_kus', 'yaprak_hisirti', 'ruzgar_hafif'], heat: ['kis_ruzgari', 'ruzgar_hafif', 'buz_catirti_1', 'buz_catirti_2'],
  ocean: ['dalga_sakin', 'dalga_sert', 'buz_catirti_1', 'buz_catirti_2', 'okyanus_sax_1', 'okyanus_sax_2', 'okyanus_sax_3', 'okyanus_sax_4', 'okyanus_sax_5'],
  current: ['dalga_sakin', 'dalga_sert'],
};
/** Okyanus müzik katmanı: saksafon cümleleri (scripts/sounds-sax.mjs; perde = cümlenin ortanca perdesi, sounds.json). */
export const SAX_PHRASES: { name: string; pitchHz: number }[] = [{ name: 'okyanus_sax_1', pitchHz: 222 }, { name: 'okyanus_sax_2', pitchHz: 500 }, { name: 'okyanus_sax_3', pitchHz: 333 }, { name: 'okyanus_sax_4', pitchHz: 250 }, { name: 'okyanus_sax_5', pitchHz: 444 }];
export const WEATHER_SOUNDS = ['yagmur_cisenti', 'yagmur_orta', 'yagmur_saganak', 'kar', 'ruzgar_hafif', 'ruzgar_kuvvetli', 'kis_ruzgari', 'gece_circir', 'gok_yakin_1', 'gok_yakin_2', 'gok_yakin_3', 'gok_uzak_1', 'gok_uzak_2'];

/** Çözme için ayrı çevrimdışı bağlam: kullanıcı dokunuşundan önce de yüklenebilir (AudioBuffer her bağlamda çalar). */
let dec: OfflineAudioContext | null = null;
const decoder = () => (dec ??= new OfflineAudioContext(1, 1, 44100));
const buffers = new Map<string, AudioBuffer>();
const bounds = new Map<string, { start: number; end: number }>();
const pending = new Map<string, Promise<void>>();

/** MP3 kodlayıcının baş/son dolgu sessizliğini atlayan döngü sınırları (döngü dosyası zaten yumuşak geçişli). */
function findBounds(b: AudioBuffer) {
  const d = b.getChannelData(0); let s = 0, e = d.length - 1;
  while (s < d.length && Math.abs(d[s]) < 1e-4) s++; while (e > s && Math.abs(d[e]) < 1e-4) e--;
  return { start: s / b.sampleRate, end: (e + 1) / b.sampleRate };
}

export const soundBank = {
  get: (name: string) => buffers.get(name),
  bounds: (name: string) => bounds.get(name) ?? { start: 0, end: buffers.get(name)?.duration ?? 0 },
  has: (...names: string[]) => names.every((n) => buffers.has(n)),
  /** Eksik olanları indir + çöz (hata olursa sessizce sentezde kalır). */
  load(base: string, names: string[], ac: BaseAudioContext = decoder()): Promise<void> {
    return Promise.all(names.filter((n) => !buffers.has(n)).map((n) => {
      let p = pending.get(n);
      if (!p) {
        p = fetch(`${base}sounds/${n}.mp3`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
          .then((ab) => ac.decodeAudioData(ab)).then((b) => { buffers.set(n, b); bounds.set(n, findBounds(b)); })
          .catch((e) => { console.warn('ses yüklenemedi, sentez kullanılacak:', n, e); })
          .finally(() => pending.delete(n));
        pending.set(n, p);
      }
      return p;
    })).then(() => undefined);
  },
};
// geliştirme: tarayıcı konsolundan hangi seslerin yüklendiğini görmek için
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __sounds?: unknown }).__sounds = { loaded: () => [...buffers.keys()] };
