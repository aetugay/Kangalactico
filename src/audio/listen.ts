// Sesli komut: tarayıcının konuşma tanıması (Web Speech API; Chrome ve Edge).
// Mikrofon izni ve internet gerekir (tanıma tarayıcının servisinde yapılır). Desteklenmiyorsa `supported` false olur.
//  - listener.once / hold: bas-konuş (Boşluk basılı tut, Konuş düğmesini basılı tut)
//  - handsFree: eller serbest SÜREKLİ dinleme (varsayılan açık); bitince/hata verince kendini yeniden başlatır.
//    EarthEar'in kendi sesi (speechSynthesis) konuşurken başlayan konuşmalar YOK SAYILIR (kendi sesini komut sanmasın).
export type ListenError = 'unsupported' | 'denied' | 'nospeech' | 'network' | 'other';

interface Rec {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart?: (() => void) | null;
  onspeechend?: (() => void) | null;
  start(): void; abort(): void; stop(): void;
}
type RecCtor = new () => Rec;

const Ctor: RecCtor | undefined = typeof window === 'undefined' ? undefined
  : ((window as unknown as { SpeechRecognition?: RecCtor }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: RecCtor }).webkitSpeechRecognition);

const mapErr = (e: string): ListenError => (e === 'not-allowed' || e === 'service-not-allowed' ? 'denied' : e === 'no-speech' ? 'nospeech' : e === 'network' ? 'network' : 'other');
const altsOf = (res: ArrayLike<{ transcript: string }>) => { const a: string[] = []; for (let i = 0; i < res.length; i++) { const t = res[i].transcript.trim(); if (t) a.push(t); } return a; };

/** EarthEar'in kendi sesi şu an (ya da az önce) konuşuyor mu? Yankı süzgeci için. */
let lastSpoke = 0;
const selfSpeaking = () => {
  const s = typeof speechSynthesis !== 'undefined' && (speechSynthesis.speaking || speechSynthesis.pending);
  if (s) lastSpoke = Date.now();
  return s || Date.now() - lastSpoke < 700;
};
if (typeof window !== 'undefined') setInterval(selfSpeaking, 150);

let current: Rec | null = null;

export const listener = {
  supported: !!Ctor,
  get active() { return !!current; },
  /** Dinlemeyi iptal et. */
  cancel() { try { current?.abort(); } catch { /* yok say */ } current = null; },
  /** Bas-konuş (basılı tutma) dinlemesini bitir: söylenen işlenir. */
  finish() { try { current?.stop(); } catch { /* yok say */ } },
  /**
   * Bir kez dinle. hold = true: tuş bırakılana (finish) kadar dinler, sonra söyleneni verir.
   * Söylenen her aday metin `onText`'e verilir; anlaşılmazsa ya da hata olursa `onError`. Bitince `onEnd`.
   */
  once(lang: 'tr' | 'en', onText: (alternatives: string[]) => void, onError: (e: ListenError) => void, onEnd: () => void, hold = false) {
    if (!Ctor) { onError('unsupported'); onEnd(); return; }
    this.cancel(); handsFree.pause();
    const r = new Ctor();
    r.lang = lang === 'tr' ? 'tr-TR' : 'en-US';
    r.continuous = hold; r.interimResults = false; r.maxAlternatives = 4;
    let failed = false; const parts: string[][] = [];
    r.onresult = (e) => { for (let i = e.resultIndex ?? 0; i < e.results.length; i++) { const a = altsOf(e.results[i]); if (a.length) parts.push(a); } };
    r.onerror = (e) => { failed = true; if (e.error === 'aborted') return; onError(mapErr(e.error)); };
    r.onend = () => {
      if (current === r) current = null;
      if (parts.length) onText(parts.length === 1 ? parts[0] : [parts.map((p) => p[0]).join(' '), ...parts[parts.length - 1]]);
      else if (!failed) onError('nospeech');
      onEnd(); handsFree.resume();
    };
    current = r;
    try { r.start(); } catch { current = null; onError('other'); onEnd(); handsFree.resume(); }
  },
};

type HFHandlers = {
  onText: (alts: string[]) => void;
  onError: (e: ListenError) => void;
  onSpeech: (talking: boolean) => void; // kullanıcı konuşmaya başladı/bitirdi (müziği kıs/aç)
};
/** Eller serbest sürekli dinleme. */
export const handsFree = {
  enabled: false,
  private_rec: null as Rec | null,
  paused: false,
  lang: 'tr' as 'tr' | 'en',
  h: null as HFHandlers | null,
  fails: 0,
  get running() { return !!this.private_rec; },
  start(lang: 'tr' | 'en', h: HFHandlers) {
    if (!Ctor) { h.onError('unsupported'); return; }
    this.enabled = true; this.lang = lang; this.h = h; this.fails = 0; this.paused = false;
    this.spawn();
  },
  stop() { this.enabled = false; this.kill(); },
  pause() { this.paused = true; this.kill(); },
  resume() { this.paused = false; if (this.enabled && !this.private_rec) setTimeout(() => this.spawn(), 250); },
  setLang(l: 'tr' | 'en') { if (this.lang === l) return; this.lang = l; if (this.enabled && !this.paused) { this.kill(); setTimeout(() => this.spawn(), 250); } },
  kill() { const r = this.private_rec; this.private_rec = null; try { r?.abort(); } catch { /* yok say */ } },
  spawn() {
    if (!Ctor || !this.enabled || this.paused || this.private_rec || current) return;
    const r = new Ctor();
    r.lang = this.lang === 'tr' ? 'tr-TR' : 'en-US';
    r.continuous = true; r.interimResults = false; r.maxAlternatives = 4;
    let echo = false; // bu konuşma parçası bizim sesimiz konuşurken başladı
    r.onspeechstart = () => { echo = selfSpeaking(); if (!echo) this.h?.onSpeech(true); };
    r.onspeechend = () => { this.h?.onSpeech(false); };
    r.onresult = (e) => {
      for (let i = e.resultIndex ?? 0; i < e.results.length; i++) {
        const res = e.results[i]; if (res.isFinal === false) continue;
        const a = altsOf(res);
        if (!a.length) continue;
        if (echo || selfSpeaking()) { echo = false; continue; } // kendi rehber sesimiz → yok say
        this.fails = 0;
        this.h?.onText(a);
      }
      echo = false;
    };
    r.onerror = (e) => {
      if (e.error === 'aborted' || e.error === 'no-speech') return; // sessizlik: sessizce yeniden başlar
      const err = mapErr(e.error);
      if (err === 'denied') { this.enabled = false; this.h?.onError('denied'); return; }
      if (++this.fails >= 3) { this.enabled = false; this.h?.onError(err); }
    };
    r.onend = () => {
      if (this.private_rec === r) this.private_rec = null;
      this.h?.onSpeech(false);
      if (this.enabled && !this.paused) setTimeout(() => this.spawn(), this.fails ? 1200 : 200);
    };
    this.private_rec = r;
    try { r.start(); } catch { this.private_rec = null; if (this.enabled) setTimeout(() => this.spawn(), 1000); }
  },
};
