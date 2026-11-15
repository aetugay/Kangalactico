// 3D Dünya (yalnızca görsel; aria-hidden). Radar diski + tarama ışını + nabız halkası küre shader'ında,
// yüzeye oturan küresel geometriyle çizilir; ışın açısı ses motorunun saatinden okunur (birebir senkron).
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { R_EARTH, type LatLon } from '../lib/geo.ts';

/** opacity: taban Dünya görüntüsünün üstünde veri katmanının opaklığı (yumuşak görünüm ~0.72; ham hücreler / tam görsel 1). */
export interface GlobeSource { key: string; el: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement; opacity?: number }

interface Props {
  source: GlobeSource | null;
  landCanvas: HTMLCanvasElement | null;
  /** Taban Dünya görüntüsü (NASA Blue Marble: Next Generation, kamu malı). Veri ızgarası taban haritada ASLA kara/deniz maskesi olarak görünmez. */
  baseUrl?: string;
  center: LatLon | null;
  rangeKm: number;
  angle: () => number | null;  // derece, kuzeyden saat yönü
  level: () => number;         // 0..1 ses seviyesi
  reducedMotion: boolean;
  onPick: (p: LatLon) => void;
  onHover?: (p: LatLon | null) => void; // fare küre üstünde gezerken altındaki nokta (yer adını söylemek için)
  onSlow: () => void;          // FPS düşük → 2D'ye düş
  /** Dekor modu (landing hero): yakınlaştırma/döndürme/seçme yok (sayfa kaydırması küreye takılmaz), yalnız yavaş kendi kendine dönme. */
  decor?: boolean;
  /** Taban görüntüsü yüklenip ilk kare çizildi (poster → canlı sahne geçişi için). */
  onReady?: () => void;
}

/** Enlem/boylam → küre birim vektörü (three SphereGeometry UV düzeniyle uyumlu). */
export function llToVec(p: LatLon): THREE.Vector3 {
  const phi = ((p.lon + 180) / 360) * Math.PI * 2, la = (p.lat * Math.PI) / 180;
  return new THREE.Vector3(-Math.cos(phi) * Math.cos(la), Math.sin(la), Math.sin(phi) * Math.cos(la));
}
function vecToLl(v: THREE.Vector3): LatLon {
  const n = v.clone().normalize();
  const lat = (Math.asin(n.y) * 180) / Math.PI;
  let lon = (Math.atan2(n.z, -n.x) * 180) / Math.PI - 180;
  lon = ((lon + 540) % 360) - 180;
  return { lat, lon };
}
/** Merkezde yerel kuzey ve doğu birim vektörleri (shader'da yön hesabı için). */
function basis(p: LatLon) {
  const phi = ((p.lon + 180) / 360) * Math.PI * 2, la = (p.lat * Math.PI) / 180;
  const north = new THREE.Vector3(Math.cos(phi) * Math.sin(la), Math.cos(la), -Math.sin(phi) * Math.sin(la)).normalize();
  const east = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi)).normalize();
  return { north, east };
}

const EARTH_VS = /* glsl */ `
  varying vec2 vUv; varying vec3 vPos; varying vec3 vNormalW;
  void main() {
    vUv = uv; vPos = normalize(position);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const EARTH_FS = /* glsl */ `
  uniform sampler2D uTexA; uniform sampler2D uTexB; uniform sampler2D uLand;
  uniform float uHasA; uniform float uHasB; uniform float uMix; uniform float uHasLand;
  uniform vec3 uCenter; uniform vec3 uNorth; uniform vec3 uEast; uniform float uRange;
  uniform float uHasCenter; uniform float uSweep; uniform float uHasSweep; uniform float uLevel;
  uniform vec3 uLightDir; uniform float uCoastW; uniform sampler2D uBase; uniform float uHasBase; uniform float uOpA; uniform float uOpB;
  varying vec2 vUv; varying vec3 vPos; varying vec3 vNormalW;
  const float TAU = 6.2831853;
  void main() {
    vec3 L = uHasLand > 0.5 ? texture2D(uLand, vUv).rgb : vec3(0.0);
    vec3 base = uHasBase > 0.5 ? texture2D(uBase, vUv).rgb * 0.92 : mix(vec3(0.02, 0.06, 0.15), vec3(0.13, 0.16, 0.20), L.g);
    vec4 a = texture2D(uTexA, vUv), b = texture2D(uTexB, vUv);
    vec3 ca = mix(base, a.rgb, a.a * uHasA * uOpA), cb = mix(base, b.rgb, b.a * uHasB * uOpB);
    vec3 col = mix(ca, cb, uMix);
    col *= 0.62 + 0.45 * max(dot(normalize(vNormalW), uLightDir), 0.0);
    col = mix(col, vec3(0.95), L.r * uCoastW);                       // kıyı çizgisi
    if (uHasCenter > 0.5) {
      vec3 p = normalize(vPos);
      float d = acos(clamp(dot(p, uCenter), -1.0, 1.0));           // merkeze açısal uzaklık
      float rr = d / uRange, inR = step(rr, 1.0);
      float aa = fwidth(rr) * 1.5;
      float rim = 1.0 - smoothstep(0.0, aa * 1.5 + 0.004, abs(rr - 1.0));
      float rings = 0.0;
      for (int k = 1; k <= 3; k++) rings += 1.0 - smoothstep(0.0, aa + 0.002, abs(rr - float(k) * 0.25));
      col = mix(col, col * 0.78 + vec3(0.0, 0.04, 0.07), inR * 0.30);
      col += vec3(0.45, 0.9, 1.0) * (rim * 0.95 + rings * 0.22 * inR);
      if (uHasSweep > 0.5) {
        float br = atan(dot(p, uEast), dot(p, uNorth));             // yön (kuzeyden saat yönü)
        float delta = mod(uSweep - br + 2.0 * TAU, TAU);           // ışının arkasında kalan açı
        float tail = exp(-delta * 3.2) * inR;
        float edge = (1.0 - smoothstep(0.0, 0.03, delta)) * inR;
        col = col * (1.0 + tail * 0.65) + vec3(0.25, 0.85, 1.0) * (tail * 0.22 + edge * 0.85);
      }
      float pr = uRange * (0.07 + 0.05 * uLevel);                   // sesle atan halka
      float pulse = 1.0 - smoothstep(0.0, uRange * 0.008 + 0.0015, abs(d - pr));
      col += vec3(1.0, 0.82, 0.35) * pulse * (0.35 + 0.9 * uLevel);
    }
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;
const ATMO_VS = /* glsl */ `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const ATMO_FS = /* glsl */ `varying vec3 vN; void main(){ float i = pow(clamp(0.72 - dot(vN, vec3(0.0,0.0,1.0)), 0.0, 1.0), 3.0); gl_FragColor = vec4(0.32, 0.62, 1.0, 1.0) * i * 1.6; }`;

export function Globe3D(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const P = useRef(props); P.current = props;
  const api = useRef<{ setSource: (s: GlobeSource | null) => void; setLand: (c: HTMLCanvasElement | null) => void; setCenter: (c: LatLon | null, rangeKm: number) => void } | null>(null);

  useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02040a);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 200);
    camera.position.set(0.9, 0.9, 3.1);

    // yıldızlar
    const starGeo = new THREE.BufferGeometry();
    const N = 1800, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(40 + Math.random() * 30); pos.set([v.x, v.y, v.z], i * 3); }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.75 }));
    scene.add(stars);

    // Dünya
    const empty = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); empty.needsUpdate = true;
    const uniforms = {
      uTexA: { value: empty as THREE.Texture }, uTexB: { value: empty as THREE.Texture }, uLand: { value: empty as THREE.Texture },
      uHasA: { value: 0 }, uHasB: { value: 0 }, uMix: { value: 0 }, uHasLand: { value: 0 },
      uCenter: { value: new THREE.Vector3(1, 0, 0) }, uNorth: { value: new THREE.Vector3(0, 1, 0) }, uEast: { value: new THREE.Vector3(0, 0, 1) },
      uRange: { value: 0.3 }, uHasCenter: { value: 0 }, uSweep: { value: 0 }, uHasSweep: { value: 0 }, uLevel: { value: 0 },
      uLightDir: { value: new THREE.Vector3(0.6, 0.5, 0.8).normalize() },
      uCoastW: { value: 0.55 }, // raster kıyı (kara maskesinden); vektör kıyı yüklenince kapanır
      uBase: { value: empty as THREE.Texture }, uHasBase: { value: 0 }, uOpA: { value: 1 }, uOpB: { value: 1 },
    };
    const earthMat = new THREE.ShaderMaterial({ uniforms, vertexShader: EARTH_VS, fragmentShader: EARTH_FS });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 96), earthMat);
    scene.add(earth);
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.07, 96, 64), new THREE.ShaderMaterial({ vertexShader: ATMO_VS, fragmentShader: ATMO_FS, side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    scene.add(atmo);

    // Adım 5 (hızlı kısım): keskin doku — en yüksek anizotropik süzme (mipmap'ler three.js varsayılanıyla açık); piksel oranı yukarıda (en fazla 2)
    const maxAniso = Math.max(1, renderer.capabilities.getMaxAnisotropy());
    // vektör kıyı çizgileri: Natural Earth 1:50m (kamu malı) — yaklaşınca bulanıklaşmaz. Veri katmanlarının çözünürlüğü DEĞİŞMEZ (yalnız altlık).
    let disposed = false;
    if (P.current.baseUrl) new THREE.TextureLoader().load(P.current.baseUrl, (t) => {
      if (disposed) { t.dispose(); return; }
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; t.needsUpdate = true;
      uniforms.uBase.value = t; uniforms.uHasBase.value = 1; uniforms.uCoastW.value = 0; // taban görüntüsü varken raster kara maskesi kullanılmaz
      requestAnimationFrame(() => requestAnimationFrame(() => P.current.onReady?.()));
    });
    fetch(`${import.meta.env.BASE_URL}data/coastline_50m.json`).then((r) => (r.ok ? r.json() : null)).then((c: { points: number; starts: number[]; data: string } | null) => {
      if (!c || disposed) return;
      const bin = atob(c.data), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const q = new Int16Array(u8.buffer), ends = [...c.starts.slice(1), c.points];
      const pos: number[] = []; const v = new THREE.Vector3();
      const put = (i: number) => { v.copy(llToVec({ lon: q[2 * i] / 100, lat: q[2 * i + 1] / 100 })).multiplyScalar(1.0012); pos.push(v.x, v.y, v.z); };
      c.starts.forEach((s0, li) => { for (let i = s0; i < ends[li] - 1; i++) { put(i); put(i + 1); } });
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const coast = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xf2f6ff, transparent: true, opacity: 0.6, depthWrite: false }));
      coast.renderOrder = 2; scene.add(coast); uniforms.uCoastW.value = 0;
    }).catch(() => { /* raster kıyı kalır */ });

    // iğne
    const pin = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.07, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stem.position.y = 0.035;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd25a }));
    head.position.y = 0.072;
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd25a, transparent: true, opacity: 0.25, depthWrite: false }));
    glow.position.y = 0.072;
    pin.add(stem, head, glow); pin.visible = false; scene.add(pin);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.minDistance = 1.35; controls.maxDistance = 6; controls.rotateSpeed = 0.5;
    controls.autoRotate = !P.current.reducedMotion; controls.autoRotateSpeed = 0.55;
    if (P.current.decor) { controls.enableZoom = false; controls.enableRotate = false; controls.autoRotateSpeed = 0.35; renderer.domElement.style.pointerEvents = 'none'; }

    // --- doku geçişi
    const texOf = (s: GlobeSource) => {
      const t = s.el instanceof HTMLVideoElement ? new THREE.VideoTexture(s.el) : s.el instanceof HTMLCanvasElement ? new THREE.CanvasTexture(s.el) : new THREE.Texture(s.el);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; t.needsUpdate = true;
      return t;
    };
    let fade: { t0: number; dur: number } | null = null;
    const finishFade = () => {
      if (uniforms.uTexA.value !== empty && uniforms.uTexA.value !== uniforms.uTexB.value) uniforms.uTexA.value.dispose();
      uniforms.uTexA.value = uniforms.uTexB.value; uniforms.uHasA.value = uniforms.uHasB.value; uniforms.uOpA.value = uniforms.uOpB.value; uniforms.uMix.value = 0; fade = null;
    };
    const setSource = (s: GlobeSource | null) => {
      if (fade) finishFade();
      uniforms.uTexB.value = s ? texOf(s) : empty; uniforms.uHasB.value = s ? 1 : 0; uniforms.uOpB.value = s?.opacity ?? 1;
      if (P.current.reducedMotion) { uniforms.uMix.value = 1; finishFade(); } else { uniforms.uMix.value = 0; fade = { t0: performance.now(), dur: 700 }; }
    };
    const setLand = (c: HTMLCanvasElement | null) => {
      if (uniforms.uLand.value !== empty) uniforms.uLand.value.dispose();
      if (!c) { uniforms.uLand.value = empty; uniforms.uHasLand.value = 0; return; }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = maxAniso; t.needsUpdate = true;
      uniforms.uLand.value = t; uniforms.uHasLand.value = 1;
    };

    // --- kamera uçuşu
    let flight: { from: THREE.Vector3; to: THREE.Vector3; d0: number; d1: number; t0: number } | null = null;
    const distFor = (km: number) => (km <= 500 ? 1.75 : km <= 2000 ? 2.15 : 2.9);
    const setCenter = (c: LatLon | null, rangeKm: number) => {
      if (!c) { uniforms.uHasCenter.value = 0; pin.visible = false; controls.autoRotate = !P.current.reducedMotion; return; }
      const v = llToVec(c), { north, east } = basis(c);
      uniforms.uCenter.value.copy(v); uniforms.uNorth.value.copy(north); uniforms.uEast.value.copy(east);
      uniforms.uRange.value = rangeKm / R_EARTH; uniforms.uHasCenter.value = 1;
      pin.visible = true; pin.position.copy(v); pin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
      controls.autoRotate = false;
      const d1 = distFor(rangeKm);
      if (P.current.reducedMotion) { camera.position.copy(v.clone().multiplyScalar(d1)); controls.update(); return; }
      flight = { from: camera.position.clone().normalize(), to: v.clone(), d0: camera.position.length(), d1, t0: performance.now() };
    };
    api.current = { setSource, setLand, setCenter };

    // --- seçme (sürükleme değil, dokunma)
    const ray = new THREE.Raycaster(); let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return; }
      down = null;
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObject(earth)[0];
      if (hit) P.current.onPick(vecToLl(hit.point));
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    let lastMove = 0;
    const onMove = (e: PointerEvent) => {
      if (!P.current.onHover || e.buttons !== 0 || e.pointerType === 'touch') return;
      const now = performance.now(); if (now - lastMove < 140) return; lastMove = now;
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObject(earth)[0];
      P.current.onHover(hit ? vecToLl(hit.point) : null);
    };
    const onLeave = () => P.current.onHover?.(null);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerleave', onLeave);

    // --- boyut
    const resize = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();

    // --- döngü
    let raf = 0, last = performance.now(), lvl = 0;
    // performans denetimi: veri yüklenirken oluşan kısa takılmalar 3D'yi kapatmasın diye
    // 4 sn ısınmadan sonra 5 sn boyunca kare sürelerinin ORTANCASINA bakılır (tek tük uzun kareler sayılmaz).
    const fps = { t0: performance.now(), frames: [] as number[], done: false };
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      if (now - last > 1000 && !fps.done) { fps.t0 = now; fps.frames.length = 0; } // sekme gizliydi: ölçümü baştan al
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (fade) { const k = Math.min(1, (now - fade.t0) / fade.dur); uniforms.uMix.value = k; if (k >= 1) finishFade(); }
      if (flight) {
        const k = Math.min(1, (now - flight.t0) / 1500), e = ease(k);
        const dir = flight.from.clone().lerp(flight.to, e).normalize();
        camera.position.copy(dir.multiplyScalar(flight.d0 + (flight.d1 - flight.d0) * e));
        camera.lookAt(0, 0, 0);
        if (k >= 1) flight = null;
      } else controls.update();
      const a = P.current.angle();
      uniforms.uHasSweep.value = a === null ? 0 : 1;
      if (a !== null) uniforms.uSweep.value = (a * Math.PI) / 180;
      lvl += (P.current.level() - lvl) * Math.min(1, dt * 12);
      uniforms.uLevel.value = lvl;
      const s = 1 + lvl * 0.6; glow.scale.setScalar(s);
      if (!P.current.reducedMotion) stars.rotation.y += dt * 0.004;
      renderer.render(scene, camera);
      if (!fps.done) {
        const el2 = now - fps.t0;
        if (el2 > 4000) fps.frames.push(dt);
        if (el2 > 9000) {
          fps.done = true;
          const sorted = fps.frames.slice().sort((x, y) => x - y), med = sorted[Math.floor(sorted.length / 2)] ?? 0;
          if (sorted.length < 40 || med > 1 / 14) P.current.onSlow(); // ortanca 14 fps'in altındaysa 2D'ye düş
        }
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onDown); renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointermove', onMove); renderer.domElement.removeEventListener('pointerleave', onLeave);
      scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); const mat = m.material as THREE.Material | undefined; mat?.dispose?.(); });
      [uniforms.uTexA.value, uniforms.uTexB.value, uniforms.uLand.value, uniforms.uBase.value].forEach((t) => t !== empty && t.dispose());
      renderer.dispose(); el.removeChild(renderer.domElement); api.current = null;
    };
  }, []);

  useEffect(() => { api.current?.setSource(props.source); }, [props.source?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.current?.setLand(props.landCanvas); }, [props.landCanvas]);
  useEffect(() => { api.current?.setCenter(props.center, props.rangeKm); }, [props.center?.lat, props.center?.lon, props.rangeKm]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={host} className="globe" aria-hidden="true" />;
}

/** WebGL var mı? */
export function hasWebGL(): boolean {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
