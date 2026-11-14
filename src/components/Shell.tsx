// Yüzer cam paneller ve diyaloglar. Tüm işlev DOM'da (klavye + ekran okuyucu); 3D küre yalnızca görsel.
import { useEffect, useId, useRef } from 'react';
import { tr, type Lang } from '../i18n.ts';
import { formatKm } from '../lib/geo.ts';
import type { Mode } from '../lib/radar.ts';
import { IconContrast, IconGlobe, IconHeadphones, IconInfo, IconPause, IconPin, IconPlay, IconSpeak } from './icons.tsx';

// ---------------- Diyalog (modal): Esc kapatır, odak içeride döner, kapanınca açana döner
export function Dialog({ open, onClose, title, children, className = '', lang }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; className?: string; lang: Lang }) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    const t = setTimeout(() => { if (!box.current?.contains(document.activeElement)) box.current?.querySelector<HTMLElement>('input,button,[href],select')?.focus(); }, 40);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab' || !box.current) return;
      const f = [...box.current.querySelectorAll<HTMLElement>('input:not([disabled]),button:not([disabled]),[href],select,[tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { clearTimeout(t); document.removeEventListener('keydown', key); (opener.current as HTMLElement | null)?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} className={`glass dialog ${className}`}>
        <div className="dialog-head">
          <h2 id={`${id}-t`}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={tr(lang, 'close')}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------------- Üst çubuk
export function TopBar(p: { lang: Lang; setLang: (l: Lang) => void; hc: boolean; setHc: (v: boolean) => void; view3d: boolean; can3d: boolean; setView3d: (v: boolean) => void; onPick: () => void; onAbout: () => void; hasPlace: boolean }) {
  const { lang } = p;
  return (
    <header className="topbar">
      <div className="brand" aria-label="EarthEar">Earth<span>Ear</span></div>
      <nav className="top-actions" aria-label={lang === 'tr' ? 'Genel ayarlar' : 'General settings'}>
        {p.hasPlace && <button type="button" className="chip" onClick={p.onPick}><IconPin /> {tr(lang, 'change')}</button>}
        <button type="button" className="chip" aria-pressed={p.hc} onClick={() => p.setHc(!p.hc)}><IconContrast /> {tr(lang, 'highContrast')}</button>
        {p.can3d && <button type="button" className="chip" aria-pressed={p.view3d} onClick={() => p.setView3d(!p.view3d)}><IconGlobe /> {p.view3d ? tr(lang, 'view3d') : tr(lang, 'view2d')}</button>}
        <button type="button" className="chip" onClick={() => p.setLang(lang === 'tr' ? 'en' : 'tr')} aria-label={lang === 'tr' ? 'Switch to English' : 'Türkçeye geç'} lang={lang === 'tr' ? 'en' : 'tr'}>{lang === 'tr' ? 'EN' : 'TR'}</button>
        <button type="button" className="chip" onClick={p.onAbout}><IconInfo /> {tr(lang, 'about')}</button>
      </nav>
    </header>
  );
}

// ---------------- Açılış
export function Intro({ lang, onPick }: { lang: Lang; onPick: () => void }) {
  return (
    <section className="intro" aria-labelledby="intro-h">
      <h1 id="intro-h">EarthEar</h1>
      <p className="tagline">{tr(lang, 'tagline')}</p>
      <p className="intro-sub">{tr(lang, 'intro')}</p>
      <button type="button" className="cta" onClick={onPick}><IconPin /> {tr(lang, 'pick')}</button>
      <p className="intro-hint">{tr(lang, 'orTap')}</p>
    </section>
  );
}

// ---------------- Şu an çalıyor kartı + denetimler
export interface NowProps {
  lang: Lang; placeLabel: string; playing: boolean; onToggle: () => void; onLegend: () => void; legendBusy: boolean; onSummary: () => void;
  headline: { label: string; center: string; maxDir: string | null; maxVal: string; when: string } | null;
  instruments: { id: string; label: string; instrument: string; color: string }[];
  rangeKm: number; setRange: (km: number) => void; revSec: number; setRevSec: (s: number) => void; mode: Mode; setMode: (m: Mode) => void;
  legend: string | null;
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
      <div className="btn-row">
        <button type="button" className="btn primary" onClick={p.onToggle} aria-keyshortcuts="Space">{p.playing ? <IconPause /> : <IconPlay />} {p.playing ? tr(lang, 'stop') : tr(lang, 'play')}</button>
        <button type="button" className="btn" onClick={p.onLegend} disabled={p.legendBusy}><IconHeadphones /> {tr(lang, 'legend')}</button>
        <button type="button" className="btn" onClick={p.onSummary} aria-keyshortcuts="S"><IconSpeak /> {tr(lang, 'summary')} (S)</button>
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
export function Timeline({ lang, month, setMonth, label, advance, setAdvance }: { lang: Lang; month: number; setMonth: (m: number) => void; label: string; advance: boolean; setAdvance: (v: boolean) => void }) {
  return (
    <section className="glass timeline" aria-labelledby="tl-h">
      <div className="tl-head">
        <h2 id="tl-h" className="eyebrow">{tr(lang, 'timeline')}: <b>{label}</b></h2>
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
        ? 'EarthEar, Kangalactico ekibinin NASA Space Apps Challenge 2026 (The Earth Information Jukebox) projesidir. Seçtiğin yerin çevresinde dönen bir radar, veriyi sese çevirir: yön → stereo konum, uzaklık → perde, katman → enstrüman, değer → ses şiddeti.'
        : 'EarthEar is the Kangalactico team\'s project for the NASA Space Apps Challenge 2026 (The Earth Information Jukebox). A radar sweeping around the place you choose turns data into sound: direction → stereo position, distance → pitch, layer → instrument, value → loudness.'}</p>
      <h3>{lang === 'tr' ? 'Kaynaklar' : 'Sources'}</h3>
      <ul className="credits">
        {credits.map((c) => <li key={c.title}><b>{c.title}:</b> {c.text}{c.href && <> — <a href={c.href} target="_blank" rel="noreferrer">{c.href.replace('https://', '')}</a></>}</li>)}
      </ul>
      <p className="disclaimer"><b>{tr(lang, 'disclaimer')}</b></p>
    </Dialog>
  );
}
