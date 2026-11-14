// Radar denetimi (ses + klavye + özet + lejant) — görünümden bağımsız. 3D küre, 2D yedek ve paneller bunu paylaşır.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { engine, say, stopSpeech } from '../audio/engine.ts';
import { RadarPlayer, type RadarFrame } from '../audio/radarPlayer.ts';
import { compass8, formatKm, type LatLon } from '../lib/geo.ts';
import { DEFAULTS, describeBeam, extremes, localRange, pitchFor, sampleLayer, summarize, type Mode, type RadarLayer } from '../lib/radar.ts';

interface Opts {
  placeName: string;
  center: LatLon | null;
  layers: RadarLayer[];
  rangeKm: number;
  mode: Mode;
  announce: (t: string) => void;
  onRevolution?: () => void;
}

export function useRadar({ placeName, center, layers, rangeKm, mode, announce, onRevolution }: Opts) {
  const [playing, setPlaying] = useState(false);
  const [revSec, setRevSec] = useState(8);
  const [legend, setLegend] = useState<string | null>(null);
  const manualBeam = useRef(0);
  const manualAngle = useRef<number | null>(null);

  const P = useMemo(() => (center ? { center, rangeKm, ...DEFAULTS } : null), [center, rangeKm]);
  const computed = useMemo(() => (P ? layers.map((layer) => { const vals = sampleLayer(layer, P); return { layer, vals, local: localRange(vals) }; }) : []), [layers, P]);

  const frameRef = useRef<RadarFrame | null>(null);
  frameRef.current = P ? { P, mode, revSec, layers: computed } : null;
  const player = useMemo(() => new RadarPlayer(() => frameRef.current!), []);
  useEffect(() => () => player.stop(), [player]);
  const revCb = useRef(onRevolution); revCb.current = onRevolution;
  useEffect(() => { player.onRevolution = () => revCb.current?.(); }, [player]);

  /** Işın açısı (derece) ya da null — her karede okunur (3D/2D görsel). */
  const angle = useCallback((): number | null => (player.playing ? player.angle() : manualAngle.current), [player]);

  const stop = useCallback(() => { player.stop(); setPlaying(false); }, [player]);
  const play = useCallback(() => {
    if (!P) return;
    if (!layers.length) { announce('Hiç katman açık değil. En az bir katmanı aç.'); return; }
    stopSpeech(); setLegend(null);
    player.start(0); setPlaying(true); manualAngle.current = null;
    announce(`Radar çalıyor: ${placeName}, ${formatKm(rangeKm)} menzil. Kuzeyden saat yönünde.`);
  }, [P, player, layers.length, placeName, rangeKm, announce]);
  const toggle = useCallback(() => (player.playing ? stop() : play()), [player, stop, play]);

  // yer/menzil değişince çalıyorsa baştan başlat; yer kalkınca dur
  useEffect(() => { if (!P) { stop(); return; } if (player.playing) { player.stop(); player.start(0); } }, [P, player, stop]);

  const summary = useCallback(() => {
    if (!P) return;
    if (!computed.length) { announce('Hiç katman açık değil.'); return; }
    announce(computed.map(({ layer, vals }) => summarize(layer, vals, P, placeName)).join(' '));
  }, [computed, P, placeName, announce]);

  const stepBeam = useCallback((dir: 1 | -1) => {
    if (!P || !frameRef.current) return;
    if (player.playing) stop();
    engine.unlock();
    const b = (((manualBeam.current + dir) % P.beams) + P.beams) % P.beams;
    manualBeam.current = b;
    manualAngle.current = (b * 360) / P.beams;
    player.playBeam(frameRef.current, b, engine.now + 0.02, (revSec / P.beams) * 2);
    if (computed.length) announce(computed.map(({ layer, vals }) => `${layer.label}: ${describeBeam(layer, vals, P, b)}`).join(' '));
  }, [P, player, stop, revSec, computed, announce]);

  // ~15 sn sesli lejant (metni ekranda da gösterilir). Enstrüman tanıtımları açık katmanlardan.
  const runLegend = useCallback(async () => {
    stop(); engine.unlock(); stopSpeech();
    const tone = (timbre: string, freq: number, gain: number, pan: number, dt = 0) => engine.voice(timbre, freq, engine.now + 0.05 + dt, 0.5, gain, pan);
    const steps: [string, () => void][] = [
      ['Radar, seçtiğin yerin çevresinde kuzeyden başlayıp saat yönünde döner. Bu tık kuzeyi gösterir.', () => engine.northTick(engine.now + 0.05)],
      ['Batıdaki yerler sol kulakta,', () => tone('temp', 262, 0.7, -1)],
      ['doğudakiler sağ kulakta duyulur.', () => tone('temp', 262, 0.7, 1)],
      ['Yakın yerler pes, uzak yerler tiz.', () => { for (let k = 0; k < 8; k++) tone('temp', pitchFor(k, 8, mode, 130.81), 0.6, 0, k * 0.14); }],
      ['Ses ne kadar güçlüyse değer o kadar yüksek. Önce düşük, sonra yüksek değer.', () => { tone('temp', 262, 0.1, 0); tone('temp', 262, 1, 0, 0.6); }],
      ...layers.map((l): [string, () => void] => [`${l.label}: ${l.instrument}.`, () => tone(l.id, l.baseHz * 2, 0.8, 0)]),
    ];
    for (const [text, fx] of steps) { setLegend(text); fx(); await say(text); }
    setLegend(null);
    announce('Lejant bitti. Çalmak için Boşluk.');
  }, [stop, layers, mode, announce]);

  // klavye: Boşluk, ←/→, S (metin alanlarında devre dışı)
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  keys.current = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || !P) return;
    const el = e.target instanceof HTMLElement ? e.target : null;
    const tag = (el?.tagName ?? '').toLowerCase();
    const type = (el as HTMLInputElement | null)?.type ?? '';
    const textInput = tag === 'textarea' || (tag === 'input' && !['range', 'checkbox', 'radio', 'button'].includes(type)) || el?.getAttribute('role') === 'combobox' || !!el?.isContentEditable;
    if (textInput || tag === 'select' || el?.closest('[role="dialog"]')) return;
    if (e.key === ' ' && tag !== 'button' && !(tag === 'input' && (type === 'checkbox' || type === 'radio'))) { e.preventDefault(); toggle(); }
    else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && tag !== 'input') { e.preventDefault(); stepBeam(e.key === 'ArrowRight' ? 1 : -1); }
    else if (e.key === 's' || e.key === 'S') { e.preventDefault(); summary(); }
  };
  useEffect(() => { const h = (e: KeyboardEvent) => keys.current(e); document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, []);

  /** "Şu an" kartı için: ilk katmanın merkez değeri ve en yüksek yönü. */
  const headline = useMemo(() => {
    const first = computed[0];
    if (!first || !P) return null;
    const c = first.layer.sample(P.center);
    const ex = extremes(first.vals, P).max;
    return { layer: first.layer, center: c, maxDir: ex ? compass8(ex.bearing) : null, maxVal: ex?.v ?? NaN };
  }, [computed, P]);

  return { playing, play, stop, toggle, revSec, setRevSec, legend, runLegend, summary, stepBeam, angle, computed, headline, P };
}
