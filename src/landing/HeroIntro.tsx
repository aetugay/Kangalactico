// Landing hero arka planı: uygulamadaki giriş sekansının AYNISI (paylaşılan bileşenler, kopya yok):
//   1) dönen güneş sistemi (three/solarSystem.ts — StartGate ile aynı sahne)  2) kamera Dünya'ya uçar  3) uygulamanın gerçek 3D küresi (Globe3D: Blue Marble,
//   Natural Earth kıyıları, atmosfer parıltısı) yavaşça döner. Ses ve mikrofon YOK.
// Hızlı ilk boyama: önce statik poster (WebP), canlı sahne hazır olunca yumuşak geçiş; three.js tembel yüklenir.
// Atla düğmesi; herhangi bir tuş, kaydırma ya da tıklama bitirir. Oturum başına bir kez (sessionStorage); reduced-motion → doğrudan son kare.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';

const Globe3D = lazy(() => import('../three/Globe3D.tsx').then((m) => ({ default: m.Globe3D })));
const KEY = 'ee-intro-done';
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const seen = () => { try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; } };
const touch = () => typeof matchMedia !== 'undefined' && (matchMedia('(pointer: coarse)').matches || innerWidth <= 760); // telefon (dar ekran da sayılır)

export function HeroIntro({ skipLabel }: { skipLabel: string }) {
  const [phase, setPhase] = useState<'solar' | 'fly' | 'globe'>(() => (reduced() || seen() ? 'globe' : 'solar'));
  const [globeOn, setGlobeOn] = useState(phase === 'globe');   // küre bileşeni kuruldu mu (uçuş sırasında arkada hazırlanır)
  const [globeReady, setGlobeReady] = useState(false);
  const [solarReady, setSolarReady] = useState(false);
  const solarEl = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);
  const solarStarted = useRef(false), tStart = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const finish = () => { try { sessionStorage.setItem(KEY, '1'); } catch { /* yok say */ } setGlobeOn(true); setPhase('globe'); };

  // güneş sistemi: tembel yükle, ~2,2 sn sonra Dünya'ya uç
  useEffect(() => {
    if (phase !== 'solar') return;
    let stop: (() => void) | null = null, dead = false;
    const t = setTimeout(() => { if (!solarStarted.current) return; leaving.current = true; setPhase((p) => (p === 'solar' ? 'fly' : p)); setGlobeOn(true); }, 2600);
    // ilk boyama hızlı kalsın: sahne, sayfa yüklendikten ve tarayıcı boşa düştükten sonra kurulur (o zamana kadar poster)
    const idle = () => new Promise<void>((r) => { const go = () => { const w = window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }; if (w.requestIdleCallback) w.requestIdleCallback(() => r(), { timeout: 1500 }); else setTimeout(r, 300); }; if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true }); });
    idle().then(() => import('../three/solarSystem.ts')).then(({ mountSolarSystem }) => {
      if (dead || !solarEl.current) return;
      stop = mountSolarSystem(solarEl.current, { reduced: false, earthUrl: '/media/bluemarble_2048.jpg', waves: true, isLeaving: () => leaving.current, onLeft: finish });
      solarStarted.current = true; requestAnimationFrame(() => setSolarReady(true));
      tStart.current = setTimeout(() => { leaving.current = true; setPhase((p) => (p === 'solar' ? 'fly' : p)); setGlobeOn(true); }, 2600);
    });
    return () => { dead = true; clearTimeout(t); clearTimeout(tStart.current); stop?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // herhangi bir tuş / kaydırma / tıklama animasyonu bitirir
  useEffect(() => {
    if (phase === 'globe') return;
    const end = () => finish();
    const opts = { passive: true } as AddEventListenerOptions;
    addEventListener('keydown', end); addEventListener('wheel', end, opts); addEventListener('touchmove', end, opts); addEventListener('pointerdown', end);
    return () => { removeEventListener('keydown', end); removeEventListener('wheel', end); removeEventListener('touchmove', end); removeEventListener('pointerdown', end); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === 'globe']);

  const intro = phase !== 'globe';
  const poster = intro ? 'hero-solar' : 'hero-globe';
  const live = intro ? solarReady : globeReady;
  return (
    <>
    <div className={`hero-bg phase-${phase}`} aria-hidden="true">
      <picture>
        <source media="(max-width: 760px)" srcSet={`/landing/${poster}-m.webp`} />
        <img className={`hero-poster${live ? ' gone' : ''}`} src={`/landing/${poster}.webp`} alt="" width={1440} height={900} fetchPriority="high" decoding="async" />
      </picture>
      {globeOn && (
        <div className={`hero-globe${phase === 'globe' && globeReady ? ' on' : ''}`}>
          <Suspense fallback={null}>
            <Globe3D decor source={null} landCanvas={null} baseUrl={`/media/bluemarble_${touch() ? 2048 : 4096}.jpg`} center={null} rangeKm={2000}
              angle={() => null} level={() => 0} reducedMotion={reduced()} onPick={() => {}} onSlow={() => {}} onReady={() => setGlobeReady(true)} />
          </Suspense>
        </div>
      )}
      {intro && <div ref={solarEl} className={`hero-solar${solarReady ? ' on' : ''}`} />}
    </div>
    {intro && <button type="button" className="skip-intro" onClick={finish}>{skipLabel}</button>}
    </>
  );
}
