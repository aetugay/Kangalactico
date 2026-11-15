// Dönen güneş sistemi sahnesi (three.js): giriş ekranı (StartGate) ve landing hero ortak kullanır.
// Dokular kodda üretilir; Dünya için Blue Marble (NASA EO, kamu malı; Kaynaklar'da). NASA logosu / amblemi YOK.
// reduced = true → tek statik kare. Düşük cihazda (dokunmatik / az çekirdek) yıldız azalır, piksel oranı düşer.
import * as THREE from 'three';

export interface SolarOpts {
  reduced: boolean; earthUrl: string;
  home?: [number, number, number]; look?: [number, number, number];
  waves?: boolean;                 // Dünya çevresinde ses dalgası halkaları
  isLeaving?: () => boolean;       // true olunca kamera Dünya'ya yaklaşır (~1,7 sn)
  onLeft?: () => void;
}
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


/** Sahneyi el'e kurar; temizleme fonksiyonu döner. */
export function mountSolarSystem(el: HTMLElement, o: SolarOpts): () => void {
  const { reduced, earthUrl } = o;
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' }); } catch { return () => {}; } // WebGL yok: yalnız CSS arka plan
  const low = matchMedia('(pointer: coarse)').matches || innerWidth <= 760 || (navigator.hardwareConcurrency ?? 8) <= 4; // telefon / zayıf cihaz
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, low ? 1 : 1.75)); // zayıf cihazda piksel oranı 1
  renderer.setClearColor(0x02040a); renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(45, 1, 0.05, 400);
  const home = new THREE.Vector3(...(o.home ?? [0, 12, 25])), look = new THREE.Vector3(...(o.look ?? [0, 5.2, 0])); // varsayılan: sistem ekranın alt yarısında, yazı üstte
  cam.position.copy(home); cam.lookAt(look);

  // yıldız alanı: iki katman, hafif parıldama (katman opaklığı yavaşça değişir)
  const starTex = glowTexture('rgba(255,255,255,1)', 'rgba(200,220,255,.35)');
  const starLayers = [0, 1].map((k) => {
    const n = low ? 220 : 1400, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, R = 120 + Math.random() * 150, s = Math.sqrt(1 - u * u); pos.set([R * s * Math.cos(th), R * u, R * s * Math.sin(th)], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ size: (k ? 3.2 : 2.2) * Math.min(devicePixelRatio || 1, 1.5), map: starTex, transparent: true, depthWrite: false, color: k ? 0xcfe0ff : 0xffffff, sizeAttenuation: false });
    const p = new THREE.Points(g, m); scene.add(p); return p;
  });
  // Güneş + hale
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1.5, low ? 24 : 48, low ? 16 : 32), new THREE.MeshBasicMaterial({ map: bandTexture(['#ffd35a', '#ffb02e', '#ffe58f'], 7) }));
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
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(P.size, low ? 20 : 40, low ? 14 : 28), mat);
    if (isEarth) new THREE.TextureLoader().load(earthUrl, (t) => { t.colorSpace = THREE.SRGBColorSpace; mat.map = t; mat.needsUpdate = true; });
    if (P.ring) { const rg = new THREE.Mesh(new THREE.RingGeometry(P.size * 1.35, P.size * 2.2, 64), new THREE.MeshBasicMaterial({ color: 0xd9c79a, side: THREE.DoubleSide, transparent: true, opacity: 0.55 })); rg.rotation.x = Math.PI / 2.4; mesh.add(rg); }
    if (isEarth) { const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(130,240,255,1)', 'rgba(94,228,242,.45)'), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false })); g.scale.set(2.6, 2.6, 1); g.renderOrder = -1; mesh.add(g); }
    scene.add(mesh);
    return { P, mesh, phase: (i * 2.3) % (Math.PI * 2), isEarth };
  });
  const earth = bodies.find((b) => b.isEarth)!;
  // ses dalgası halkaları (landing hero): Dünya'dan yayılan, sönen halkalar — Dünya'yı "dinlemek"
  const waves = o.waves ? (low ? [0, 1] : [0, 1, 2]).map(() => { const w = new THREE.Mesh(new THREE.RingGeometry(0.98, 1, 64), new THREE.MeshBasicMaterial({ color: 0x5ee4f2, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })); w.rotation.x = -Math.PI / 2; scene.add(w); return w; }) : [];

  const resize = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); if (reduced && !raf) renderer.render(scene, cam); };
  resize(); const ro = new ResizeObserver(resize); ro.observe(el);
  let raf = 0, t = 0, last = performance.now(), leaveT = -1, finished = false;
  const place = () => { for (const b of bodies) { const a = b.phase + t * 0.18 * b.P.speed; b.mesh.position.set(Math.cos(a) * b.P.r, 0, Math.sin(a) * b.P.r); b.mesh.rotation.y = t * 0.6; } };
  let skip = false;
  const frame = (now: number) => {
    if (low && !o.isLeaving?.()) { skip = !skip; if (skip) { raf = requestAnimationFrame(frame); return; } } // zayıf cihaz: 30 fps (uçuş tam hızda)
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!reduced) t += dt;
    place();
    starLayers.forEach((s, k) => { (s.material as THREE.PointsMaterial).opacity = reduced ? 0.9 : 0.65 + 0.3 * Math.sin(now / (900 + k * 700) + k * 2); });
    sun.rotation.y = t * 0.1;
    waves.forEach((w, i) => { const ph = reduced ? (i + 1) / 3.5 : ((now / 2600) + i / 3) % 1; w.position.copy(earth.mesh.position); const s = 0.75 + ph * 2.6; w.scale.set(s, s, s); (w.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - ph); });
    if (o.isLeaving?.()) {
      if (reduced) { finished = true; o.onLeft?.(); return; }
      if (leaveT < 0) leaveT = now;
      const k = Math.min(1, (now - leaveT) / 1700), e = k * k * (3 - 2 * k);
      const ep = earth.mesh.position, target = ep.clone().add(ep.clone().normalize().multiplyScalar(0.9)).add(new THREE.Vector3(0, 0.35, 0));
      cam.position.lerpVectors(home, target, e); cam.lookAt(new THREE.Vector3().lerpVectors(look, ep, Math.min(1, e * 1.6)));
      el.style.opacity = String(1 - Math.max(0, (k - 0.7) / 0.3));
      if (k >= 1) { finished = true; o.onLeft?.(); return; }
    } else { cam.position.copy(home); cam.lookAt(look); }
    renderer.render(scene, cam);
    if (reduced && !o.isLeaving?.()) { raf = 0; return; } // hareket azaltma: tek kare (statik), ayrılırken yeniden başlatılır
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  let cleanup = () => {
    cancelAnimationFrame(raf); ro.disconnect();
    scene.traverse((ob) => { const m = ob as THREE.Mesh; m.geometry?.dispose?.(); const mt = m.material as THREE.Material | THREE.Material[] | undefined; (Array.isArray(mt) ? mt : mt ? [mt] : []).forEach((x) => { (x as THREE.MeshBasicMaterial).map?.dispose(); x.dispose(); }); });
    renderer.dispose(); renderer.domElement.remove(); void finished;
  };
  if (reduced) { const wake = setInterval(() => { if (o.isLeaving?.() && !raf) { raf = requestAnimationFrame(frame); clearInterval(wake); } }, 100); const prev = cleanup; cleanup = () => { clearInterval(wake); prev(); }; }
  return () => cleanup();
}
