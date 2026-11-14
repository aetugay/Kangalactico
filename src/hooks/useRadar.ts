// Radar denetimi (ses + klavye + özet + lejant) — görünümden bağımsız. 3D küre, 2D yedek ve paneller bunu paylaşır.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { engine } from '../audio/engine.ts';
import { RadarPlayer, type RadarFrame } from '../audio/radarPlayer.ts';
import { speech } from '../audio/speech.ts';
import { shortcutAllowed } from '../lib/keys.ts';
import type { Lang } from '../i18n.ts';
import { compass8, type LatLon } from '../lib/geo.ts';
import { beamSilences, DEFAULTS, describeBeam, describeScale, extremes, formatEvent, formatSilent, noteHz, playedRange, PARTS, sampleLayer, summarize, type Mode, type RadarLayer, type Scale } from '../lib/radar.ts';

interface Opts {
  placeName: string;
  center: LatLon | null;
  layers: RadarLayer[];
  rangeKm: number;
  mode: Mode;
  /** Ölçek (Adım 2): yerel (varsayılan) ya da küresel. */
  scale?: Scale;
  /** Karşılaştırma: iki yer (A, B). Verilirse tur başında önce A sonra B referansı çalar ve yerel ölçek ikisinin birleşimidir. */
  pair?: { tag: string; name: string; center: LatLon }[] | null;
  lang: Lang;
  /** Öncelikli duyuru (sesli rehber açıksa konuşur, kapalıysa ekran okuyucuya gider). */
  announce: (t: string) => void;
  onRevolution?: () => void;
  /** Işını elle çevirirken o yöndeki yerlerin adları (ör. "Bu yönde: Erzurum 380 km"). */
  beamPlaces?: (bearingDeg: number) => string;
}

export function useRadar({ placeName, center, layers, rangeKm, mode, scale = 'local', pair = null, lang, announce, onRevolution, beamPlaces }: Opts) {
  const placesRef = useRef(beamPlaces); placesRef.current = beamPlaces;
  const en = lang === 'en';
  const [playing, setPlaying] = useState(false);
  const [revSec, setRevSec] = useState(8);
  const [legend, setLegend] = useState<string | null>(null);
  const [talking, setTalking] = useState<'summary' | 'legend' | null>(null);
  const legendRun = useRef(0);
  const manualBeam = useRef(0);
  const manualAngle = useRef<number | null>(null);

  const P = useMemo(() => (center ? { center, rangeKm, ...DEFAULTS } : null), [center, rangeKm]);
  const pairKey = pair ? pair.map((p) => `${p.center.lat},${p.center.lon}`).join('|') : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pairMemo = useMemo(() => pair, [pairKey]);
  const computed = useMemo(() => (P ? layers.map((layer) => {
    const vals = sampleLayer(layer, P);
    const refs = (pairMemo ?? [{ center: P.center }]).map((q) => layer.sample(q.center));
    let local = playedRange(layer, vals, P, refs);
    // karşılaştırmada yerel ölçek iki yerin BİRLEŞİK aralığı: A ve B'de aynı değer aynı nota
    if (pairMemo) for (const q of pairMemo) {
      const o = playedRange(layer, sampleLayer(layer, { ...P, center: q.center }), { ...P, center: q.center }, refs);
      if (Number.isFinite(o.min)) local = { ...local, min: Math.min(local.min, o.min), max: Math.max(local.max, o.max) };
    }
    return { layer, vals, local };
  }) : []), [layers, P, pairMemo]);

  const frameRef = useRef<RadarFrame | null>(null);
  frameRef.current = P ? { P, mode, scale, revSec, layers: computed, refs: pairMemo ?? undefined } : null;
  const player = useMemo(() => new RadarPlayer(() => frameRef.current), []);
  useEffect(() => () => player.stop(), [player]);
  const revCb = useRef(onRevolution); revCb.current = onRevolution;
  useEffect(() => { player.onRevolution = () => revCb.current?.(); }, [player]);

  // Canlı gösterge (Adım 1): çalınan her notanın verisi. Ekranda her adımda; ekran okuyucuya (aria-live) en fazla 2.5 sn'de bir.
  const [nowLines, setNowLines] = useState<string[]>([]);
  const [liveLine, setLiveLine] = useState('');
  const lastLive = useRef(0);
  const langRef = useRef(lang); langRef.current = lang;
  useEffect(() => {
    player.onEvents = (events, b) => {
      const F = frameRef.current; if (!F) return;
      const lines = [...events.map((e) => formatEvent(e, langRef.current)), ...(b < 0 ? [] : beamSilences(F, b).map((s) => `${s.label}: ${formatSilent(s.bearing, langRef.current)}`))];
      if (!lines.length) return; // bu adımda sırası gelen katman yok (ritim) — gösterge son notada kalır
      setNowLines(lines);
      const now = Date.now();
      if (now - lastLive.current > 2500) { lastLive.current = now; setLiveLine(lines.join('. ')); }
    };
    return () => { player.onEvents = null; };
  }, [player]);

  // konuşma bitince (ya da kesilince) "özet/lejant sürüyor" durumunu kapat
  useEffect(() => speech.onChange((active) => { if (!active) setTalking((t) => (t === 'summary' ? null : t)); }), []);

  /** Işın açısı (derece) ya da null — her karede okunur (3D/2D görsel). */
  const angle = useCallback((): number | null => (player.playing ? player.angle() : manualAngle.current), [player]);

  /** Özeti ve lejantı sustur (radar çalmaya devam eder). */
  const hush = useCallback(() => { legendRun.current++; speech.stop(); setLegend(null); setTalking(null); }, []);

  const stop = useCallback(() => { player.stop(); setPlaying(false); setLiveLine(''); }, [player]);
  const play = useCallback(() => {
    if (!P) return;
    if (!layers.length) { announce(en ? 'No layer is on. Turn on at least one layer.' : 'Hiç katman açık değil. En az bir katmanı aç.'); return; }
    hush();
    player.start(0); setPlaying(true); manualAngle.current = null;
  }, [P, player, layers.length, announce, hush, en]);
  const toggle = useCallback(() => (player.playing ? stop() : play()), [player, stop, play]);

  // Yer ya da menzil değişince radar DURMAZ: bir sonraki adım yeni yerin verisiyle çalar (gezerken kesintisiz).
  // Yer tamamen kalkarsa dur.
  useEffect(() => { if (!P) stop(); }, [P, stop]);
  // Hız değişince zamanlamayı aynı ışından yeniden kur.
  useEffect(() => { if (player.playing) player.start(player.beamNow()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [revSec]);

  /** Sesli özet. Okunurken tekrar basılırsa susar. */
  const summary = useCallback(() => {
    if (!P) return;
    if (talking === 'summary') { hush(); return; }
    hush();
    if (!computed.length) { announce(en ? 'No layer is on.' : 'Hiç katman açık değil.'); return; }
    setTalking('summary');
    setTimeout(() => { if (!speech.active) setTalking(null); }, 400); // sesli rehber kapalıysa (ekran okuyucu okur) düğme takılı kalmasın
    announce(computed.map(({ layer, vals }) => summarize(layer, vals, P, placeName, lang)).join(' '));
  }, [computed, P, placeName, announce, lang, en, talking, hush]);

  const stepBeam = useCallback((dir: 1 | -1) => {
    if (!P || !frameRef.current) return;
    if (player.playing) stop();
    engine.unlock();
    const b = (((manualBeam.current + dir) % P.beams) + P.beams) % P.beams;
    manualBeam.current = b;
    manualAngle.current = (b * 360) / P.beams;
    player.playManual(frameRef.current, b, engine.now + 0.02);
    const names = placesRef.current?.((b * 360) / P.beams) ?? '';
    announce([names, ...computed.map(({ layer, vals }) => `${layer.label}: ${describeBeam(layer, vals, P, b, lang)}`)].filter(Boolean).join(' '));
  }, [P, player, stop, computed, announce, lang]);

  // Sesli lejant: ses kurallarını ve açık katmanların enstrümanlarını tanıtır. Tekrar basılırsa durur.
  const runLegend = useCallback(async () => {
    if (talking === 'legend') { hush(); return; }
    hush(); stop(); engine.unlock();
    const run = ++legendRun.current;
    setTalking('legend');
    const tone = (timbre: string, t: number, pan: number, dt = 0, dur = 0.5, hits = 1) => {
      for (let h = 0; h < hits; h++) engine.voice(timbre, noteHz(t, PARTS[timbre as keyof typeof PARTS] ?? PARTS.temp, mode), engine.now + 0.05 + dt + (h * dur) / hits, (dur / hits) * 0.85, 0.3 + 0.7 * t, pan, t);
    };
    const lowHigh = (id: string) => { tone(id, 0.05, 0, 0, 0.9, 1); tone(id, 0.5, 0, 1.0, 0.9, 2); tone(id, 0.95, 0, 2.0, 0.9, 3); };
    const first = layers[0];
    const steps: [string, () => void][] = en ? [
      ['The radar sweeps around the place you chose, starting from north and turning clockwise. This bell marks north.', () => engine.northTick(engine.now + 0.05)],
      ['Places to the west sound in your left ear,', () => tone('temp', 0.5, -1)],
      ['places to the east in your right ear.', () => tone('temp', 0.5, 1)],
      ['A higher value sounds three ways at once: a higher note, more beats, and a brighter tone. Low, middle, high.', () => lowHigh(first?.id ?? 'temp')],
      [scale === 'local' ? 'Local scale: the lowest value around this place is the lowest note, the highest is the highest note, so small differences are audible.' : 'Global scale: the same value is the same note everywhere, for comparing places.', () => {}],
      ['Each sweep starts with a plain reference tone: the value at the center. Compare every note with it.', () => { if (first) tone('ref', 0.5, 0, 0, 0.7); }],
      ['Every layer is a different instrument.', () => {}],
      ...layers.map((l): [string, () => void] => [`${l.label}: ${l.instrument}.`, () => { tone(l.id, 0.3, 0, 0, 0.6); tone(l.id, 0.6, 0, 0.45, 0.6); tone(l.id, 0.9, 0, 0.9, 0.8); }]),
    ] : [
      ['Radar, seçtiğin yerin çevresinde kuzeyden başlayıp saat yönünde döner. Bu zil kuzeyi gösterir.', () => engine.northTick(engine.now + 0.05)],
      ['Batıdaki yerler sol kulakta,', () => tone('temp', 0.5, -1)],
      ['doğudakiler sağ kulakta duyulur.', () => tone('temp', 0.5, 1)],
      ['Yüksek değer üç şekilde duyulur: daha ince nota, daha sık vuruş ve daha parlak ses. Düşük, orta, yüksek.', () => lowHigh(first?.id ?? 'temp')],
      [scale === 'local' ? 'Yerel ölçek: bu yerin çevresindeki en düşük değer en pes, en yüksek değer en ince notadır; küçük farklar da duyulur.' : 'Küresel ölçek: aynı değer her yerde aynı notadır; yerleri karşılaştırmak için.', () => {}],
      ['Her tur yalın bir referans sesiyle başlar: merkezdeki değer. Her notayı onunla karşılaştır.', () => { if (first) tone('ref', 0.5, 0, 0, 0.7); }],
      ['Her katman ayrı bir enstrümandır.', () => {}],
      ...layers.map((l): [string, () => void] => [`${l.label}: ${l.instrument}.`, () => { tone(l.id, 0.3, 0, 0, 0.6); tone(l.id, 0.6, 0, 0.45, 0.6); tone(l.id, 0.9, 0, 0.9, 0.8); }]),
    ];
    for (const [text, fx] of steps) {
      if (run !== legendRun.current) return;
      setLegend(text); fx();
      const t0 = Date.now();
      const ok = await speech.say(text);
      if (!ok || run !== legendRun.current) return;
      const wait = 1300 - (Date.now() - t0); // örnek ses bitmeden sonraki cümleye geçme
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    }
    if (run !== legendRun.current) return;
    setLegend(null); setTalking(null);
    announce(en ? 'Legend finished. Press Space to play.' : 'Lejant bitti. Çalmak için Boşluk.');
  }, [stop, layers, announce, en, talking, hush, mode, scale]);

  // klavye: Boşluk, ←/→, S, L (metin alanlarında ve diyaloglarda devre dışı)
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  keys.current = (e) => {
    if (e.shiftKey || !P || !shortcutAllowed(e)) return; // yazı alanı / form denetimi / açık diyalog → kısayol yok
    const tag = e.target instanceof HTMLElement ? e.target.tagName.toLowerCase() : '';
    if (e.key === ' ' && tag !== 'button' && tag !== 'summary') { e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); stepBeam(e.key === 'ArrowRight' ? 1 : -1); }
    else if (e.key === 's' || e.key === 'S') { e.preventDefault(); summary(); }
    else if (e.key === 'l' || e.key === 'L') { e.preventDefault(); void runLegend(); }
  };
  useEffect(() => { const h = (e: KeyboardEvent) => keys.current(e); document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }, []);

  /** "Şu an" kartı için: ilk katmanın merkez değeri ve en yüksek yönü. */
  const headline = useMemo(() => {
    const first = computed[0];
    if (!first || !P) return null;
    const c = first.layer.sample(P.center);
    const ex = extremes(first.vals, P).max;
    return { layer: first.layer, center: c, maxDir: ex ? compass8(ex.bearing, lang) : null, maxVal: ex?.v ?? NaN };
  }, [computed, P, lang]);

  /** Ölçek açıklamaları (katman başına). */
  const scaleInfo = useMemo(() => computed.map(({ layer, local }) => describeScale(layer, scale, local, lang)), [computed, scale, lang]);

  return { scaleInfo, playing, play, stop, toggle, revSec, setRevSec, legend, runLegend, summary, stepBeam, angle, computed, headline, P, talking, hush, nowLines, liveLine };
}
