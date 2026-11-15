// EarthEar AI Guide paneli (Adım 3): yazılı komut kutusu + mikrofon + durum + önerilen komutlar + geçmiş + anlatıcı.
// Yazılı ve sesli komut AYNI çözümleyiciyi kullanır (App.tsx runCommand) — yazılı komut internetsiz çalışır.
// Not: "AI" adı arayüz adıdır; çözümleyici kural tabanlıdır (yapay zekâ modeli yok, veri uydurmaz).
import { useId, useState } from 'react';
import type { Lang } from '../i18n.ts';
import { IconGlobe, IconMic, IconPin, IconPlay, IconSpeak, IconWave } from './icons.tsx';

export interface CmdEntry { text: string; ok: boolean; source: 'voice' | 'text'; reply: string }
export type GuideStatus = { kind: 'idle' | 'listening' | 'ok' | 'fail' | 'error'; text?: string };

interface Props {
  lang: Lang;
  micSupported: boolean;
  listening: boolean;
  status: GuideStatus;
  history: CmdEntry[];
  onTalk: () => void;
  onCommand: (text: string) => void;
  narrator: boolean;
  setNarrator: (v: boolean) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  handsFree?: boolean; handsFreeWanted?: boolean; setHandsFreeWanted?: (v: boolean) => void;
  open?: boolean; setOpen?: (v: boolean) => void;
}

const CHIP_ICONS = [IconPin, IconPlay, IconWave, IconSpeak, IconGlobe, IconGlobe, IconSpeak, IconSpeak, IconPin, IconPin, IconWave];
const CHIPS: Record<Lang, string[]> = {
  tr: ['Sivas\'a git', 'Çal', 'Deniz sıcaklığını aç', 'Özet', 'Switch to English', 'Turu başlat', 'Daha hızlı konuş', 'Tekrar et', 'Burası benim evim', 'Eve dön', 'Evde hava nasıl'],
  en: ['Go to Tokyo', 'Play', 'Precipitation on', 'Summary', 'Türkçeye geç', 'Start the tour', 'Speak faster', 'Repeat', 'This is my home', 'Go home', 'Weather at home'],
};

export function Guide({ lang, micSupported, listening, status, history, onTalk, onCommand, narrator, setNarrator, inputRef, handsFree, handsFreeWanted, setHandsFreeWanted, open = true, setOpen }: Props) {
  const id = useId();
  const en = lang === 'en';
  const [q, setQ] = useState('');
  const send = (t: string) => { const s = t.trim(); if (!s) return; onCommand(s); setQ(''); };
  const statusText = status.kind === 'listening' || listening ? (en ? 'Listening… speak now.' : 'Dinliyorum… şimdi konuş.')
    : status.text ?? (handsFree ? (en ? 'Listening hands-free: start with "Earth", e.g. "Earth, go to Tokyo". Typed commands and the Speak button need no wake word.' : 'Sizi dinliyorum: "Dünya" ile başlayın, ör. "Dünya, Sivas\'ı aç". Yazılı komut ve Konuş düğmesinde gerekmez.') : (en ? 'Ready. Type or speak a command.' : 'Hazır. Bir komut yaz ya da söyle.'));
  return (
    <section className="glass guide" aria-labelledby={`${id}-h`}>
      {/* katlanabilir: kapalıyken de başlık + durum görünür (eller serbest dinleme sürer) */}
      <details open={open} onToggle={(e) => setOpen?.((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="guide-sum"><h2 id={`${id}-h`} className="eyebrow">EarthEar AI Guide</h2>{!open && <span className="small muted"> · {statusText}</span>}</summary>
      <form className="guide-row" onSubmit={(e) => { e.preventDefault(); send(q); }}>
        <label htmlFor={`${id}-in`} className="sr">{en ? 'Type a command' : 'Komut yaz'}</label>
        <input id={`${id}-in`} ref={inputRef} className="field guide-in" type="text" autoComplete="off" spellCheck={false} value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={en ? 'e.g. go to Sivas, play…' : 'örn. Sivas\'a git, çal…'} enterKeyHint="send" />
        <button type="submit" className="btn">{en ? 'Run' : 'Uygula'}</button>
        {micSupported && (
          <button type="button" className={`btn mic-btn${listening ? ' live' : ''}`} onClick={onTalk} aria-pressed={listening} aria-keyshortcuts="Space" aria-label={en ? 'Speak a command (or hold Space)' : 'Sesli komut ver (ya da Boşluk tuşunu basılı tut)'}>
            <IconMic />
          </button>
        )}
      </form>
      <p className={`guide-status ${status.kind}`} role="status" aria-live="polite">{statusText}</p>
      <div className="guide-chips" role="group" aria-label={en ? 'Suggested commands' : 'Önerilen komutlar'}>
        {CHIPS[lang].map((c, i) => { const Ico = CHIP_ICONS[i] ?? IconSpeak; return <button key={c} type="button" className="chip small-chip suggest-chip" onClick={() => send(c)}><Ico /> {c}</button>; })}
      </div>
      {micSupported && setHandsFreeWanted && <label className="switch small"><input type="checkbox" checked={!!handsFreeWanted} onChange={(e) => setHandsFreeWanted(e.target.checked)} /> <span>{en ? `Hands-free listening${handsFree ? ' (on)' : ''}` : `Eller serbest dinleme${handsFree ? ' (açık)' : ''}`}</span></label>}
      <label className="switch small"><input type="checkbox" checked={narrator} onChange={(e) => setNarrator(e.target.checked)} /> <span>{en ? 'Narrator: a short fact every sweep (N)' : 'Anlatıcı: her turda kısa bir bilgi (N)'}</span></label>
      {history.length > 0 && (
        <details className="guide-hist">
          <summary>{en ? `Recent commands (${history.length})` : `Son komutlar (${history.length})`}</summary>
          <ol>
            {history.map((h, i) => (
              <li key={i}><span aria-hidden="true">{h.ok ? '✓' : '✗'}</span> <span className="sr">{h.ok ? (en ? 'understood' : 'anlaşıldı') : (en ? 'not understood' : 'anlaşılmadı')}</span>
                {' '}<b>{h.text}</b> <small className="muted">· {h.source === 'voice' ? (en ? 'voice' : 'ses') : (en ? 'typed' : 'yazı')}</small>
                {h.reply && <div className="small muted">{h.reply}</div>}
              </li>
            ))}
          </ol>
        </details>
      )}
      </details>
    </section>
  );
}
