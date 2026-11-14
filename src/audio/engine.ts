// Web Audio motoru (demo/index.html'den taşındı). Tek örnek: `engine`.
// Ses yalnızca kullanıcı dokunuşu içinde unlock() çağrılınca başlar.

// 1 sn'lik sessiz WAV – iOS'ta sessiz düğme açıkken Web Audio'yu açmak için.
const SILENT =
  'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';

type Listener = (running: boolean) => void;

/** Sabit tohumlu sözde rastgele üreteç (mulberry32): aynı veri → oturumdan oturuma bit bit aynı ses. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hashStr = (k: string) => { let h = 2166136261; for (let i = 0; i < k.length; i++) h = Math.imul(h ^ k.charCodeAt(i), 16777619); return h >>> 0; };

class AudioEngine {
  private ac: AudioContext | null = null;
  private master!: GainNode;
  private droneOsc: OscillatorNode | null = null;
  private droneGain!: GainNode;
  private scanOsc!: OscillatorNode;
  private scanGain!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private unlocked = false;
  private listeners = new Set<Listener>();
  private analyser: AnalyserNode | null = null;
  private levelBuf: Float32Array | null = null;

  onStatus(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private ctx(): AudioContext {
    if (this.ac) return this.ac;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new Ctor();
    const comp = ac.createDynamicsCompressor();
    this.master = ac.createGain();
    this.master.gain.value = this.mix?.master ?? 0.8;
    this.master.connect(comp).connect(ac.destination);
    // seviye ölçer (görsel nabız halkası için; sese etkisi yok)
    this.analyser = ac.createAnalyser(); this.analyser.fftSize = 512;
    comp.connect(this.analyser);
    this.levelBuf = new Float32Array(this.analyser.fftSize);

    this.ac = ac;
    return ac;
  }

  /** Eski CO₂ demosunun (src/legacy) sürekli osilatörleri — radar KULLANMAZ; yalnız istenirse oluşturulur. */
  private legacyOsc() {
    const ac = this.ctx();
    if (this.droneOsc) return;
    this.droneOsc = ac.createOscillator(); this.droneOsc.type = 'sine';
    this.droneGain = ac.createGain(); this.droneGain.gain.value = 0;
    this.droneOsc.connect(this.droneGain).connect(this.master); this.droneOsc.start();
    this.scanOsc = ac.createOscillator(); this.scanOsc.type = 'triangle';
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    this.scanGain = ac.createGain(); this.scanGain.gain.value = 0;
    this.scanOsc.connect(lp).connect(this.scanGain).connect(this.master); this.scanOsc.start();
  }

  /** Her kullanıcı dokunuşunda çağır. Tablet (özellikle iPad) kilidini açar. */
  unlock() {
    try {
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = 'playback';
    } catch { /* yok say */ }
    const c = this.ctx();
    c.resume().catch(() => {});
    if (this.unlocked) return;
    this.unlocked = true;
    try {
      const el = new Audio(SILENT);
      el.setAttribute('playsinline', '');
      el.play().catch(() => {});
    } catch { /* yok say */ }
    try {
      const b = c.createBuffer(1, 1, 22050);
      const src = c.createBufferSource();
      src.buffer = b;
      src.connect(c.destination);
      src.start(0);
    } catch { /* yok say */ }
    setTimeout(() => this.emit(), 400);
  }

  private emit() {
    const running = !this.ac || this.ac.state === 'running';
    this.listeners.forEach((fn) => fn(running));
  }

  /** Telli çalgı benzeri nota. */
  pluck(freq: number, dur: number) {
    const ac = this.ctx();
    const when = ac.currentTime + 0.01;
    const o = ac.createOscillator();
    const o2 = ac.createOscillator();
    const g = ac.createGain();
    const f = ac.createBiquadFilter();
    const g2 = ac.createGain();
    o.type = 'triangle';
    o2.type = 'sine';
    o.frequency.value = freq;
    o2.frequency.value = freq * 2;
    f.type = 'lowpass';
    f.frequency.value = 900 + freq * 4;
    g2.gain.value = 0.25;
    o.connect(f);
    o2.connect(g2).connect(f);
    f.connect(g).connect(this.master);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.35, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.start(when);
    o2.start(when);
    o.stop(when + dur + 0.05);
    o2.stop(when + dur + 0.05);
  }

  /** Değişim gücüne (0..1) göre parlaklaşan tıkırtı. */
  tick(strength: number) {
    const ac = this.ctx();
    const when = ac.currentTime + 0.01;
    if (!this.noiseBuf) {
      this.noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.2, ac.sampleRate);
      const d = this.noiseBuf.getChannelData(0); const r = seeded(11);
      for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
    }
    const s = ac.createBufferSource();
    s.buffer = this.noiseBuf;
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3000 + strength * 6000;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.02 + strength * 0.28, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.04 + strength * 0.08);
    s.connect(hp).connect(g).connect(this.master);
    s.start(when);
    s.stop(when + 0.2);
  }

  droneTo(freq: number) {
    const ac = this.ctx(); this.legacyOsc();
    this.droneOsc!.frequency.setTargetAtTime(freq, ac.currentTime, 0.3);
  }

  droneLevel(level: number) {
    if (!this.ac || !this.droneOsc) return;
    this.droneGain.gain.setTargetAtTime(level, this.ac.currentTime, level > 0 ? 0.4 : 0.3);
  }

  scanTo(freq: number) {
    const ac = this.ctx(); this.legacyOsc();
    this.scanOsc.frequency.setTargetAtTime(freq, ac.currentTime, 0.02);
    this.scanGain.gain.setTargetAtTime(0.18, ac.currentTime, 0.03);
  }

  scanOff() {
    if (!this.ac || !this.droneOsc) return;
    this.scanGain.gain.setTargetAtTime(0, this.ac.currentTime, 0.05);
  }

  /** Anlık ses seviyesi 0..1 (RMS) — görsel için. Ses bağlamı yoksa 0. */
  level(): number {
    if (!this.analyser || !this.levelBuf) return 0;
    this.analyser.getFloatTimeDomainData(this.levelBuf);
    let s = 0; for (const v of this.levelBuf) s += v * v;
    return Math.min(1, Math.sqrt(s / this.levelBuf.length) * 4);
  }

  // ---------------- Radar sesleri: küçük bir orkestra ----------------
  /** Ses saati (saniye). */
  get now(): number { return this.ctx().currentTime; }

  private bus: GainNode | null = null;
  private wet: GainNode | null = null;
  /** Kişisel ses sahnesi: genel ses, yankı, katman başına ses düzeyi ve enstrüman seçimi. */
  readonly mix = { master: 0.8, reverb: 0.3, vol: {} as Record<string, number>, inst: {} as Record<string, string> };
  setMaster(v: number) { this.mix.master = v; if (this.ac) this.master.gain.setTargetAtTime(v, this.ac.currentTime, 0.05); }
  setReverb(v: number) { this.mix.reverb = v; if (this.ac && this.wet) this.wet.gain.setTargetAtTime(v, this.ac.currentTime, 0.05); }
  private ksCache = new Map<string, AudioBuffer>();
  private waveGain: GainNode | null = null;

  /** Enstrümanların ortak çıkışı: kuru sinyal + salon yankısı (konvolüsyon). */
  private out(): GainNode {
    if (this.bus) return this.bus;
    const ac = this.ctx();
    const bus = ac.createGain();
    bus.connect(this.master);
    try {
      const len = Math.floor(ac.sampleRate * 2.4);
      const ir = ac.createBuffer(2, len, ac.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch); const r = seeded(101 + ch);
        for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
      const conv = ac.createConvolver(); conv.buffer = ir;
      const wet = ac.createGain(); wet.gain.value = this.mix.reverb; this.wet = wet;
      bus.connect(conv).connect(wet).connect(this.master);
    } catch { /* yankısız da çalışır */ }
    this.bus = bus;
    return bus;
  }

  private panNode(pan: number): AudioNode {
    const ac = this.ctx();
    const bus = this.out();
    if (typeof ac.createStereoPanner === 'function') {
      const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
      p.connect(bus); return p;
    }
    return bus; // çok eski tarayıcı: stereo yok
  }

  private noise(): AudioBuffer {
    const ac = this.ctx();
    if (!this.noiseBuf) {
      this.noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = this.noiseBuf.getChannelData(0); const r = seeded(7);
      for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
    }
    return this.noiseBuf;
  }

  /**
   * Çekilen tel (Karplus-Strong): gitar, arp ve pizzicato çello için gerçekçi tel sesi.
   * Her perde bir kez üretilir ve saklanır; çalarken yalnızca tampon oynatılır (işlemciyi yormaz).
   */
  private string(kind: 'guitar' | 'harp' | 'cello', freq: number): { buf: AudioBuffer; rate: number } {
    const ac = this.ctx(), sr = ac.sampleRate;
    const N = Math.max(2, Math.round(sr / freq));
    const key = `${kind}:${N}`;
    let buf = this.ksCache.get(key);
    if (!buf) {
      const P = kind === 'guitar' ? { dur: 2.2, decay: 0.9975, blend: 0.5, soft: 2 }
        : kind === 'harp' ? { dur: 2.6, decay: 0.9988, blend: 0.38, soft: 1 }
          : { dur: 1.3, decay: 0.990, blend: 0.5, soft: 5 };
      const len = Math.floor(sr * P.dur);
      buf = ac.createBuffer(1, len, sr);
      const o = buf.getChannelData(0);
      const line = new Float32Array(N);
      const r = seeded(hashStr(key)); // aynı tel + aynı perde → hep aynı uyarım
      for (let i = 0; i < N; i++) line[i] = r() * 2 - 1;
      for (let p = 0; p < P.soft; p++) { let prev = line[N - 1]; for (let i = 0; i < N; i++) { const c = line[i]; line[i] = (c + prev) / 2; prev = c; } }
      let mean = 0; for (let i = 0; i < N; i++) mean += line[i]; mean /= N;
      let peak = 1e-6; for (let i = 0; i < N; i++) { line[i] -= mean; peak = Math.max(peak, Math.abs(line[i])); }
      for (let i = 0; i < N; i++) line[i] /= peak;
      let idx = 0;
      for (let i = 0; i < len; i++) {
        const cur = line[idx], nxt = line[(idx + 1) % N];
        o[i] = cur;
        line[idx] = P.decay * ((1 - P.blend) * cur + P.blend * nxt);
        idx = (idx + 1) % N;
      }
      const fade = Math.floor(sr * 0.05);
      for (let i = 0; i < fade; i++) o[len - 1 - i] *= i / fade;
      this.ksCache.set(key, buf);
    }
    return { buf, rate: freq / (sr / N) };
  }

  /**
   * Enstrüman sesi. timbre: katman kimliği; gain 0..1 (vurgu); pan -1..+1 (yön).
   *   co2 → keman (yaylı, uzun)        temp → gitar (çekilen tel)      sst → arp
   *   black_carbon → çello (pizzicato)  dust → çelesta (çan)            sea_salt → flüt     sulfate → marimba
   */
  voice(timbre: string, freq: number, when: number, dur: number, gain: number, pan: number) {
    if (gain <= 0.001) return;
    const vol = this.mix.vol[timbre] ?? 1;
    if (vol <= 0.01) return;
    const kind = this.mix.inst[timbre] ?? timbre; // kullanıcı bu katmana başka enstrüman atamış olabilir
    const ac = this.ctx();
    const out = this.panNode(pan);
    const g = ac.createGain();
    g.connect(out);
    const lvl = (0.45 + 0.55 * Math.min(1, gain)) * vol; // değer vurguyu artırır ama ses hiç kaybolmaz
    const osc = (type: OscillatorType, f: number, level: number, dest: AudioNode, len: number, detune = 0) => {
      const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune;
      const lg = ac.createGain(); lg.gain.value = level; o.connect(lg).connect(dest);
      o.start(when); o.stop(when + len + 0.05);
      return o;
    };
    const vibrato = (targets: OscillatorNode[], rateHz: number, depth: number, delay: number, len: number) => {
      const lfo = ac.createOscillator(); lfo.frequency.value = rateHz;
      const lg = ac.createGain(); lg.gain.setValueAtTime(0, when); lg.gain.linearRampToValueAtTime(depth, when + delay + 0.25);
      lfo.connect(lg); for (const t of targets) lg.connect(t.frequency);
      lfo.start(when); lfo.stop(when + len + 0.05);
    };
    const pluck = (kind: 'guitar' | 'harp' | 'cello', amp: number, cutoff: number) => {
      const { buf, rate } = this.string(kind, freq);
      const s = ac.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff;
      s.connect(lp).connect(g);
      g.gain.setValueAtTime(amp * lvl, when);
      s.start(when);
    };
    switch (kind) {
      case 'co2': { // keman: iki testere + gövde filtresi, yumuşak yay atağı, gecikmeli vibrato
        const len = Math.max(0.5, dur);
        const body = ac.createBiquadFilter(); body.type = 'lowpass'; body.frequency.value = Math.min(5200, 1400 + freq * 2.6); body.Q.value = 0.8;
        const form = ac.createBiquadFilter(); form.type = 'peaking'; form.frequency.value = 1150; form.gain.value = 5; form.Q.value = 1.2;
        body.connect(form).connect(g);
        const a = osc('sawtooth', freq, 0.5, body, len + 0.3, -5), b = osc('sawtooth', freq, 0.5, body, len + 0.3, 5);
        vibrato([a, b], 5.6, freq * 0.007, 0.12, len + 0.3);
        const peak = 0.11 * lvl;
        g.gain.setValueAtTime(0.0001, when);
        g.gain.linearRampToValueAtTime(peak, when + 0.09);
        g.gain.setValueAtTime(peak, when + len - 0.05);
        g.gain.linearRampToValueAtTime(0.0001, when + len + 0.25);
        break;
      }
      case 'temp': pluck('guitar', 0.5, 3200); break;   // gitar
      case 'sst': pluck('harp', 0.42, 6000); break;     // arp
      case 'black_carbon': pluck('cello', 0.75, 1500); break; // pizzicato çello
      case 'dust': { // çelesta: çan gibi, inharmonik kısmi sesler
        osc('sine', freq, 1, g, 0.9); osc('sine', freq * 2.76, 0.3, g, 0.5); osc('sine', freq * 5.4, 0.12, g, 0.25);
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(0.1 * lvl, when + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, when + 0.85);
        break;
      }
      case 'sea_salt': { // flüt: sinüs + hafif oktav + nefes gürültüsü, yumuşak atak
        const len = Math.max(0.45, dur);
        const a = osc('sine', freq, 1, g, len + 0.2); osc('sine', freq * 2, 0.16, g, len + 0.2); osc('sine', freq * 3, 0.05, g, len + 0.2);
        vibrato([a], 5, freq * 0.004, 0.15, len + 0.2);
        const s = ac.createBufferSource(); s.buffer = this.noise(); s.loop = true;
        const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq * 2; bp.Q.value = 1.5;
        const ng = ac.createGain(); ng.gain.value = 0.07; s.connect(bp).connect(ng).connect(g); s.start(when); s.stop(when + len + 0.25);
        const peak = 0.13 * lvl;
        g.gain.setValueAtTime(0.0001, when);
        g.gain.linearRampToValueAtTime(peak, when + 0.07);
        g.gain.setValueAtTime(peak, when + len - 0.05);
        g.gain.linearRampToValueAtTime(0.0001, when + len + 0.18);
        break;
      }
      case 'sulfate': { // marimba: sinüs + 4. harmonik, tahta tokmak
        osc('sine', freq, 1, g, 0.5); osc('sine', freq * 4, 0.22, g, 0.09);
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(0.16 * lvl, when + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, when + 0.45);
        break;
      }
      default: pluck('guitar', 0.5, 3200);
    }
  }

  /** Yaylı çalgılar yatağı: çok hafif, uzun bir akor (kök + beşli). Veri taşımaz; müziğe zemin verir. */
  pad(freqs: number[], when: number, dur: number) {
    const ac = this.ctx();
    const g = ac.createGain(); g.connect(this.out());
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.connect(g);
    for (const f of freqs) for (const d of [-6, 6]) {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d;
      const lg = ac.createGain(); lg.gain.value = 0.25; o.connect(lg).connect(lp);
      o.start(when); o.stop(when + dur + 0.7);
    }
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(0.05, when + Math.min(0.8, dur / 3));
    g.gain.setValueAtTime(0.05, when + dur - 0.1);
    g.gain.linearRampToValueAtTime(0.0001, when + dur + 0.6);
  }

  /** Dalga sesi (okyanus katmanı): süzülmüş gürültü, yavaşça kabarıp çekilir. level 0..1 = ışının denize denk gelen payı. */
  waves(level: number) {
    const ac = this.ctx();
    if (!this.waveGain) {
      const s = ac.createBufferSource(); s.buffer = this.noise(); s.loop = true;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; lp.Q.value = 0.4;
      const swell = ac.createGain(); swell.gain.value = 0.6;
      const lfo = ac.createOscillator(); lfo.frequency.value = 0.17; const ld = ac.createGain(); ld.gain.value = 0.4;
      lfo.connect(ld).connect(swell.gain); lfo.start();
      const lfo2 = ac.createOscillator(); lfo2.frequency.value = 0.11; const ld2 = ac.createGain(); ld2.gain.value = 260;
      lfo2.connect(ld2).connect(lp.frequency); lfo2.start();
      this.waveGain = ac.createGain(); this.waveGain.gain.value = 0;
      s.connect(lp).connect(swell).connect(this.waveGain).connect(this.out());
      s.start();
    }
    this.waveGain.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.22, ac.currentTime, 0.35);
  }
  wavesOff() { if (this.ac && this.waveGain) this.waveGain.gain.setTargetAtTime(0, this.ac.currentTime, 0.25); }

  /** Kuzey işareti: her tur başında hafif bir üçgen (zil) vuruşu. */
  northTick(when: number) {
    const ac = this.ctx();
    const g = ac.createGain(); g.connect(this.out());
    for (const [m, l] of [[1, 1], [2.41, 0.4], [3.9, 0.2]] as const) {
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = 2093 * m;
      const lg = ac.createGain(); lg.gain.value = l; o.connect(lg).connect(g); o.start(when); o.stop(when + 0.7);
    }
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.045, when + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.6);
  }
}

export const engine = new AudioEngine();
// geliştirme sırasında tarayıcı konsolundan ses seviyesini sınamak için
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __engine?: AudioEngine }).__engine = engine;

/** Sadece Android'de çalışır; iOS web'de navigator.vibrate yok. */
export function vibrate(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch { /* yok say */ }
}

// Konuşma artık speech.ts'te; eski demo (legacy/) için ince sarmalayıcı.
import { speech } from './speech.ts';
export function speak(text: string) { void speech.say(text, 1.1); }
