// Giriş ekranı: yıldız alanı + dönen güneş sistemi (three.js). Dokular kodda üretilir; Dünya için Blue Marble (NASA EO, kamu malı; Kaynaklar'da).
// NASA logosu / amblemi YOK. "Başla" (ya da herhangi bir tuş / dokunuş) → App.welcome(); leaving = true olunca kamera Dünya'ya yaklaşır (~1,7 sn) → onDone.
// prefers-reduced-motion: dönme yok, geçiş anında. Düşük cihazda (dokunmatik / az çekirdek) yıldız sayısı azalır, piksel oranı düşer.
import { useEffect, useRef } from 'react';
import { mountSolarSystem } from '../three/solarSystem.ts';
import type { Lang } from '../i18n.ts';

interface Props { lang: Lang; leaving: boolean; reduced: boolean; earthUrl: string; onStart: () => void; onDone: () => void }

export function StartGate({ lang, leaving, reduced, earthUrl, onStart, onDone }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const leaveRef = useRef(leaving); leaveRef.current = leaving;
  const doneRef = useRef(onDone); doneRef.current = onDone;
  const en = lang === 'en';

  useEffect(() => {
    const el = host.current; if (!el) return;
    return mountSolarSystem(el, { reduced, earthUrl, isLeaving: () => leaveRef.current, onLeft: () => doneRef.current() });
  }, [reduced, earthUrl]);

  // WebGL yoksa da geçiş tamamlansın
  useEffect(() => { if (!leaving) return; const id = setTimeout(() => doneRef.current(), reduced ? 0 : 1900); return () => clearTimeout(id); }, [leaving, reduced]);

  return (
    <div className={`start-gate${leaving ? ' leaving' : ''}`} lang={lang}>
      <div ref={host} className="gate-space" aria-hidden="true" />
      <div className="gate-ui">
        <h1 id="gate-h">
          <span className="gate-title" aria-hidden="true">Earth<span>Ear</span></span>
          <span className="sr">{en ? 'EarthEar. Listen to the Earth. Press any key or tap the screen to start.' : 'EarthEar. Dünya\'yı dinle. Başlamak için herhangi bir tuşa bas ya da ekrana dokun.'}</span>
        </h1>
        <p className="gate-sub" aria-hidden="true">{en ? 'Listen to the Earth' : 'Dünya\'yı dinle'}</p>
        <button type="button" className="gate-btn" autoFocus onClick={onStart} aria-describedby="gate-h">{en ? 'Start' : 'Başla'}</button>
        <p className="gate-note" aria-hidden="true">{en ? 'Press any key or tap anywhere · headphones recommended' : 'Herhangi bir tuşa bas ya da dokun · kulaklık önerilir'}</p>
      </div>
    </div>
  );
}
