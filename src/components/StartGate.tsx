// Giriş ekranı: yıldız alanı + dönen güneş sistemi (three.js). Dokular kodda üretilir; Dünya için Blue Marble (NASA EO, kamu malı; Kaynaklar'da).
// NASA logosu / amblemi YOK. "Başla" (ya da herhangi bir tuş / dokunuş) → App.welcome(); leaving = true olunca kamera Dünya'ya yaklaşır (~1,7 sn) → onDone.
// prefers-reduced-motion: dönme yok, geçiş anında. Düşük cihazda (dokunmatik / az çekirdek) yıldız sayısı azalır, piksel oranı düşer.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Lang } from '../i18n.ts';

interface Props { lang: Lang; leaving: boolean; reduced: boolean; earthUrl: string; onStart: () => void; onDone: () => void }

const PLANETS: { name: string; r: number; size: number; speed: number; colors: string[]; ring?: boolean }[] = [
  { name: 'Merkür', r: 3.2, size: 0.18, speed: 1.6, colors: ['#8d8a86', '#b5b1aa'] },
  { name: 'Venüs', r: 4.4, size: 0.32, speed: 1.17, colors: ['#d9b26a', '#f0d59a'] },
  { name: 'Dünya', r: 5.8, size: 0.55, speed: 1.0, colors: ['#1f5fbf', '#3aa36a'] },
  { name: 'Mars', r: 7.0, size: 0.24, speed: 0.8, colors: ['#b5492b', '#d9744f'] },
  { name: 'Jüpiter', r: 9.6, size: 0.9, speed: 0.43, colors: ['#c7a27a', '#e9d2b0', '#a8774f'] },
  { name: 'Satürn', r: 12.2, size: 0.75, speed: 0.32, colors: ['#d8c08a', '#efe0b5'], ring: true },
  { name: 'Uranüs', r: 14.4, size: 0.5, speed: 0.23, colors: ['#8fd3dc', '#b6eef2'] },
  { name: 'Neptün', r: 16.4, size: 0.48, speed: 0.18, colors: ['#3f61d9', '#6f8ff0'] },
];

/** Bantlı gezegen dokusu (kodda üretilir). */
function bandTexture(colors: string[], seed: number): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d')!;
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < 128; y += 4) { g.fillStyle = colors[Math.floor(rnd() * colors.length)]; g.globalAlpha = 0.55 + 0.45 * rnd(); g.fillRect(0, y, 256, 4 + rnd() * 6); }
  g.globalAlpha = 1; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** Yumuşak parıltı (güneş halesi ve yıldızlar için). */
function glowTexture(inner: string, outer: string): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, inner); gr.addColorStop(0.35, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}

export function StartGate({ lang, leaving, reduced, earthUrl, onStart, onDone }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const leaveRef = useRef(leaving); leaveRef.current = leaving;
  const doneRef = useRef(onDone); doneRef.current = onDone;
  const en = lang === 'en';

  useEffect(() => {
    const el = host.current; if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' }); } catch { return; } // WebGL yok: yalnız CSS arka plan
    const low = matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency ?? 8) <= 4;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, low ? 1.25 : 1.75));
    renderer.setClearColor(0x02040a); renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(45, 1, 0.05, 400);
    const home = new THREE.Vector3(0, 12, 25), look = new THREE.Vector3(0, 5.2, 0); // sistem ekranın alt yarısında, yazı üstte
    cam.position.copy(home); cam.lookAt(look);

    // yıldız alanı: iki katman, hafif parıldama (katman opaklığı yavaşça değişir)
    const starTex = glowTexture('rgba(255,255,255,1)', 'rgba(200,220,255,.35)');
    const starLayers = [0, 1].map((k) => {
      const n = low ? 450 : 1400, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, R = 120 + Math.random() * 150, s = Math.sqrt(1 - u * u); pos.set([R * s * Math.cos(th), R * u, R * s * Math.sin(th)], i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = new THREE.PointsMaterial({ size: (k ? 3.2 : 2.2) * Math.min(devicePixelRatio || 1, 1.5), map: starTex, transparent: true, depthWrite: false, color: k ? 0xcfe0ff : 0xffffff, sizeAttenuation: false });
      const p = new THREE.Points(g, m); scene.add(p); return p;
    });
    // Güneş + hale
    const sun = new THREE.Mesh(new THREE.SphereGeometry(1.5, 48, 32), new THREE.MeshBasicMaterial({ map: bandTexture(['#ffd35a', '#ffb02e', '#ffe58f'], 7) }));
    scene.add(sun);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,220,120,.9)', 'rgba(255,150,40,.25)'), blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.set(11, 11, 1); scene.add(halo);
    scene.add(new THREE.PointLight(0xffffff, 3.2, 0, 0.6), new THREE.AmbientLight(0x334466, 0.6));
    // gezegenler + yörüngeler
    const bodies = PLANETS.map((P, i) => {
      const isEarth = P.name === 'Dünya';
      const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 160 }, (_, k) => new THREE.Vector3(Math.cos((k / 160) * Math.PI * 2) * P.r, 0, Math.sin((k / 160) * Math.PI * 2) * P.r))),
        new THREE.LineBasicMaterial({ color: isEarth ? 0x5ee4f2 : 0x8899bb, transparent: true, opacity: isEarth ? 0.75 : 0.22 }));
      scene.add(ring);
      const mat = new THREE.MeshStandardMaterial({ map: bandTexture(P.colors, 31 + i * 13), roughness: 0.9, metalness: 0, ...(isEarth ? { emissive: new THREE.Color(0x1b4f7a), emissiveIntensity: 0.55 } : {}) }); // Dünya gece tarafında da seçilsin
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(P.size, 40, 28), mat);
      if (isEarth) new THREE.TextureLoader().load(earthUrl, (t) => { t.colorSpace = THREE.SRGBColorSpace; mat.map = t; mat.needsUpdate = true; });
      if (P.ring) { const rg = new THREE.Mesh(new THREE.RingGeometry(P.size * 1.35, P.size * 2.2, 64), new THREE.MeshBasicMaterial({ color: 0xd9c79a, side: THREE.DoubleSide, transparent: true, opacity: 0.55 })); rg.rotation.x = Math.PI / 2.4; mesh.add(rg); }
      if (isEarth) { const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(130,240,255,1)', 'rgba(94,228,242,.45)'), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false })); g.scale.set(2.6, 2.6, 1); g.renderOrder = -1; mesh.add(g); }
      scene.add(mesh);
      return { P, mesh, phase: (i * 2.3) % (Math.PI * 2), isEarth };
    });
    const earth = bodies.find((b) => b.isEarth)!;

    const resize = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); };
    resize(); const ro = new ResizeObserver(resize); ro.observe(el);
    let raf = 0, t = 0, last = performance.now(), leaveT = -1, finished = false;
    const place = () => { for (const b of bodies) { const a = b.phase + t * 0.18 * b.P.speed; b.mesh.position.set(Math.cos(a) * b.P.r, 0, Math.sin(a) * b.P.r); b.mesh.rotation.y = t * 0.6; } };
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (!reduced) t += dt;
      place();
      starLayers.forEach((s, k) => { (s.material as THREE.PointsMaterial).opacity = reduced ? 0.9 : 0.65 + 0.3 * Math.sin(now / (900 + k * 700) + k * 2); });
      sun.rotation.y = t * 0.1;
      if (leaveRef.current) {
        if (reduced) { finished = true; doneRef.current(); return; }
        if (leaveT < 0) leaveT = now;
        const k = Math.min(1, (now - leaveT) / 1700), e = k * k * (3 - 2 * k);
        const ep = earth.mesh.position, target = ep.clone().add(ep.clone().normalize().multiplyScalar(0.9)).add(new THREE.Vector3(0, 0.35, 0));
        cam.position.lerpVectors(home, target, e); cam.lookAt(new THREE.Vector3().lerpVectors(look, ep, Math.min(1, e * 1.6)));
        el.style.opacity = String(1 - Math.max(0, (k - 0.7) / 0.3));
        if (k >= 1) { finished = true; doneRef.current(); return; }
      } else { cam.position.copy(home); cam.lookAt(look); }
      renderer.render(scene, cam);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); const mt = m.material as THREE.Material | THREE.Material[] | undefined; (Array.isArray(mt) ? mt : mt ? [mt] : []).forEach((x) => { (x as THREE.MeshBasicMaterial).map?.dispose(); x.dispose(); }); });
      renderer.dispose(); renderer.domElement.remove(); void finished;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
