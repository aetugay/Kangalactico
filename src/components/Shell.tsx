// Yüzer cam paneller ve diyaloglar. Tüm işlev DOM'da (klavye + ekran okuyucu); 3D küre yalnızca görsel.
import { useEffect, useId, useRef } from 'react';
import { tr, type Lang } from '../i18n.ts';
import { formatKm } from '../lib/geo.ts';
import type { Mode, Scale } from '../lib/radar.ts';
import { IconContrast, IconGlobe, IconHeadphones, IconInfo, IconMic, IconPause, IconPin, IconPlay, IconSpeak } from './icons.tsx';

// ---------------- Diyalog (modal): Esc kapatır, odak içeride döner, kapanınca açana döner
// Not: efekt YALNIZ open'a bağlı. onClose her render'da yeni bir fonksiyon olabilir; efekte bağlansaydı her tuşta (ör. arama
// sonucu duyurusu App'i yeniden çizince) odak açana dönüp ✕ düğmesine kayardı ve yazılan harf genel kısayola düşerdi.
export function Dialog({ open, onClose, title, children, className = '', lang }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; className?: string; lang: Lang }) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    // açılınca odak: önce yazı alanı (arama kutusu), yoksa ilk denetim — kapat (✕) düğmesi en son seçenek
    const t = setTimeout(() => {
      const b = box.current; if (!b || b.contains(document.activeElement)) return;
      const first = b.querySelector<HTMLElement>('[data-autofocus], input:not([type=hidden]):not([disabled]), textarea, select')
        ?? b.querySelector<HTMLElement>('.dialog-body button:not([disabled]), .dialog-body [href]') ?? b.querySelector<HTMLElement>('button');
      first?.focus();
    }, 40);
    // arka plan sayfası diyalog açıkken kaymasın
    const root = document.documentElement; root.classList.add('modal-open');
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== 'Tab' || !box.current) return;
      const f = [...box.current.querySelectorAll<HTMLElement>('input:not([disabled]),button:not([disabled]),[href],select,[tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    };
    document.addEventListener('keydown', key);
    return () => {
      clearTimeout(t); document.removeEventListener('keydown', key);
      root.classList.remove('modal-open');
      // odak açana döner; açan artık yoksa (ör. açılış ekranı kalktı) Çal düğmesine, o da yoksa sayfa başlığına
      const back = opener.current as HTMLElement | null;
      setTimeout(() => { if (back?.isConnected) back.focus(); else { const t = document.querySelector<HTMLElement>('.now .btn.primary') ?? document.querySelector<HTMLElement>('.cta'); if (t) t.focus(); else { const h = document.querySelector<HTMLElement>('h1, h2'); if (h) { h.tabIndex = -1; h.focus(); } } } }, 0);
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} className={`glass dialog ${className}`}>
        <div className="dialog-head">
          <h2 id={`${id}-t`}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={tr(lang, 'close')}>✕</button>
        </div>
        <div className="dialog-body">{children}</div>
      </div>
    </div>
  );
}

// ---------------- Üst çubuk
export function TopBar(p: { lang: Lang; setLang: (l: Lang) => void; hc: boolean; setHc: (v: boolean) => void; view3d: boolean; can3d: boolean; setView3d: (v: boolean) => void; onPick: () => void; onAbout: () => void; hasPlace: boolean; guide: boolean; setGuide: (v: boolean) => void; listening: boolean; onTalk: () => void }) {
  const { lang } = p;
  return (
    <header className="topbar">
      <div className="brand" aria-label="EarthEar">Earth<span>Ear</span></div>
      <nav className="top-actions" aria-label={lang === 'tr' ? 'Genel ayarlar' : 'General settings'}>
        {p.hasPlace && <button type="button" className="chip" onClick={p.onPick}><IconPin /> {tr(lang, 'change')}</button>}
        <button type="button" className={`chip mic${p.listening ? ' live' : ''}`} aria-pressed={p.listening} aria-keyshortcuts="T" onClick={p.onTalk}><IconMic /> {p.listening ? tr(lang, 'listening') : tr(lang, 'talk')}</button>
        <button type="button" className="chip" aria-pressed={p.guide} aria-keyshortcuts="G" onClick={() => p.setGuide(!p.guide)}><IconSpeak /> {tr(lang, 'guide')}</button>
        <button type="button" className="chip" aria-pressed={p.hc} onClick={() => p.setHc(!p.hc)}><IconContrast /> {tr(lang, 'highContrast')}</button>
        {p.can3d && <button type="button" className="chip" aria-pressed={p.view3d} onClick={() => p.setView3d(!p.view3d)}><IconGlobe /> {p.view3d ? tr(lang, 'view3d') : tr(lang, 'view2d')}</button>}
        <button type="button" className="chip" onClick={() => p.setLang(lang === 'tr' ? 'en' : 'tr')} aria-label={lang === 'tr' ? 'Switch to English' : 'Türkçeye geç'} lang={lang === 'tr' ? 'en' : 'tr'}>{lang === 'tr' ? 'EN' : 'TR'}</button>
        <button type="button" className="chip" onClick={p.onAbout}><IconInfo /> {tr(lang, 'about')}</button>
      </nav>
    </header>
  );
}

// ---------------- Açılış
export function Intro({ lang, onPick, onTalk }: { lang: Lang; onPick: () => void; onTalk?: () => void }) {
  return (
    <section className="intro" aria-labelledby="intro-h">
      <h1 id="intro-h">EarthEar</h1>
      <p className="tagline">{tr(lang, 'tagline')}</p>
      <p className="intro-sub">{tr(lang, 'intro')}</p>
      <button type="button" className="cta" onClick={onPick} autoFocus aria-keyshortcuts="C"><IconPin /> {tr(lang, 'pick')}</button>
      {onTalk && <button type="button" className="btn talk-cta" onClick={onTalk} aria-keyshortcuts="T"><IconMic /> {tr(lang, 'talkLong')}</button>}
      <p className="intro-hint">{tr(lang, 'orTap')}</p>
    </section>
  );
}

// ---------------- Şu an çalıyor kartı + denetimler
export interface NowProps {
  lang: Lang; placeLabel: string; playing: boolean; onToggle: () => void; onLegend: () => void; onSummary: () => void; talking: 'summary' | 'legend' | null;
  headline: { label: string; center: string; maxDir: string | null; maxVal: string; when: string } | null;
  instruments: { id: string; label: string; instrument: string; color: string }[];
  rangeKm: number; setRange: (km: number) => void; revSec: number; setRevSec: (s: number) => void; mode: Mode; setMode: (m: Mode) => void;
  /** Adım 2: ölçek anahtarı (yerel varsayılan) ve katman başına ölçek açıklaması. */
  scale: Scale; setScale: (s: Scale) => void; scaleInfo?: string[];
  legend: string | null;
  /** Canlı gösterge: şu an çalan notaların verisi (her adımda) ve ekran okuyucu satırı (seyreltilmiş). */
  nowLines?: string[];
  liveLine?: string;
  children?: React.ReactNode;
}
const RANGES = [500, 2000, 5000];
export function NowCard(p: NowProps) {
  const { lang } = p;
  return (
    <section className="glass panel now" aria-labelledby="now-h">
      <p className="eyebrow">{tr(lang, 'nowPlaying')}</p>
      <h2 id="now-h" className="place">{p.placeLabel}</h2>
      {p.headline && (
        <div className="readout" aria-hidden="true">
          <span className="big">{p.headline.center}</span>
          <span className="small">{tr(lang, 'center')} · {p.headline.label}</span>
          {p.headline.maxDir && <span className="small">{tr(lang, 'highest')}: <b>{p.headline.maxDir}</b> ({p.headline.maxVal})</span>}
          <span className="small muted">{p.headline.when}</span>
        </div>
      )}
      {p.playing && p.nowLines && p.nowLines.length > 0 && (
        <div className="nowline" aria-hidden="true">
          <span className="eyebrow">{lang === 'en' ? 'Sounding now (data → note)' : 'Şu an çalan (veri → nota)'}</span>
          {p.nowLines.map((l, i) => <span key={i} className="nowline-item">{l}</span>)}
        </div>
      )}
      <p className="sr" aria-live="polite" aria-atomic="true">{p.playing ? p.liveLine : ''}</p>
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={p.onToggle} aria-keyshortcuts="Space">{p.playing ? <IconPause /> : <IconPlay />} {p.playing ? tr(lang, 'stop') : tr(lang, 'play')}</button>
        <button type="button" className="btn" onClick={p.onLegend} aria-pressed={p.talking === 'legend'} aria-keyshortcuts="L">{p.talking === 'legend' ? <IconPause /> : <IconHeadphones />} {p.talking === 'legend' ? tr(lang, 'stopLegend') : `${tr(lang, 'legend')} (L)`}</button>
        <button type="button" className="btn" onClick={p.onSummary} aria-pressed={p.talking === 'summary'} aria-keyshortcuts="S">{p.talking === 'summary' ? <IconPause /> : <IconSpeak />} {p.talking === 'summary' ? tr(lang, 'stopSummary') : `${tr(lang, 'summary')} (S)`}</button>
      </div>
      {p.legend && <p className="legend-caption" aria-hidden="true">{p.legend}</p>}
      {p.instruments.length > 0 && (
        <div className="inst" aria-hidden="true">
          <span className="small muted">{tr(lang, 'instruments')}:</span>
          {p.instruments.map((i) => <span key={i.id} className="inst-chip" style={{ '--c': i.color } as React.CSSProperties}>{i.label} · {i.instrument}</span>)}
        </div>
      )}
      <fieldset className="fs">
        <legend>{tr(lang, 'range')}</legend>
        <div className="seg">
          {RANGES.map((km) => (
            <label key={km} className={km === p.rangeKm ? 'on' : ''}>
              <input type="radio" name="range" value={km} checked={km === p.rangeKm} onChange={() => p.setRange(km)} />{formatKm(km)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="row2">
        <label className="lbl-inline">{tr(lang, 'speed')}
          <select value={p.revSec} onChange={(e) => p.setRevSec(+e.target.value)}>
            <option value={12}>12 s</option><option value={8}>8 s</option><option value={5}>5 s</option>
          </select>
        </label>
        <label className="switch"><input type="checkbox" checked={p.mode === 'hikaye'} onChange={(e) => p.setMode(e.target.checked ? 'hikaye' : 'bilim')} /> <span>{tr(lang, 'story')}</span></label>
      </div>
      <fieldset className="fs">
        <legend>{lang === 'en' ? 'Note scale' : 'Nota ölçeği'}</legend>
        <div className="seg">
          {(['local', 'global'] as Scale[]).map((s) => (
            <label key={s} className={s === p.scale ? 'on' : ''}>
              <input type="radio" name="scale" value={s} checked={s === p.scale} onChange={() => p.setScale(s)} />
              {s === 'local' ? (lang === 'en' ? 'Local (this area)' : 'Yerel (bu alan)') : (lang === 'en' ? 'Global (fixed)' : 'Küresel (sabit)')}
            </label>
          ))}
        </div>
        {p.scaleInfo && p.scaleInfo.length > 0 && <p className="small muted scale-info">{p.scaleInfo.join(' · ')}</p>}
      </fieldset>
      {p.children}
      <p className="keys">{tr(lang, 'keys')}</p>
    </section>
  );
}

// ---------------- Katman hapları
export interface Pill { id: string; label: string; instrument: string; icon: React.ReactNode; color: string; on: boolean; visual: boolean; loading?: boolean; note?: string }
export function LayerPills({ lang, pills, onToggle, onShow, children }: { lang: Lang; pills: Pill[]; onToggle: (id: string) => void; onShow: (id: string) => void; children?: React.ReactNode }) {
  return (
    <section className="glass panel layers" aria-labelledby="layers-h">
      <h2 id="layers-h" className="eyebrow">{tr(lang, 'layers')}</h2>
      <ul className="pills">
        {pills.map((p) => (
          <li key={p.id}>
            <button type="button" className={`pill${p.on ? ' on' : ''}${p.visual ? ' visual' : ''}`} style={{ '--c': p.color } as React.CSSProperties}
              aria-pressed={p.on} onClick={() => onToggle(p.id)}
              aria-label={`${p.label}, ${p.instrument}${p.note ? ', ' + p.note : ''}${p.loading ? ', yükleniyor' : ''}`}>
              <span className="pill-ico">{p.icon}</span>
              <span className="pill-txt"><b>{p.label}</b><small>{p.loading ? '…' : p.instrument}</small></span>
            </button>
            {p.on && !p.visual && <button type="button" className="mini" onClick={() => onShow(p.id)}>{lang === 'tr' ? 'Küre üstünde göster' : 'Show on globe'}</button>}
          </li>
        ))}
      </ul>
      {children}
    </section>
  );
}

// ---------------- Zaman çizelgesi (CO₂ ayları)
const MONTHS = { tr: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };
const MONTHS_LONG = { tr: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'], en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] };
export function Timeline({ lang, month, setMonth, label, advance, setAdvance }: { lang: Lang; month: number; setMonth: (m: number) => void; label: string; advance: boolean; setAdvance: (v: boolean) => void }) {
  return (
    <section className="glass timeline" aria-labelledby="tl-h">
      <div className="tl-head">
        <h2 id="tl-h" className="eyebrow">{tr(lang, 'timeline')}: <b>{label}</b></h2>
        <label className="lbl-inline">{lang === 'tr' ? 'Ay seç' : 'Pick month'}
          <select value={month} onChange={(e) => setMonth(+e.target.value)}>{MONTHS_LONG[lang].map((m, i) => <option key={m} value={i}>{m} 2021</option>)}</select>
        </label>
        <label className="switch small"><input type="checkbox" checked={advance} onChange={(e) => setAdvance(e.target.checked)} /> <span>{tr(lang, 'advance')}</span></label>
      </div>
      <input type="range" min={0} max={11} step={1} value={month} aria-labelledby="tl-h" aria-valuetext={label} onChange={(e) => setMonth(+e.target.value)} className="tl-range" />
      <div className="tl-ticks" aria-hidden="true">{MONTHS[lang].map((m, i) => <span key={m} className={i === month ? 'on' : ''}>{m}</span>)}</div>
    </section>
  );
}

// ---------------- Hakkında / Kaynaklar
export function About({ open, onClose, lang, credits }: { open: boolean; onClose: () => void; lang: Lang; credits: { title: string; text: string; href?: string }[] }) {
  return (
    <Dialog open={open} onClose={onClose} title={tr(lang, 'about')} className="drawer" lang={lang}>
      <p>{lang === 'tr'
        ? 'EarthEar, Kangalactico ekibinin NASA Space Apps Challenge 2026 (The Earth Information Jukebox) projesidir. Seçtiğin yerin çevresinde dönen bir radar, veriyi küçük bir orkestraya çevirir: yön → stereo konum, katman → enstrüman, değer → nota (yüksek değer ince nota). Işını elle çevirince (←/→) yakın, orta ve uzak değerler üç nota olarak çalar.'
        : 'EarthEar is the Kangalactico team\'s project for the NASA Space Apps Challenge 2026 (The Earth Information Jukebox). A radar sweeping around the place you choose turns data into a small orchestra: direction → stereo position, layer → instrument, value → note (higher value, higher note). Turning the beam by hand (←/→) plays the near, middle and far values as three notes.'}</p>
      <h3>{lang === 'tr' ? 'Kaynaklar' : 'Sources'}</h3>
      <ul className="credits">
        {credits.map((c) => <li key={c.title}><b>{c.title}:</b> {c.text}{c.href && <> — <a href={c.href} target="_blank" rel="noreferrer">{c.href.replace('https://', '')}</a></>}</li>)}
      </ul>
      <p className="disclaimer"><b>{tr(lang, 'disclaimer')}</b></p>
    </Dialog>
  );
}
