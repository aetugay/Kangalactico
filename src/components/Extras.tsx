// Ek özellik panelleri: iki yeri karşılaştırma, Dünya hikâyeleri, Dünya olayları (NASA EONET), kişisel ses sahnesi.
// Hepsi gerçek düğme/kaydırıcı/seçim kutusu: klavye ve ekran okuyucuyla kullanılır.
import type { Lang } from '../i18n.ts';
import { Dialog } from './Shell.tsx';

const T = (lang: Lang, tr: string, en: string) => (lang === 'en' ? en : tr);

// ---------------- Keşfet düğmeleri + karşılaştırma (Şu an kartının altında)
export interface ExploreProps {
  lang: Lang;
  placeA: string; placeB: string | null;
  compare: boolean; setCompare: (v: boolean) => void;
  onPickB: () => void; onClearB: () => void; onDiff: () => void;
  onStories: () => void; onEvents: () => void; onSound: () => void;
  narrator: boolean; setNarrator: (v: boolean) => void; showNarrator?: boolean;
  story: string | null; onStopStory: () => void;
  onTour: () => void;
}
export function Explore(p: ExploreProps) {
  const { lang } = p;
  return (
    <div className="explore">
      <h3 className="eyebrow">{T(lang, 'Keşfet', 'Explore')}</h3>
      {p.story && (
        <p className="story-now" role="status">
          <b>{p.story}</b>
          <button type="button" className="mini" onClick={p.onStopStory}>{T(lang, 'Hikâyeyi durdur (Esc)', 'Stop story (Esc)')}</button>
        </p>
      )}
      <button type="button" className="btn primary tour-btn" onClick={p.onTour}>{T(lang, '🎧 Rehberli tur (30 sn)', '🎧 Guided tour (30 s)')}</button>
      <div className="btn-row">
        <button type="button" className="btn" onClick={p.onStories} aria-keyshortcuts="Y">{T(lang, 'Dünya hikâyeleri (Y)', 'Earth stories (Y)')}</button>
        <button type="button" className="btn" onClick={p.onEvents} aria-keyshortcuts="E">{T(lang, 'Dünya olayları (E)', 'Earth events (E)')}</button>
        <button type="button" className="btn" onClick={p.onSound} aria-keyshortcuts="V">{T(lang, 'Ses sahnem (V)', 'My soundscape (V)')}</button>
      </div>
      {p.showNarrator !== false && <label className="switch"><input type="checkbox" checked={p.narrator} onChange={(e) => p.setNarrator(e.target.checked)} /> <span>{T(lang, 'Anlatıcı: her turda kısa bir bilgi söyle (N)', 'Narrator: say a short fact every turn (N)')}</span></label>}

      <fieldset className="fs compare">
        <legend>{T(lang, 'İki yeri karşılaştır', 'Compare two places')}</legend>
        {!p.placeB ? (
          <button type="button" className="btn" onClick={p.onPickB} aria-keyshortcuts="B">{T(lang, 'İkinci yeri seç (B)', 'Choose second place (B)')}</button>
        ) : (
          <>
            <p className="small"><b>A:</b> {p.placeA}<br /><b>B:</b> {p.placeB}</p>
            <label className="switch"><input type="checkbox" checked={p.compare} onChange={(e) => p.setCompare(e.target.checked)} /> <span>{T(lang, 'Sırayla dinle: bir tur A, bir tur B', 'Listen in turns: one sweep A, one sweep B')}</span></label>
            <div className="btn-row">
              <button type="button" className="btn" onClick={p.onDiff}>{T(lang, 'Farkı söyle', 'Say the difference')}</button>
              <button type="button" className="btn" onClick={p.onPickB}>{T(lang, 'B\'yi değiştir', 'Change B')}</button>
              <button type="button" className="btn" onClick={p.onClearB}>{T(lang, 'Kaldır', 'Remove')}</button>
            </div>
          </>
        )}
      </fieldset>
    </div>
  );
}

// ---------------- Dünya hikâyeleri
export interface StoryInfo { id: string; title: string; text: string; needs?: string }
export function StoriesDialog({ open, onClose, lang, stories, onRun, hasPlace }: { open: boolean; onClose: () => void; lang: Lang; stories: StoryInfo[]; onRun: (id: string) => void; hasPlace: boolean }) {
  return (
    <Dialog open={open} onClose={onClose} title={T(lang, 'Dünya hikâyeleri', 'Earth stories')} lang={lang}>
      <p className="small muted">{T(lang, 'Her hikâye seçtiğin yerden başlar; anlatıcı veriyi söyler, orkestra çalar. Esc durdurur.', 'Every story starts from the place you chose; the narrator tells the data while the orchestra plays. Escape stops.')}</p>
      {!hasPlace && <p role="status" className="small">{T(lang, 'Önce bir yer seç (C).', 'Choose a place first (C).')}</p>}
      <ul className="story-list">
        {stories.map((s) => (
          <li key={s.id}>
            <button type="button" className="story-btn" disabled={!hasPlace} onClick={() => onRun(s.id)}>
              <b>{s.title}</b>
              <span>{s.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

// ---------------- Dünya olayları (NASA EONET)
export interface EarthEvent { id: string; title: string; category: string; lat: number; lon: number; date: string; km: number; dir: string }
export function EventsDialog({ open, onClose, lang, events, status, onGo }: { open: boolean; onClose: () => void; lang: Lang; events: EarthEvent[]; status: 'idle' | 'loading' | 'ok' | 'error'; onGo: (e: EarthEvent) => void }) {
  return (
    <Dialog open={open} onClose={onClose} title={T(lang, 'Dünya olayları', 'Earth events')} lang={lang}>
      <p className="small muted">{T(lang, 'Son 30 günün açık doğa olaylarından (orman yangını, fırtına, yanardağ…) seçtiğin yere en yakın olanlar. Kaynak: NASA EONET.', 'The open natural events of the last 30 days (wildfires, storms, volcanoes…) nearest to your place. Source: NASA EONET.')}</p>
      <div role="status">
        {status === 'loading' && <p>{T(lang, 'Olaylar yükleniyor…', 'Loading events…')}</p>}
        {status === 'error' && <p>{T(lang, 'Olaylar alınamadı (internet bağlantısı gerekli).', 'Could not load events (internet connection needed).')}</p>}
        {status === 'ok' && events.length === 0 && <p>{T(lang, 'Şu anda açık olay yok.', 'No open events right now.')}</p>}
      </div>
      <ul className="event-list">
        {events.map((e) => (
          <li key={e.id}>
            <div><b>{e.category}</b> — {e.title}<br /><small>{e.dir}, {Math.round(e.km / 10) * 10} km · {e.date}</small></div>
            <button type="button" className="btn" onClick={() => onGo(e)} aria-label={T(lang, `${e.title} olayına git ve çevresini dinle`, `Go to ${e.title} and listen around it`)}>{T(lang, 'Git ve dinle', 'Go and listen')}</button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

// ---------------- Kişisel ses sahnesi
export interface Mix { master: number; reverb: number; rate: number; music: number; vol: Record<string, number>; inst: Record<string, string> }
export const DEFAULT_MIX: Mix = { master: 0.8, reverb: 0.3, rate: 1, music: 1.1, vol: { co2: 1, temp: 1, sst: 1, aerosol: 1 }, inst: { co2: 'co2', temp: 'temp', sst: 'sst' } };
export const INSTRUMENTS: { id: string; tr: string; en: string }[] = [
  { id: 'co2', tr: 'keman', en: 'violin' }, { id: 'temp', tr: 'gitar', en: 'guitar' }, { id: 'sst', tr: 'arp', en: 'harp' },
  { id: 'black_carbon', tr: 'çello', en: 'cello' }, { id: 'dust', tr: 'çelesta', en: 'celesta' }, { id: 'sea_salt', tr: 'flüt', en: 'flute' }, { id: 'sulfate', tr: 'marimba', en: 'marimba' },
];
export const instrumentName = (id: string, lang: Lang) => { const i = INSTRUMENTS.find((x) => x.id === id); return i ? i[lang] : id; };

export function SoundDialog({ open, onClose, lang, mix, setMix, layerNames, onTest }: { open: boolean; onClose: () => void; lang: Lang; mix: Mix; setMix: (m: Mix) => void; layerNames: Record<string, string>; onTest: (layer: string) => void }) {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const slider = (id: string, label: string, value: number, min: number, max: number, onChange: (v: number) => void, text = pct(value)) => (
    <div className="mix-row">
      <label htmlFor={id}>{label}: <b>{text}</b></label>
      <input id={id} type="range" min={min} max={max} step={0.05} value={value} aria-valuetext={text} onChange={(e) => onChange(+e.target.value)} />
    </div>
  );
  return (
    <Dialog open={open} onClose={onClose} title={T(lang, 'Ses sahnem', 'My soundscape')} lang={lang}>
      <p className="small muted">{T(lang, 'Orkestrayı kendine göre kur: her katmanın sesini ve enstrümanını seç. Ayarların bu cihazda saklanır.', 'Arrange the orchestra your way: set each layer\'s volume and instrument. Your settings are saved on this device.')}</p>
      {slider('mix-master', T(lang, 'Genel ses', 'Master volume'), mix.master, 0, 1, (v) => setMix({ ...mix, master: v }))}
      {slider('mix-music', T(lang, 'Müzik seviyesi (doğa seslerinin altında)', 'Music level (under the nature sounds)'), mix.music, 0, 3, (v) => setMix({ ...mix, music: v }))}
      {slider('mix-reverb', T(lang, 'Salon yankısı', 'Hall reverb'), mix.reverb, 0, 0.8, (v) => setMix({ ...mix, reverb: v }))}
      {slider('mix-rate', T(lang, 'Konuşma hızı', 'Speech rate'), mix.rate, 0.8, 2, (v) => setMix({ ...mix, rate: v }), `${mix.rate.toFixed(2)}×`)}
      {(['co2', 'temp', 'sst', 'aerosol'] as const).map((id) => (
        <fieldset key={id} className="fs mix-layer">
          <legend>{layerNames[id]}</legend>
          {slider(`mix-${id}`, T(lang, 'Ses düzeyi', 'Volume'), mix.vol[id] ?? 1, 0, 1.5, (v) => setMix({ ...mix, vol: { ...mix.vol, [id]: v } }))}
          {id !== 'aerosol' && (
            <div className="mix-row">
              <label htmlFor={`inst-${id}`}>{T(lang, 'Enstrüman', 'Instrument')}</label>
              <select id={`inst-${id}`} value={mix.inst[id] ?? id} onChange={(e) => setMix({ ...mix, inst: { ...mix.inst, [id]: e.target.value } })}>
                {INSTRUMENTS.map((i) => <option key={i.id} value={i.id}>{i[lang]}</option>)}
              </select>
            </div>
          )}
          <button type="button" className="mini" onClick={() => onTest(id)}>{T(lang, 'Dinle', 'Listen')}</button>
        </fieldset>
      ))}
      <button type="button" className="btn" onClick={() => setMix(DEFAULT_MIX)}>{T(lang, 'Varsayılana dön', 'Reset to defaults')}</button>
    </Dialog>
  );
}
