import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { engine, speak, vibrate } from '../audio/engine';
import { freqFor, makeScale, noteFor } from './mapping';
import type { Dataset } from './records';
import { Stripes } from './Stripes';

interface Props {
  data: Dataset;
  onPlayingChange: (playing: boolean) => void;
  announce: (text: string) => void;
}

const TEMPOS = [
  { ms: 320, label: 'Yavaş' },
  { ms: 200, label: 'Normal' },
  { ms: 110, label: 'Hızlı' },
];

/**
 * Tek plağın çaları. App bunu `key={data.id}` ile bağlar: plak değişince
 * bileşen sıfırdan kurulur, zamanlayıcı ve drone temizlenir.
 */
export function Player({ data, onPlayingChange, announce }: Props) {
  const { series, unit } = data;
  const dec = data.decimals ?? 2;
  const n = series.length;
  const scale = useMemo(() => makeScale(series), [series]);

  const [idx, setIdxState] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [scanMode, setScanMode] = useState(false);
  const [speakOn, setSpeakOn] = useState(false);
  const [tempo, setTempo] = useState(200);

  const idxRef = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const tempoRef = useRef(tempo);
  const speakRef = useRef(speakOn);
  tempoRef.current = tempo;
  speakRef.current = speakOn;

  const setIdx = (i: number) => {
    idxRef.current = i;
    setIdxState(i);
  };
  const say = (t: string) => speakRef.current && speak(t);
  const fmt = (v: number, d = dec) => `${v.toFixed(d)} ${unit}`;

  const soundAt = useCallback(
    (i: number, dur: number) => {
      engine.unlock();
      const t = scale.norm(series[i][1]);
      engine.pluck(noteFor(t), dur);
      engine.tick(scale.growth[i]);
      engine.droneTo(noteFor(t) / 2);
    },
    [scale, series],
  );

  const stop = useCallback(() => {
    clearTimeout(timer.current);
    setPlaying(false);
    engine.droneLevel(0);
  }, []);

  useEffect(() => onPlayingChange(playing), [playing, onPlayingChange]);
  useEffect(() => () => { clearTimeout(timer.current); engine.droneLevel(0); engine.scanOff(); }, []);

  const finish = () => {
    stop();
    const [y0, v0] = series[0];
    const [y1, v1] = series[n - 1];
    announce(`Bitti. ${y0} ile ${y1} arasında ${v0.toFixed(0)}'den ${v1.toFixed(0)} ${unit}'ye.`);
    say(`${y0}'dan ${y1}'e, ${Math.round(v0)}'dan ${Math.round(v1)} ${unit}'e.`);
  };

  const step = () => {
    const i = idxRef.current;
    soundAt(i, Math.max(0.25, (tempoRef.current / 1000) * 1.6));
    setIdx(i);
    const [y, v] = series[i];
    if (y % 10 === 0 || i === n - 1) say(`${y}, ${Math.round(v)}`);
    if (i >= n - 1) return finish();
    idxRef.current = i + 1;
    timer.current = window.setTimeout(step, tempoRef.current);
  };

  const play = () => {
    engine.unlock();
    if (scanMode) toggleScan();
    if (idxRef.current >= n - 1) idxRef.current = 0;
    setPlaying(true);
    engine.droneLevel(0.05);
    step();
  };

  const toggleScan = () => {
    const on = !scanMode;
    setScanMode(on);
    if (on) {
      engine.unlock();
      stop();
      announce('Tarama modu açık. Şeritlerin üstünde parmağını ya da fareni gezdir.');
    } else {
      engine.scanOff();
      announce('Tarama modu kapalı.');
    }
  };

  /** Yıl seçimi (kaydırıcı, ok tuşu, dokunuş): nota + okuma. */
  const select = (i: number, dur = 0.5) => {
    stop();
    const c = Math.max(0, Math.min(n - 1, i));
    setIdx(c);
    soundAt(c, dur);
    const [y, v] = series[c];
    announce(`${y}: ${fmt(v, 1)}`);
    say(String(y));
  };

  // Klavye: Boşluk çal/durdur, S tarama, ←/→ yıl (kaydırıcı odaktayken onu tarayıcı yönetir).
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  keys.current = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const el = e.target as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const isRange = tag === 'input' && (el as HTMLInputElement).type === 'range';
    if (tag === 'select' || tag === 'textarea' || (tag === 'input' && !isRange)) return;
    if (e.key === ' ' && tag !== 'button') {
      e.preventDefault();
      if (playing) stop();
      else play();
    } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !isRange && tag !== 'button') {
      e.preventDefault();
      select(idxRef.current + (e.key === 'ArrowRight' ? 1 : -1));
    } else if (e.key.toLowerCase() === 's') {
      toggleScan();
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keys.current(e);
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  // Tarama modu: imlecin altındaki değeri gerçek zamanlı sese çevir (komşu yıllar arası kayar).
  const onMove = (x: number) => {
    if (!scanMode) return;
    const fpos = Math.max(0, Math.min(n - 1, x * n - 0.5));
    const i0 = Math.floor(fpos);
    const i1 = Math.min(n - 1, i0 + 1);
    const f = fpos - i0;
    const v = series[i0][1] * (1 - f) + series[i1][1] * f;
    engine.scanTo(freqFor(scale.norm(v)));
    const ni = Math.min(n - 1, Math.floor(x * n));
    if (ni !== idxRef.current) {
      setIdx(ni);
      vibrate(Math.round(5 + scale.growth[ni] * 25));
    }
  };
  const onDown = (x: number) => {
    engine.unlock();
    if (scanMode) return onMove(x);
    select(Math.floor(x * n), 0.6);
  };

  const [year, value] = series[idx];
  const prev = idx > 0 ? series[idx - 1][1] : null;
  const delta = prev === null ? null : value - prev;

  return (
    <section className="player" aria-labelledby="player-title">
      <h2 id="player-title" className="sr">Çalar: {data.title}</h2>
      <div className="row">
        <button type="button" className="btn primary" onClick={() => (playing ? stop() : play())}>
          {playing ? '⏸ Durdur' : '▶ Çal'}
        </button>
        <button type="button" className="btn" aria-pressed={scanMode} onClick={toggleScan}
          title="Fareyi ya da parmağını şeritlerin üstünde gezdir">
          🖐 Tarama modu
        </button>
        <button type="button" className="btn" aria-pressed={speakOn}
          onClick={() => {
            engine.unlock();
            const on = !speakOn;
            setSpeakOn(on);
            if (on) speak('Sesli anlatım açık');
          }}>
          🗣 Sesli anlatım
        </button>
        <label className="ctl">
          Tempo
          <select value={tempo} onChange={(e) => setTempo(+e.target.value)}>
            {TEMPOS.map((t) => <option key={t.ms} value={t.ms}>{t.label}</option>)}
          </select>
        </label>
      </div>

      <div className="readout" aria-hidden="true">
        <span className="year">{year}</span>
        <span className="value">{fmt(value)}</span>
        {delta !== null && (
          <span className="delta">önceki yıla göre {delta >= 0 ? '+' : ''}{delta.toFixed(dec)}</span>
        )}
      </div>

      <Stripes series={series} scale={scale} idx={idx}
        onPointerDown={onDown} onPointerMove={onMove}
        onPointerLeave={() => engine.scanOff()} />

      <label className="slider">
        <span className="sr">Yıl seçici, {data.title}</span>
        <input
          type="range"
          min={0}
          max={n - 1}
          step={1}
          value={idx}
          aria-valuetext={`${year}: ${fmt(value, 1)}`}
          onPointerDown={() => engine.unlock()}
          onChange={(e) => select(+e.target.value)}
        />
      </label>
      <div className="axis" aria-hidden="true"><span>{series[0][0]}</span><span>{series[n - 1][0]}</span></div>

      <p className="hint">
        Klavye: <b>←/→</b> yıl değiştir · <b>Boşluk</b> çal/durdur · <b>S</b> tarama modu. Kulaklık önerilir.
        Tablette parmağını şeritlerin üstünde sürükle; iPad'de sessiz mod kapalı olsun.
      </p>

      <div className="map" aria-label="Ses eşlemesi" role="group">
        <div><b>Perde (melodi)</b>Değer yükseldikçe nota tizleşir. Pentatonik dizi kullanıldığı için kulağa müzik gibi gelir.</div>
        <div><b>Ritim (tıkırtı)</b>O yılki artış ne kadar büyükse vuruş o kadar sert ve parlak.</div>
        <div><b>Renk (görsel)</b>Maviden kırmızıya: düşükten yükseğe. Her şey sesle de verilir.</div>
      </div>
    </section>
  );
}
