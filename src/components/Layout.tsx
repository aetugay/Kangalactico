// Yeni ekran düzeni: üst çubuk (sade) · ortada büyük Dünya · sağda tek sekmeli panel · altta müzik çalar çubuğu.
// Landmark'lar: header (banner), main, aside (complementary), footer (contentinfo = alt çalar + NASA ibaresi).
import { useRef, type ReactNode } from 'react';
import { tr, type Lang } from '../i18n.ts';
import type { SoundMode } from '../lib/radar.ts';
import { Dialog, type Pill } from './Shell.tsx';
import { IconInfo, IconMic, IconPause, IconPlay } from './icons.tsx';

const T = (lang: Lang, t: string, e: string) => (lang === 'en' ? e : t);

// ---------------- Üst çubuk
export function AppHeader(p: { lang: Lang; listening: boolean; micSupported: boolean; onTalk: () => void; onHoldStart: () => void; onHoldEnd: () => void; guide: boolean; onGuide: () => void; search: ReactNode; onWeather: () => void; onSettings: () => void; onAbout: () => void; onHelp: () => void }) {
  const { lang } = p;
  // Konuş: fare/dokunmayla BASILI TUT = dinle, bırak = işle. Klavyeyle (Enter/Boşluk) normal düğme: bir kez dinler.
  const held = useRef(false);
  return (
    <header className="hdr">
      <div className="hdr-brand" aria-label="EarthEar">Earth<span>Ear</span></div>
      <button type="button" className={`speak-btn${p.listening ? ' live' : ''}`} aria-pressed={p.listening} aria-keyshortcuts="Space" title={T(lang, 'Konuşmak için basılı tut (ya da Boşluk tuşunu basılı tut)', 'Hold to speak (or hold the Space key)')}
        onPointerDown={(e) => { if (e.button !== 0 || !p.micSupported) return; held.current = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* yok say */ } p.onHoldStart(); }}
        onPointerUp={() => { if (held.current) p.onHoldEnd(); }} onPointerCancel={() => { if (held.current) { held.current = false; p.onHoldEnd(); } }}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => { if (held.current) { held.current = false; return; } p.onTalk(); }}>
        <IconMic /> <span>{p.listening ? T(lang, 'Dinliyorum…', 'Listening…') : !p.micSupported ? T(lang, 'Konuş / yaz', 'Speak / type') : T(lang, 'Konuş', 'Speak')}</span>
      </button>
      <button type="button" className={`chip guide-btn${p.guide ? ' on' : ''}`} onClick={p.onGuide} aria-pressed={p.guide} aria-label={T(lang, 'Sesli rehber', 'Voice guide')} aria-keyshortcuts="G" title={T(lang, 'Sesli rehber (G)', 'Voice guide (G)')}>
        <span aria-hidden="true">{p.guide ? '🔊' : '🔈'}</span> <span>{T(lang, 'Sesli Rehber', 'Voice guide')}: <b>{p.guide ? T(lang, 'Açık', 'On') : T(lang, 'Kapalı', 'Off')}</b></span>
      </button>
      <div className="hdr-search">{p.search}</div>
      <nav className="hdr-actions" aria-label={T(lang, 'Genel', 'General')}>
        <button type="button" className="chip" onClick={p.onWeather} aria-keyshortcuts="W" title={T(lang, 'Hava durumu (W)', 'Weather (W)')}><span aria-hidden="true">⛅</span> <span className="lbl-hide-s">{T(lang, 'Hava durumu', 'Weather')}</span></button>
        <button type="button" className="icon-btn" onClick={p.onHelp} aria-label={T(lang, 'Yardım ve kısayollar', 'Help and shortcuts')} aria-keyshortcuts="?" title={T(lang, 'Yardım (?)', 'Help (?)')}>?</button>
        <button type="button" className="icon-btn" onClick={p.onSettings} aria-label={T(lang, 'Ayarlar', 'Settings')} title={T(lang, 'Ayarlar', 'Settings')}><span aria-hidden="true">⚙</span></button>
        <button type="button" className="icon-btn" onClick={p.onAbout} aria-label={tr(lang, 'about')} title={tr(lang, 'about')}><IconInfo /></button>
      </nav>
    </header>
  );
}

// ---------------- Ayarlar
export function SettingsDialog(p: {
  open: boolean; onClose: () => void; lang: Lang; setLang: (l: Lang) => void; hc: boolean; setHc: (v: boolean) => void;
  view3d: boolean; can3d: boolean; setView3d: (v: boolean) => void; guide: boolean; setGuide: (v: boolean) => void;
  handsFree: boolean; setHandsFree: (v: boolean) => void; micSupported: boolean; shortcuts: boolean; setShortcuts: (v: boolean) => void;
  music: number; setMusic: (v: number) => void; onSoundscape: () => void;
  rate: number; setRate: (v: number) => void;
  home: string | null; onHomeChange: () => void; onHomeDelete: () => void;
}) {
  const { lang } = p;
  const sw = (checked: boolean, set: (v: boolean) => void, label: string) => <label className="switch set-row"><input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} /> <span>{label}</span></label>;
  return (
    <Dialog open={p.open} onClose={p.onClose} title={T(lang, 'Ayarlar', 'Settings')} lang={lang}>
      <fieldset className="fs"><legend>{T(lang, 'Dil', 'Language')}</legend>
        <div className="seg">{(['tr', 'en'] as Lang[]).map((l) => <label key={l} className={l === lang ? 'on' : ''}><input type="radio" name="set-lang" checked={l === lang} onChange={() => p.setLang(l)} />{l === 'tr' ? 'Türkçe' : 'English'}</label>)}</div>
      </fieldset>
      {sw(p.hc, p.setHc, tr(lang, 'highContrast'))}
      {p.can3d && sw(p.view3d, p.setView3d, T(lang, '3B Dünya (kapalıysa 2B harita)', '3D globe (off = 2D map)'))}
      {sw(p.guide, p.setGuide, T(lang, 'Sesli rehber (G) — ekran okuyucu kullanıyorsan kapat', 'Voice guide (G) — turn off if you use a screen reader'))}
      {p.micSupported && sw(p.handsFree, p.setHandsFree, T(lang, 'Eller serbest dinleme ("Dünya, …")', 'Hands-free listening ("Earth, …")'))}
      {sw(!p.shortcuts, (v) => p.setShortcuts(!v), T(lang, 'Tek tuş kısayollarını kapat (Boşluk ile bas-konuş çalışmaya devam eder)', 'Turn off single-key shortcuts (hold-Space to talk keeps working)'))}
      <div className="mix-row">
        <label htmlFor="set-music">{T(lang, 'Müzik seviyesi', 'Music level')}: <b>{Math.round(p.music * 100)}%</b></label>
        <input id="set-music" type="range" min={0} max={3} step={0.05} value={p.music} aria-valuetext={`${Math.round(p.music * 100)}%`} onChange={(e) => p.setMusic(+e.target.value)} />
      </div>
      <div className="mix-row">
        <label htmlFor="set-rate">{T(lang, 'Konuşma hızı', 'Speech rate')}: <b>{p.rate.toFixed(1)}×</b></label>
        <input id="set-rate" type="range" min={0.8} max={2} step={0.1} value={p.rate} aria-valuetext={`${p.rate.toFixed(1)}×`} onChange={(e) => p.setRate(+e.target.value)} />
      </div>
      <div className="set-row home-row" role="group" aria-labelledby="set-home-l">
        <span id="set-home-l">{T(lang, 'Ev konumu', 'Home location')}: <b>{p.home ?? T(lang, 'kayıtlı değil', 'not saved')}</b></span>
        <button type="button" className="btn sm" onClick={p.onHomeChange}>{p.home ? T(lang, 'Değiştir', 'Change') : T(lang, 'Ev seç', 'Choose home')}</button>
        {p.home && <button type="button" className="btn sm" onClick={p.onHomeDelete}>{T(lang, 'Sil', 'Delete')}</button>}
      </div>
      <p className="small muted">{T(lang, 'Ev konumu yalnız bu tarayıcıda saklanır, hiçbir yere gönderilmez.', 'Your home is stored only in this browser and sent nowhere.')}</p>
      <button type="button" className="btn" onClick={p.onSoundscape} aria-keyshortcuts="V">{T(lang, 'Ses sahnem: genel ses, yankı, konuşma hızı… (V)', 'My soundscape: master, reverb, speech rate… (V)')}</button>
    </Dialog>
  );
}

// ---------------- Yardım (kısayollar artık ekranda değil, burada ve düğme ipuçlarında)
export function HelpDialog({ open, onClose, lang, onSpeak }: { open: boolean; onClose: () => void; lang: Lang; onSpeak: () => void }) {
  const rows: [string, string, string][] = [
    ['Boşluk / Space', 'Basılı tut: konuş (bırakınca komut işlenir)', 'Hold: speak (release to run the command)'], ['P', 'Çal / durdur', 'Play / stop'],
    ['← →', 'Işını elle çevir', 'Turn the beam by hand'], ['I J K M', 'Kuzey / batı / güney / doğuya git', 'Go north / west / south / east'],
    ['C', 'Yer seç', 'Choose a place'], ['B', 'İkinci yer (karşılaştır)', 'Second place (compare)'], ['1–4', 'Katman aç/kapa', 'Toggle layers'],
    ['S', 'Sesli özet', 'Spoken summary'], ['L', 'Sesli lejant', 'Audio legend'], ['W', 'Hava durumu', 'Weather'], ['Y', 'Dünya hikâyeleri', 'Earth stories'],
    ['E', 'Dünya olayları', 'Earth events'], ['V', 'Ses sahnem', 'My soundscape'], ['N', 'Anlatıcı', 'Narrator'],
    ['H / ?', 'Bu yardım', 'This help'], ['G', 'Sesli rehber aç / kapa (üst çubukta da düğme)', 'Voice guide on / off (also a button in the top bar)'], ['Esc', 'Konuşmayı sustur / pencereyi kapat', 'Silence speech / close window'],
    [T(lang, 'Herhangi bir tuş', 'Any key'), 'Rehber konuşurken: konuşmayı keser (Boşluk hariç) · turu bitirir', 'While the guide speaks: interrupts speech (except Space) · ends the tour'],
  ];
  const voice: [string, string][] = lang === 'en' ? [
    ['Earth, start the tour', '30-second guided tour (any key, "stop" or "skip" ends it)'],
    ['Earth, speak faster / speak slower', 'Speech rate (also in Settings, 0.8–2×)'],
    ['Earth, repeat', 'Repeat the last narration'], ['Earth, quiet', 'Stop speech only; nature and music keep playing'],
    ['Earth, this is my home / save my home', 'Save the current place as home (only in this browser)'],
    ['Earth, go home', 'Go to your home'], ['Earth, weather at home', 'Weather at your home'],
    ['Earth, what is the weather in Sivas?', 'Weather sound first, then the narration'],
  ] : [
    ['Dünya, turu başlat', '30 saniyelik rehberli tur (herhangi bir tuş, "dur" ya da "geç" bitirir)'],
    ['Dünya, daha hızlı konuş / daha yavaş konuş', "Konuşma hızı (Ayarlar'da da var, 0.8–2×)"],
    ['Dünya, tekrar et', 'Son anlatımı tekrarla'], ['Dünya, sus', 'Yalnız konuşmayı durdurur; doğa ve müzik sürer'],
    ['Dünya, burası benim evim / evimi kaydet', 'Bulunduğun yeri ev olarak kaydet (yalnız bu tarayıcıda)'],
    ['Dünya, eve dön', 'Evine git'], ['Dünya, evde hava nasıl?', 'Evindeki hava durumu'],
    ["Dünya, Sivas'ta hava nasıl?", 'Önce havanın sesi, sonra anlatım'],
  ];
  return (
    <Dialog open={open} onClose={onClose} title={T(lang, 'Yardım ve kısayollar', 'Help and shortcuts')} lang={lang}>
      <p className="small">{T(lang, 'Eller serbest dinleme açıkken cümleye "Dünya" diye başla: "Dünya, Sivas\'a git", "Dünya, çal", "Dünya, Sivas\'ta hava nasıl?". Konuşmak için Boşluk tuşunu basılı tut. Yazılı komut kutusu Rehber sekmesinde.', 'With hands-free listening on, start with "Earth": "Earth, go to Sivas", "Earth, play", "Earth, what is the weather in Sivas?". The typed command box is in the Guide tab.')}</p>
      <table className="inv"><thead><tr><th>{T(lang, 'Tuş', 'Key')}</th><th>{T(lang, 'İşlev', 'Action')}</th></tr></thead>
        <tbody>{rows.map(([k, t, e]) => <tr key={k}><td><kbd>{k}</kbd></td><td>{lang === 'en' ? e : t}</td></tr>)}</tbody></table>
      <h3 className="sec-title">{T(lang, 'Sesli komutlar', 'Voice commands')}</h3>
      <table className="inv"><thead><tr><th>{T(lang, 'Söyle', 'Say')}</th><th>{T(lang, 'İşlev', 'Action')}</th></tr></thead>
        <tbody>{voice.map(([k, d]) => <tr key={k}><td>"{k}"</td><td>{d}</td></tr>)}</tbody></table>
      <div className="btn-row"><button type="button" className="btn" onClick={onSpeak}>{T(lang, 'Yardımı sesli oku', 'Read help aloud')}</button></div>
    </Dialog>
  );
}

// ---------------- Sağ panel: 4 sekme (WAI-ARIA tabs; ←/→ ile sekme değişir)
export type TabId = 'listen' | 'weather' | 'explore' | 'guide';
export function SidePanel({ lang, tab, setTab, open, setOpen, tabs }: { lang: Lang; tab: TabId; setTab: (t: TabId) => void; open: boolean; setOpen: (v: boolean) => void; tabs: Record<TabId, ReactNode> }) {
  const ids: TabId[] = ['listen', 'weather', 'explore', 'guide'];
  const names: Record<TabId, [string, string, string]> = { listen: ['Dinle', 'Listen', '🎧'], weather: ['Hava', 'Weather', '⛅'], explore: ['Keşfet', 'Explore', '🧭'], guide: ['Rehber', 'Guide', '💬'] };
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'Home' ? -i : e.key === 'End' ? ids.length - 1 - i : 0;
    if (!d) return; e.preventDefault(); e.stopPropagation(); const n = ids[(i + d + ids.length) % ids.length]; setTab(n); refs.current[n]?.focus();
  };
  return (
    <aside className={`side${open ? ' open' : ''}`} aria-label={T(lang, 'Panel', 'Panel')}>
      <div className="side-head">
        <div role="tablist" aria-label={T(lang, 'Panel sekmeleri', 'Panel tabs')} className="tabs">
          {ids.map((id, i) => (
            <button key={id} ref={(el) => { refs.current[id] = el; }} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} tabIndex={tab === id ? 0 : -1}
              className={`tab${tab === id ? ' on' : ''}`} onClick={() => { setTab(id); setOpen(true); }} onKeyDown={(e) => onKey(e, i)}>
              <span aria-hidden="true">{names[id][2]}</span> {lang === 'en' ? names[id][1] : names[id][0]}
            </button>
          ))}
        </div>
        <button type="button" className="icon-btn side-toggle" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? T(lang, 'Paneli kapat', 'Close panel') : T(lang, 'Paneli aç', 'Open panel')} title={open ? T(lang, 'Paneli kapat', 'Close panel') : T(lang, 'Paneli aç', 'Open panel')}>{open ? '›' : '‹'}</button>
      </div>
      {open && ids.map((id) => (
        <div key={id} role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} hidden={tab !== id} className="side-body">{tab === id && tabs[id]}</div>
      ))}
    </aside>
  );
}

// ---------------- Ses dünyası kartları (ad + ses türü; "i" ile bilgi)
export function LayerCards({ lang, pills, onToggle, onShow, info }: { lang: Lang; pills: Pill[]; onToggle: (id: string) => void; onShow: (id: string) => void; info: (id: string) => ReactNode }) {
  return (
    <ul className="lcards">
      {pills.map((p) => (
        <li key={p.id} className={`lcard${p.on ? ' on' : ''}${p.visual ? ' visual' : ''}`} style={{ '--c': p.color } as React.CSSProperties}>
          <button type="button" className="lcard-main" aria-pressed={p.on} onClick={() => onToggle(p.id)} aria-label={`${p.label}, ${p.instrument}${p.loading ? (lang === 'en' ? ', loading' : ', yükleniyor') : ''}`}>
            <span className="pill-ico" aria-hidden="true">{p.icon}</span>
            <span className="lcard-txt"><b>{p.label}</b><small>{p.loading ? '…' : p.instrument}</small></span>
            <span className="lcard-state" aria-hidden="true">{p.on ? '●' : '○'}</span>
          </button>
          <details className="lcard-info">
            <summary aria-label={T(lang, `Bilgi: ${p.label}`, `About: ${p.label}`)} title={T(lang, 'Bilgi', 'About')}>i</summary>
            <div className="small">{info(p.id)}{p.on && !p.visual && <button type="button" className="mini" onClick={() => onShow(p.id)}>{T(lang, 'Küre üstünde göster', 'Show on globe')}</button>}</div>
          </details>
        </li>
      ))}
    </ul>
  );
}

// ---------------- Alt müzik çalar çubuğu (jukebox)
export function PlayerBar(p: {
  lang: Lang; place: string | null; value: string | null; summary: string; nowLine: string; liveLine: string; playing: boolean; canPlay: boolean;
  onToggle: () => void; onPrev: (() => void) | null; onNext: (() => void) | null; timeLabel: string | null; timePos: { i: number; n: number; set: (i: number) => void } | null;
  onLegend: () => void; onSummary: () => void; talking: 'summary' | 'legend' | null;
  soundMode: SoundMode; setSoundMode: (m: SoundMode) => void; volume: number; setVolume: (v: number) => void; onPanel?: () => void;
  onChangePlace: () => void;
}) {
  const { lang } = p;
  return (
    <footer className="player">
      <div className="pl-left">
        <p className="pl-place">{p.place ?? T(lang, 'Yer seçilmedi', 'No place chosen')}{p.value && <span className="pl-val"> · {p.value}</span>} <button type="button" className="mini pl-change" onClick={p.onChangePlace} aria-keyshortcuts="C">{T(lang, 'Yeri değiştir', 'Change place')}</button></p>
        <p className="pl-sum">{p.summary}</p>
        {p.playing && p.nowLine && <p className="pl-now" aria-hidden="true">{p.nowLine}</p>}
        <p className="sr" aria-live="polite" aria-atomic="true">{p.playing ? p.liveLine : ''}</p>
      </div>
      <div className="pl-mid">
        <div className="pl-btns">
          <button type="button" className="icon-btn" onClick={p.onPrev ?? undefined} disabled={!p.onPrev} aria-label={T(lang, 'Önceki zaman', 'Previous time')} title={T(lang, 'Önceki zaman', 'Previous time')}>⏮</button>
          <button type="button" className="play-btn" onClick={p.onToggle} disabled={!p.canPlay} aria-keyshortcuts="P" title={T(lang, 'Çal / durdur (P)', 'Play / stop (P)')}>{p.playing ? <IconPause /> : <IconPlay />}<span>{p.playing ? tr(lang, 'stop') : tr(lang, 'play')}</span></button>
          <button type="button" className="icon-btn" onClick={p.onNext ?? undefined} disabled={!p.onNext} aria-label={T(lang, 'Sonraki zaman', 'Next time')} title={T(lang, 'Sonraki zaman', 'Next time')}>⏭</button>
          <button type="button" className="chip small-chip" onClick={p.onLegend} aria-pressed={p.talking === 'legend'} aria-keyshortcuts="L" title={T(lang, 'Sesli lejant (L)', 'Audio legend (L)')}>{tr(lang, 'legend')}</button>
          <button type="button" className="chip small-chip" onClick={p.onSummary} aria-pressed={p.talking === 'summary'} aria-keyshortcuts="S" title={T(lang, 'Sesli özet (S)', 'Spoken summary (S)')}>{tr(lang, 'summary')}</button>
        </div>
        {p.timePos && (
          <div className="pl-time">
            <input type="range" min={0} max={p.timePos.n - 1} value={p.timePos.i} onChange={(e) => p.timePos!.set(+e.target.value)} aria-label={T(lang, 'Zaman', 'Time')} aria-valuetext={p.timeLabel ?? ''} />
            <small>{p.timeLabel}</small>
          </div>
        )}
      </div>
      <div className="pl-right">
        <div className="seg seg-s" role="radiogroup" aria-label={T(lang, 'Ses modu', 'Sound mode')}>
          {(['nature', 'both', 'music'] as SoundMode[]).map((m) => (
            <label key={m} className={m === p.soundMode ? 'on' : ''}><input type="radio" name="soundmode" checked={m === p.soundMode} onChange={() => p.setSoundMode(m)} />{m === 'nature' ? T(lang, 'Doğa', 'Nature') : m === 'both' ? T(lang, 'Doğa+Müzik', 'Nature+Music') : T(lang, 'Müzik', 'Music')}</label>
          ))}
        </div>
        <label className="pl-vol"><span className="sr">{T(lang, 'Ses seviyesi', 'Volume')}</span><span aria-hidden="true">🔊</span><input type="range" min={0} max={1} step={0.05} value={p.volume} aria-valuetext={`${Math.round(p.volume * 100)}%`} onChange={(e) => p.setVolume(+e.target.value)} /></label>
        {p.onPanel && <button type="button" className="chip small-chip pl-panel" onClick={p.onPanel}>{T(lang, 'Panel', 'Panel')}</button>}
      </div>
      <p className="pl-disc">{tr(lang, 'disclaimer')}</p>
    </footer>
  );
}
