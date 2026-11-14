import { INSTRUMENT_OF } from '../lib/radar.ts';
import { worldParams, type WorldParams } from '../lib/worlds.ts';
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
   *   ref → referans tonu (tur başında merkez değeri; diyapazon gibi yalın, hiçbir enstrümana benzemez)
   * bright 0..1 (Adım 2): tını parlaklığı — değer yükseldikçe süzgeç açılır (temelin 1.5× → 11.5× üstü).
   */
  voice(timbre: string, freq: number, when: number, dur: number, gain: number, pan: number, bright?: number) {
    if (gain <= 0.001) return;
    const vol = this.mix.vol[timbre] ?? 1;
    if (vol <= 0.01) return;
    const kind = this.mix.inst[timbre] ?? INSTRUMENT_OF[timbre as keyof typeof INSTRUMENT_OF] ?? timbre; // kullanıcı ataması ya da 2024 katmanının enstrümanı
    const ac = this.ctx();
    const out = this.panNode(pan);
    const g = ac.createGain();
    if (bright !== undefined) {
      const tone = ac.createBiquadFilter(); tone.type = 'lowpass'; tone.Q.value = 0.6;
      tone.frequency.value = Math.min(16000, freq * (1.5 + 10 * Math.max(0, Math.min(1, bright))));
      g.connect(tone).connect(out);
    } else g.connect(out);
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
      case 'lightning': { // vurmalı çakma: süzülmüş gürültü patlaması (çatırtı) + alçak gümbürtü; perde ve parlaklık veriden
        const n = ac.createBufferSource(); n.buffer = this.noise();
        const hp = ac.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 1800 + 2500 * Math.min(1, gain); hp.Q.value = 0.7;
        const ng = ac.createGain(); n.connect(hp).connect(ng).connect(g);
        ng.gain.setValueAtTime(0.0001, when); ng.gain.exponentialRampToValueAtTime(0.9, when + 0.004); ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.12);
        n.start(when, (hashStr(String(freq)) % 1000) / 1000); n.stop(when + 0.15);
        osc('sine', freq, 0.9, g, 0.35);
        g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(0.22 * lvl, when + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.4);
        break;
      }
      case 'ref': { // referans: sinüs + hafif 2. ve 3. harmonik (parlaklık süzgeci bunları açar), yumuşak atak, vibratosuz
        const len = Math.max(0.3, dur);
        osc('sine', freq, 1, g, len + 0.2); osc('triangle', freq * 2, 0.35, g, len + 0.2); osc('sine', freq * 3, 0.15, g, len + 0.2);
        const peak = 0.12 * lvl;
        g.gain.setValueAtTime(0.0001, when);
        g.gain.linearRampToValueAtTime(peak, when + 0.04);
        g.gain.setValueAtTime(peak, when + len - 0.06);
        g.gain.linearRampToValueAtTime(0.0001, when + len + 0.12);
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

  /** Dinleme başladı: tek kısa bip (arayüz geri bildirimi). */
  beep() {
    const ac = this.ctx(), t = ac.currentTime + 0.02;
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = 988;
    const g = ac.createGain(); o.connect(g).connect(this.master);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.start(t); o.stop(t + 0.22);
  }

  /** Komut onay sesi (arayüz geri bildirimi; veri değil): anlaşıldı → kısa yükselen iki nota, anlaşılmadı → alçalan iki nota. */
  confirm(ok: boolean) {
    const ac = this.ctx(), when = ac.currentTime + 0.02;
    const notes = ok ? [880, 1318.5] : [440, 330];
    notes.forEach((f, i) => {
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ac.createGain(); o.connect(g).connect(this.master);
      const t = when + i * 0.09;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.start(t); o.stop(t + 0.2);
    });
  }

  // ---------------- SES DÜNYALARI (prosedürel sentez; ses dosyası yok, internetsiz) ----------------
  /**
   * Bir ses dünyası dokusu: when'den dur saniye. p = lib/worlds.ts worldParams (veriden). seed → olay zamanları (aynı veri = aynı ses).
   * Frekans bölgeleri: volkan 40–160 Hz · gürleme 80–400 · trafik ~300 · dalga 400–2200 · kum/çıtırtı 2–6 kHz · böcek/kuş 3–6 kHz.
   */
  world(p: WorldParams, when: number, dur: number, pan: number, seed: number, vol = 1) {
    if (p.level <= 0.001 || vol <= 0.01) return;
    const ac = this.ctx(), rnd = seeded(seed);
    const out = this.panNode(pan);
    const bus = ac.createGain(); bus.gain.value = vol;
    const lpf = ac.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = p.cutoff; lpf.Q.value = 0.5; // uzaklık → boğukluk
    bus.connect(lpf).connect(out);
    const end = when + dur;
    /** Süzülmüş gürültü katmanı: tip/frekans/Q, zarf (atak, tepe, bırakma). */
    const noise = (type: BiquadFilterType, f: number, q: number, peak: number, atk: number, rel: number, t0 = when, t1 = end) => {
      const s = ac.createBufferSource(); s.buffer = this.noise(); s.loop = true;
      const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = ac.createGain(); s.connect(fl).connect(g).connect(bus);
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + atk);
      g.gain.setValueAtTime(peak, Math.max(t0 + atk, t1 - rel)); g.gain.linearRampToValueAtTime(0.0001, t1);
      s.start(t0, rnd() * 1.5); s.stop(t1 + 0.05);
      return { g, fl };
    };
    /** Kısa olay (tane, çıtırtı, buz çatırtısı): yüksek geçiren gürültü patlaması. */
    const click = (t: number, f: number, len: number, peak: number) => {
      const s = ac.createBufferSource(); s.buffer = this.noise();
      const fl = ac.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = 1.2;
      const g = ac.createGain(); s.connect(fl).connect(g).connect(bus);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      s.start(t, rnd() * 1.8); s.stop(t + len + 0.02);
    };
    const tone = (type: OscillatorType, f: number, peak: number, atk: number, rel: number, t0 = when, t1 = end, f2?: number) => {
      const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t1);
      const g = ac.createGain(); o.connect(g).connect(bus);
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(peak, t0 + atk); g.gain.setValueAtTime(peak, Math.max(t0 + atk, t1 - rel)); g.gain.linearRampToValueAtTime(0.0001, t1);
      o.start(t0); o.stop(t1 + 0.05); return o;
    };
    /** dur içinde rate (olay/sn) kadar olayı seed'li zamanlara dağıt. */
    const events = (rate: number, fn: (t: number, k: number) => void) => { const n = Math.round(rate * dur); for (let k = 0; k < n; k++) fn(when + rnd() * dur, k); };
    const L = p.level, atk = Math.min(0.25, dur * 0.3), rel = Math.min(0.35, dur * 0.4);
    switch (p.world) {
      case 'dust': // kum fırtınası: geniş hışırtı + rüzgâr savruluşu + savrulan kum taneleri
        noise('bandpass', 2600 + 1200 * p.sharp, 0.7, 0.10 * L, atk, rel);
        noise('lowpass', 700, 0.4, 0.05 * L, atk, rel);
        events(p.rate, (t) => click(t, 3000 + 3000 * rnd(), 0.006 + 0.01 * rnd(), (0.03 + 0.06 * p.sharp) * L));
        break;
      case 'smoke': // yangın: alçak uğultu + rastgele çıtırtılar
        noise('lowpass', 170, 0.6, 0.14 * L, atk, rel);
        events(p.rate, (t) => click(t, 2200 + 3500 * rnd(), 0.004 + 0.012 * rnd(), (0.05 + 0.12 * p.sharp * rnd()) * L));
        break;
      case 'spray': { // dalga serpintisi: kabaran dalga + tepede serpinti hışırtısı
        noise('lowpass', 900, 0.5, 0.10 * L, dur * 0.45, dur * 0.5);
        noise('highpass', 3200, 0.5, 0.05 * L * (0.4 + p.sharp), dur * 0.5, dur * 0.45, when + dur * 0.2, end);
        break;
      }
      case 'volcano': // derin volkan uğultusu: iki alçak ton + boğuk gürültü
        tone('sine', 41, 0.16 * L, atk * 2, rel * 2); tone('sine', 61.5, 0.08 * L, atk * 2, rel * 2);
        noise('lowpass', 120, 0.7, 0.12 * L, atk * 2, rel * 2);
        break;
      case 'thunder': { // gök gürültüsü: yakın = sert çatırtı + gürleme; uzak = geç gelen boğuk uzun gürleme
        const n = Math.max(1, Math.round(p.rate * dur));
        for (let k = 0; k < n; k++) {
          const t0 = when + p.delay + rnd() * dur * 0.8, len = 1.2 + 1.6 * (1 - p.sharp) + rnd() * 0.6;
          if (p.sharp > 0.55) click(t0, 1800 + 1500 * rnd(), 0.05, 0.35 * L);
          const { g } = noise('lowpass', 140 + 180 * p.sharp, 0.8, 0.0001, 0.01, 0.01, t0, t0 + len);
          g.gain.cancelScheduledValues(t0); g.gain.setValueAtTime(0.0001, t0);
          g.gain.exponentialRampToValueAtTime(0.35 * L, t0 + 0.05 + 0.25 * (1 - p.sharp));
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
        }
        break;
      }
      case 'city': { // şehir uğultusu: trafik (alçak bant) + kalabalık mırıltısı (dalgalanan orta bant)
        noise('bandpass', 280, 0.6, 0.12 * L * (p.mix.traffic ?? 1), atk, rel);
        if ((p.mix.crowd ?? 0) > 0.02) {
          const { g } = noise('bandpass', 750, 1.1, 0.07 * L * p.mix.crowd, atk, rel);
          const lfo = ac.createOscillator(); lfo.frequency.value = 2.5 + rnd() * 2; const d = ac.createGain(); d.gain.value = 0.03 * L * p.mix.crowd;
          lfo.connect(d).connect(g.gain); lfo.start(when); lfo.stop(end + 0.05);
        }
        break;
      }
      case 'forest': { // yaprak hışırtısı + kuş cıvıltıları; çıplak arazide yalnız boş rüzgâr
        if ((p.mix.leaves ?? 0) > 0.02) noise('highpass', 4200, 0.6, 0.05 * L * p.mix.leaves, atk, rel);
        if ((p.mix.wind ?? 0) > 0.02) noise('lowpass', 450, 0.4, 0.07 * L * p.mix.wind, atk, rel);
        events(p.rate, (t) => { // kuş: 2–3 hızlı yükselen ıslık hecesi
          const base = 2400 + 2200 * rnd(), syl = 2 + Math.floor(rnd() * 2);
          for (let k = 0; k < syl; k++) { const s0 = t + k * 0.09; tone('sine', base, 0.05 * L, 0.01, 0.03, s0, s0 + 0.07, base * (1.25 + 0.2 * rnd())); }
        });
        break;
      }
      case 'heat': { // soğuk: buzlu ıslıklı rüzgâr + buz çatırtısı · ılık: yumuşak esinti · sıcak: ağustos böcekleri + titreşen hava
        const { icy = 0, hot = 0, breeze = 0 } = p.mix;
        if (icy > 0.02) { noise('bandpass', 1300, 4, 0.10 * L * icy, atk, rel); events(p.rate, (t) => click(t, 4200 + 1500 * rnd(), 0.02, 0.08 * L * icy)); }
        if (breeze > 0.02) noise('lowpass', 600, 0.4, 0.07 * L * breeze, atk, rel);
        if (hot > 0.02) {
          const { g } = noise('bandpass', 4800, 9, 0.16 * L * hot, atk, rel);
          const lfo = ac.createOscillator(); lfo.frequency.value = 24 + 10 * hot; const d = ac.createGain(); d.gain.value = 0.12 * L * hot;
          lfo.connect(d).connect(g.gain); lfo.start(when); lfo.stop(end + 0.05);
          noise('highpass', 6500, 0.5, 0.015 * L * hot, atk, rel); // sıcak hava titremesi
        }
        break;
      }
      case 'ocean': { // dalga: sıcak = yumuşak, yavaş kabaran; soğuk = sert, parlak; buzlu = çatırtı
        const { cold = 0, ice = 0 } = p.mix;
        noise('lowpass', 500 + 1500 * cold, 0.5 + cold, 0.13 * L, dur * (0.45 - 0.2 * cold), dur * 0.5);
        if (cold > 0.4) noise('highpass', 2500, 0.6, 0.03 * L * cold, atk, rel);
        if (ice > 0.02) events(p.rate, (t) => click(t, 3800 + 1800 * rnd(), 0.015, 0.07 * L * ice));
        break;
      }
    }
  }

  /**
   * Meteorolog: bir günün hava sahnesi (dur sn). sc = lib/forecast.ts weatherScene (veriden; 0..1 şiddetler).
   * yağmur: çiseleme → sağanak (damla sıklığı + hışırtı) · kar: boğuk yumuşak sessizlik + hafif rüzgâr · rüzgâr: hıza göre uğultu ve esinti
   * sıcak ve güneşli: ağustos böcekleri · soğuk: buzlu rüzgâr (ses dünyası 'heat') · gök gürültüsü yalnız OLASILIK varsa (dünya 'thunder').
   */
  weather(sc: { rain: number; snow: number; wind: number; thunder: number; sunnyHot: number; cold: number; tMean: number }, when: number, dur: number, seed: number) {
    const ac = this.ctx(), rnd = seeded(seed), out = this.out(), end = when + dur;
    const layer = (type: BiquadFilterType, f: number, q: number, peak: number, atk = 0.8, rel = 1.2) => {
      const s = ac.createBufferSource(); s.buffer = this.noise(); s.loop = true;
      const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = ac.createGain(); s.connect(fl).connect(g).connect(out);
      g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(peak, when + atk); g.gain.setValueAtTime(peak, end - rel); g.gain.linearRampToValueAtTime(0.0001, end);
      s.start(when, rnd() * 1.5); s.stop(end + 0.05); return g;
    };
    if (sc.rain > 0.01) { // yağmur: sürekli hışırtı + damlalar (stereo dağınık)
      layer('highpass', 1200 + 1800 * sc.rain, 0.5, 0.05 + 0.18 * sc.rain);
      const n = Math.round(dur * (6 + 70 * sc.rain));
      for (let k = 0; k < n; k++) {
        const t = when + 0.3 + rnd() * (dur - 0.6), p = ac.createStereoPanner(); p.pan.value = rnd() * 2 - 1; p.connect(out);
        const s = ac.createBufferSource(); s.buffer = this.noise(); const fl = ac.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 2500 + 3000 * rnd(); fl.Q.value = 2;
        const g = ac.createGain(); s.connect(fl).connect(g).connect(p);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05 + 0.08 * rnd(), t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
        s.start(t, rnd() * 1.8); s.stop(t + 0.05);
      }
    }
    if (sc.snow > 0.01) { layer('lowpass', 380, 0.4, 0.05 + 0.05 * sc.snow, 1.2, 1.5); layer('bandpass', 900, 3, 0.02 + 0.03 * sc.snow, 1.5, 1.5); } // boğuk yumuşak sessizlik + ıslıklı hafif rüzgâr
    if (sc.wind > 0.05) { // rüzgâr: hıza göre uğultu; esinti dalgalanması
      const g = layer('bandpass', 350 + 700 * sc.wind, 0.8, 0.04 + 0.16 * sc.wind);
      const lfo = ac.createOscillator(); lfo.frequency.value = 0.2 + 0.3 * rnd(); const d = ac.createGain(); d.gain.value = 0.03 + 0.08 * sc.wind; lfo.connect(d).connect(g.gain); lfo.start(when); lfo.stop(end + 0.05);
    }
    if (sc.sunnyHot > 0.05) this.world(worldParams('heat', sc.tMean, 1, 0), when, dur, 0, seed + 1, 0.4 + 0.6 * sc.sunnyHot);
    if (sc.cold > 0.05) this.world(worldParams('heat', sc.tMean, 0, 0.2), when, dur, 0, seed + 2, 0.4 + 0.6 * sc.cold);
    if (sc.thunder > 0.01) this.world(worldParams('thunder', 0, 0.3 + 0.7 * sc.thunder, 0.5), when + 0.5, dur - 1, (rnd() * 2 - 1) * 0.6, seed + 3, 1);
  }

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
