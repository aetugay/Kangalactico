// Web Audio motoru (demo/index.html'den taşındı). Tek örnek: `engine`.
// Ses yalnızca kullanıcı dokunuşu içinde unlock() çağrılınca başlar.

// 1 sn'lik sessiz WAV – iOS'ta sessiz düğme açıkken Web Audio'yu açmak için.
const SILENT =
  'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';

type Listener = (running: boolean) => void;

class AudioEngine {
  private ac: AudioContext | null = null;
  private master!: GainNode;
  private droneOsc!: OscillatorNode;
  private droneGain!: GainNode;
  private scanOsc!: OscillatorNode;
  private scanGain!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private unlocked = false;
  private listeners = new Set<Listener>();

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
    this.master.gain.value = 0.8;
    this.master.connect(comp).connect(ac.destination);

    // Genel seviyeyi izleyen yumuşak drone
    this.droneOsc = ac.createOscillator();
    this.droneOsc.type = 'sine';
    this.droneGain = ac.createGain();
    this.droneGain.gain.value = 0;
    this.droneOsc.connect(this.droneGain).connect(this.master);
    this.droneOsc.start();

    // Tarama modu için sürekli osilatör
    this.scanOsc = ac.createOscillator();
    this.scanOsc.type = 'triangle';
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    this.scanGain = ac.createGain();
    this.scanGain.gain.value = 0;
    this.scanOsc.connect(lp).connect(this.scanGain).connect(this.master);
    this.scanOsc.start();

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
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
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
    const ac = this.ctx();
    this.droneOsc.frequency.setTargetAtTime(freq, ac.currentTime, 0.3);
  }

  droneLevel(level: number) {
    if (!this.ac) return;
    this.droneGain.gain.setTargetAtTime(level, this.ac.currentTime, level > 0 ? 0.4 : 0.3);
  }

  scanTo(freq: number) {
    const ac = this.ctx();
    this.scanOsc.frequency.setTargetAtTime(freq, ac.currentTime, 0.02);
    this.scanGain.gain.setTargetAtTime(0.18, ac.currentTime, 0.03);
  }

  scanOff() {
    if (!this.ac) return;
    this.scanGain.gain.setTargetAtTime(0, this.ac.currentTime, 0.05);
  }

  // ---------------- Radar sesleri ----------------
  /** Ses saati (saniye). */
  get now(): number { return this.ctx().currentTime; }

  private panNode(pan: number): AudioNode {
    const ac = this.ctx();
    if (typeof ac.createStereoPanner === 'function') {
      const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
      p.connect(this.master); return p;
    }
    return this.master; // çok eski tarayıcı: stereo yok
  }

  private noise(): AudioBuffer {
    const ac = this.ctx();
    if (!this.noiseBuf) {
      this.noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.2, ac.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuf;
  }

  /**
   * Enstrüman sesi. timbre: katman türü; gain 0..1 (değer); pan -1..+1 (yön).
   * Her katmanın tınısı ayırt edilebilir olacak şekilde seçildi (lejantta tanıtılır).
   */
  voice(timbre: string, freq: number, when: number, dur: number, gain: number, pan: number) {
    if (gain <= 0.001) return;
    const ac = this.ctx();
    const out = this.panNode(pan);
    const g = ac.createGain();
    g.connect(out);
    const amp = 0.02 + gain * 0.16; // sessiz değil, ama değerle belirgin şekilde artar
    const env = (attack: number, decay: number, peak = amp) => {
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(peak, when + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);
    };
    const osc = (type: OscillatorType, f: number, level: number, dest: AudioNode, len: number) => {
      const o = ac.createOscillator(); o.type = type; o.frequency.value = f;
      const lg = ac.createGain(); lg.gain.value = level; o.connect(lg).connect(dest);
      o.start(when); o.stop(when + len + 0.05);
    };
    switch (timbre) {
      case 'co2': { // nefes: yumuşak atak, sinüs + bant geçiren gürültü (soluk)
        osc('sine', freq, 1, g, dur + 0.15); osc('sine', freq * 1.5, 0.12, g, dur + 0.15);
        const s = ac.createBufferSource(); s.buffer = this.noise(); s.loop = true;
        const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq * 2; bp.Q.value = 4;
        const ng = ac.createGain(); ng.gain.value = 0.35; s.connect(bp).connect(ng).connect(g); s.start(when); s.stop(when + dur + 0.2);
        env(0.08, dur + 0.1, amp * 0.9); break;
      }
      case 'temp': { // yumuşak telli: üçgen + oktav sinüs, alçak geçiren
        const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900 + freq * 3; f.connect(g);
        osc('triangle', freq, 1, f, dur); osc('sine', freq * 2, 0.2, f, dur);
        env(0.012, dur); break;
      }
      case 'black_carbon': { // marimba: sinüs + 4. harmonik, kısa
        osc('sine', freq, 1, g, 0.35); osc('sine', freq * 4, 0.25, g, 0.08);
        env(0.003, 0.3); break;
      }
      case 'dust': { // glockenspiel: parlak, inharmonik kısmi sesler
        osc('sine', freq, 1, g, 0.7); osc('sine', freq * 2.76, 0.35, g, 0.4); osc('sine', freq * 5.4, 0.15, g, 0.2);
        env(0.002, 0.6, amp * 0.8); break;
      }
      case 'sea_salt': { // koro/ped: akortsuz testere üçlüsü, yumuşak atak
        const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1100; f.connect(g);
        for (const d of [-7, 0, 7]) { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = d; const lg = ac.createGain(); lg.gain.value = 0.33; o.connect(lg).connect(f); o.start(when); o.stop(when + dur + 0.2); }
        env(0.06, dur + 0.1, amp * 0.7); break;
      }
      case 'sulfate': { // kare dalga çekme, filtre süpürmeli
        const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6;
        f.frequency.setValueAtTime(freq * 8, when); f.frequency.exponentialRampToValueAtTime(freq * 1.5, when + 0.15); f.connect(g);
        osc('square', freq, 0.6, f, 0.2);
        env(0.003, 0.18, amp * 0.8); break;
      }
      case 'lightning': { // olay alarmı: gürültü çatırtısı + alçak gümbürtü (inharmonik)
        const s = ac.createBufferSource(); s.buffer = this.noise();
        const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
        s.connect(hp).connect(g); s.start(when); s.stop(when + 0.15);
        osc('sine', 55 + freq * 0.05, 0.8, g, 0.25);
        env(0.002, 0.2, Math.min(0.35, amp * 1.6)); break;
      }
      default: osc('sine', freq, 1, g, dur); env(0.01, dur);
    }
  }

  /** Kuzey işareti: her tur başında kısa, ortada, yüksek "tık". */
  northTick(when: number) {
    const ac = this.ctx();
    const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = 2400;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.08, when + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
    o.connect(g).connect(this.master); o.start(when); o.stop(when + 0.05);
  }
}

export const engine = new AudioEngine();

/** Sesli anlatım; bitince çözülen Promise (lejant için sıralama). Ses yoksa süre tahminiyle çözülür. */
export function say(text: string, rate = 1.05): Promise<void> {
  return new Promise((resolve) => {
    const fallback = setTimeout(resolve, 600 + text.length * 70);
    if (!('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'tr-TR'; u.rate = rate;
      u.onend = () => { clearTimeout(fallback); resolve(); };
      u.onerror = () => { clearTimeout(fallback); resolve(); };
      speechSynthesis.speak(u);
    } catch { /* yok say */ }
  });
}
export const stopSpeech = () => { try { speechSynthesis.cancel(); } catch { /* yok say */ } };

/** Sadece Android'de çalışır; iOS web'de navigator.vibrate yok. */
export function vibrate(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch { /* yok say */ }
}

export function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'tr-TR';
    u.rate = 1.1;
    speechSynthesis.speak(u);
  } catch { /* yok say */ }
}
