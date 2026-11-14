import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { engine, say, stopSpeech } from '../audio/engine.ts';
import { RadarPlayer, type RadarFrame } from '../audio/radarPlayer.ts';
import { compass8, formatKm, type LatLon } from '../lib/geo.ts';
import { DEFAULTS, describeBeam, localRange, pitchFor, sampleLayer, summarize, type Mode, type RadarLayer } from '../lib/radar.ts';
import { RadarView } from './RadarView.tsx';

export interface LayerToggle { id: string; label: string; instrument: string; on: boolean; available: boolean; note?: string }
export interface TimeControl { label: string; frames: number; frame: number; setFrame: (f: number) => void; frameLabel: (f: number) => string }

interface Props {
  placeName: string;
  center: LatLon;
  layers: RadarLayer[];           // açık katmanlar (değerleri hazır)
  toggles: LayerToggle[];
  onToggle: (id: string, on: boolean) => void;
  rangeKm: number; setRange: (km: number) => void;
  mode: Mode; setMode: (m: Mode) => void;
  time?: TimeControl;
  paint: (p: LatLon) => [number, number, number] | null;
  paintKey: string;
  marks?: { bearing: number; km: number; color: string }[];
  announce: (t: string) => void;
  extra?: React.ReactNode;        // Dünya turu vb.
  land?: import('../lib/land.ts').LandMask | null;
}

const RANGES = [500, 2000, 5000];
const SPEEDS = [{ s: 12, l: 'Yavaş (12 sn/tur)' }, { s: 8, l: 'Normal (8 sn/tur)' }, { s: 5, l: 'Hızlı (5 sn/tur)' }];

export function RadarPanel(props: Props) {
  const { placeName, center, layers, toggles, onToggle, rangeKm, setRange, mode, setMode, time, paint, paintKey, marks, announce, extra, land } = props;
  const [playing, setPlaying] = useState(false);
  const [revSec, setRevSec] = useState(8);
  const [legend, setLegend] = useState<string | null>(null);
  const manualBeam = useRef(0);
  const [manualAngle, setManualAngle] = useState<number | null>(null);

  const P = useMemo(() => ({ center, rangeKm, ...DEFAULTS }), [center, rangeKm]);
  const computed = useMemo(() => layers.map((layer) => { const vals = sampleLayer(layer, P); return { layer, vals, local: localRange(vals) }; }), [layers, P]);

  const frameRef = useRef<RadarFrame>({ P, mode, revSec, layers: computed });
  frameRef.current = { P, mode, revSec, layers: computed };
  const player = useMemo(() => new RadarPlayer(() => frameRef.current), []);
  useEffect(() => () => player.stop(), [player]);

  const angle = useCallback(() => (player.playing ? player.angle() : manualAngle), [player, manualAngle]);

  const stop = useCallback(() => { player.stop(); setPlaying(false); }, [player]);
  const play = useCallback(() => {
    if (!layers.length) { announce('Hiç katman açık değil. En az bir katmanı aç.'); return; }
    stopSpeech(); setLegend(null);
    player.start(0); setPlaying(true); setManualAngle(null);
    announce(`Radar çalıyor: ${placeName}, ${formatKm(rangeKm)} menzil. Kuzeyden saat yönünde.`);
  }, [player, layers.length, placeName, rangeKm, announce]);

  // yer/menzil değişince çalıyorsa baştan başlat (eski veriyle çalmasın)
  useEffect(() => { if (player.playing) { player.stop(); player.start(0); } }, [P, player]);

  const summary = useCallback(() => {
    if (!computed.length) { announce('Hiç katman açık değil.'); return; }
    announce(computed.map(({ layer, vals }) => summarize(layer, vals, P, placeName)).join(' '));
  }, [computed, P, placeName, announce]);

  const stepBeam = useCallback((dir: 1 | -1) => {
    if (player.playing) stop();
    engine.unlock();
    const b = (((manualBeam.current + dir) % P.beams) + P.beams) % P.beams;
    manualBeam.current = b;
    setManualAngle((b * 360) / P.beams);
    player.playBeam(frameRef.current, b, engine.now + 0.02, revSec / P.beams * 2);
    if (computed.length) announce(computed.map(({ layer, vals }) => `${layer.label}: ${describeBeam(layer, vals, P, b)}`).join(' '));
  }, [player, stop, P, revSec, computed, announce]);

  // 15 saniyelik sesli lejant (yazılı karşılığı ekranda)
  const runLegend = useCallback(async () => {
    stop(); engine.unlock(); stopSpeech();
    const tone = (timbre: string, freq: number, gain: number, pan: number, dt = 0) => engine.voice(timbre, freq, engine.now + 0.05 + dt, 0.5, gain, pan);
    const steps: [string, () => void][] = [
      ['Radar, seçtiğin yerin çevresinde kuzeyden başlayıp saat yönünde döner. Bu tık kuzeyi gösterir.', () => engine.northTick(engine.now + 0.05)],
      ['Batıdaki yerler sol kulakta,', () => tone('temp', 262, 0.7, -1)],
      ['doğudakiler sağ kulakta duyulur.', () => tone('temp', 262, 0.7, 1)],
      ['Yakın yerler pes, uzak yerler tiz.', () => { for (let k = 0; k < 8; k++) tone('temp', pitchFor(k, 8, mode, 130.81), 0.6, 0, k * 0.14); }],
      ['Ses ne kadar güçlüyse değer o kadar yüksek. Önce düşük, sonra yüksek değer.', () => { tone('temp', 262, 0.1, 0); tone('temp', 262, 1, 0, 0.6); }],
      ...toggles.filter((t) => t.on && t.available).map((t): [string, () => void] => [`${t.label}: ${t.instrument}.`, () => tone(t.id, t.id === 'black_carbon' ? 98 : t.id === 'dust' ? 784 : t.id === 'sulfate' ? 392 : 262, 0.8, 0)]),
    ];
    for (const [text, fx] of steps) {
      setLegend(text);
      fx();
      await say(text);
    }
    setLegend(null);
    announce('Lejant bitti. Çalmak için Boşluk.');
  }, [stop, toggles, mode, announce]);

  // klavye
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  keys.current = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const el = e.target instanceof HTMLElement ? e.target : null; // hedef document/window olabilir
    const tag = (el?.tagName ?? '').toLowerCase();
    const type = (el as HTMLInputElement | null)?.type ?? '';
    const textInput = tag === 'textarea' || (tag === 'input' && !['range', 'checkbox', 'radio', 'button'].includes(type)) || el?.getAttribute('role') === 'combobox' || !!el?.isContentEditable;
    if (textInput || tag === 'select') return;
    if (e.key === ' ' && tag !== 'button' && !(tag === 'input' && (type === 'checkbox' || type === 'radio'))) { e.preventDefault(); if (player.playing) stop(); else play(); }
    else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !(tag === 'input')) { e.preventDefault(); stepBeam(e.key === 'ArrowRight' ? 1 : -1); }
    else if (e.key === 's' || e.key === 'S') { e.preventDefault(); summary(); }
  };
  useEffect(() => { const h = (e: KeyboardEvent) => keys.current(e); document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, []);

  // ekrandaki kısa okuma: ilk açık katman (sesli karşılığı S özeti)
  const first = computed[0];
  const centerVal = first ? first.layer.sample(center) : NaN;
  const ext = first ? (() => { let mx = -Infinity, mb = 0; first.vals.forEach((v, i) => { if (v > mx) { mx = v; mb = Math.floor(i / P.rings); } }); return { mx, dir: compass8((mb * 360) / P.beams) }; })() : null;

  return (
    <section className="radar" aria-labelledby="radar-h">
      <h2 id="radar-h">Radar: {placeName}</h2>
      <div className="radar-grid">
        <div className="radar-visual">
          <RadarView center={center} rangeKm={rangeKm} paint={paint} paintKey={paintKey + rangeKm} angle={angle} marks={marks} land={land} />
          {first && !Number.isNaN(centerVal) && ext && (
            <p className="readout" aria-hidden="true">
              <b>{first.layer.fmt(centerVal).replace(' derece', ' °C')}</b> merkezde · en yüksek yön: <b>{ext.dir}</b> ({first.layer.fmt(ext.mx).replace(' derece', ' °C')})
              <br /><small>{first.layer.label} · {first.layer.when}</small>
            </p>
          )}
        </div>

        <div className="controls">
          <div className="row">
            <button type="button" className="btn primary" onClick={() => (playing ? stop() : play())} aria-keyshortcuts="Space">{playing ? '⏸ Durdur' : '▶ Radarı çal'}</button>
            <button type="button" className="btn" onClick={runLegend} disabled={!!legend}>🎧 Sesli lejant (15 sn)</button>
            <button type="button" className="btn" onClick={summary} aria-keyshortcuts="S">🗣 Özet (S)</button>
          </div>
          {legend && <p className="legend-caption" aria-hidden="true">{legend}</p>}

          <fieldset className="fs">
            <legend>Menzil</legend>
            <div className="seg">
              {RANGES.map((km) => (
                <label key={km} className={km === rangeKm ? 'on' : ''}>
                  <input type="radio" name="range" value={km} checked={km === rangeKm} onChange={() => { setRange(km); announce(`Menzil ${formatKm(km)}.`); }} />
                  {formatKm(km)}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="fs">
            <legend>Katmanlar (her biri bir enstrüman)</legend>
            {toggles.map((t) => (
              <label key={t.id} className={`chk${t.available ? '' : ' disabled'}`}>
                <input type="checkbox" checked={t.on && t.available} disabled={!t.available} onChange={(e) => onToggle(t.id, e.target.checked)} />
                <span><b>{t.label}</b> — {t.instrument}{t.note ? <small> · {t.note}</small> : null}</span>
              </label>
            ))}
          </fieldset>

          {time && (
            <div className="fs">
              <label className="lbl" htmlFor="time-slider">{time.label}: <b>{time.frameLabel(time.frame)}</b></label>
              <input id="time-slider" type="range" min={0} max={time.frames - 1} step={1} value={time.frame}
                aria-valuetext={time.frameLabel(time.frame)} onChange={(e) => time.setFrame(+e.target.value)} />
            </div>
          )}

          <div className="row">
            <label className="lbl inline">Hız
              <select value={revSec} onChange={(e) => setRevSec(+e.target.value)}>
                {SPEEDS.map((s) => <option key={s.s} value={s.s}>{s.l}</option>)}
              </select>
            </label>
            <label className="chk inline">
              <input type="checkbox" checked={mode === 'hikaye'} onChange={(e) => { setMode(e.target.checked ? 'hikaye' : 'bilim'); announce(e.target.checked ? 'Hikâye modu: pentatonik perde, radar içine göre şiddet.' : 'Bilim modu: doğrusal perde, sabit ölçekte şiddet.'); }} />
              <span>Hikâye modu (müzikal)</span>
            </label>
          </div>

          <p className="hint">
            Klavye: <b>Boşluk</b> çal/durdur · <b>←/→</b> ışını elle çevir ve o yönü dinle · <b>S</b> sesli özet.
            Sol kulak batı, sağ kulak doğu; yakın pes, uzak tiz; güçlü ses yüksek değer. Kulaklık önerilir.
          </p>
          {extra}
        </div>
      </div>
    </section>
  );
}
