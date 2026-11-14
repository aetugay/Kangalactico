// Sesli komut: tarayıcının konuşma tanıması (Web Speech API; Chrome ve Edge). Bas-konuş: bir kez dinler, metni verir.
// Mikrofon izni ve internet gerekir (tanıma tarayıcının servisinde yapılır). Desteklenmiyorsa `supported` false olur.
export type ListenError = 'unsupported' | 'denied' | 'nospeech' | 'network' | 'other';

interface Rec {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; abort(): void;
}
type RecCtor = new () => Rec;

const Ctor: RecCtor | undefined = typeof window === 'undefined' ? undefined
  : ((window as unknown as { SpeechRecognition?: RecCtor }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: RecCtor }).webkitSpeechRecognition);

let current: Rec | null = null;

export const listener = {
  supported: !!Ctor,
  get active() { return !!current; },
  /** Dinlemeyi iptal et. */
  cancel() { try { current?.abort(); } catch { /* yok say */ } current = null; },
  /**
   * Bir kez dinle. Söylenen her aday metin (en olasıdan başlayarak) `onText`'e verilir;
   * hiçbir şey anlaşılmazsa ya da hata olursa `onError` çağrılır. Bitince `onEnd`.
   */
  once(lang: 'tr' | 'en', onText: (alternatives: string[]) => void, onError: (e: ListenError) => void, onEnd: () => void) {
    if (!Ctor) { onError('unsupported'); onEnd(); return; }
    this.cancel();
    const r = new Ctor();
    r.lang = lang === 'tr' ? 'tr-TR' : 'en-US';
    r.continuous = false; r.interimResults = false; r.maxAlternatives = 4;
    let got = false, failed = false;
    r.onresult = (e) => {
      const alts: string[] = [];
      const res = e.results[0];
      for (let i = 0; res && i < res.length; i++) { const t = res[i].transcript.trim(); if (t) alts.push(t); }
      if (alts.length) { got = true; onText(alts); }
    };
    r.onerror = (e) => {
      failed = true;
      if (e.error === 'aborted') return; // biz iptal ettik
      onError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'denied' : e.error === 'no-speech' ? 'nospeech' : e.error === 'network' ? 'network' : e.error === 'aborted' ? 'other' : 'other');
    };
    r.onend = () => { if (current === r) current = null; if (!got && !failed) onError('nospeech'); onEnd(); };
    current = r;
    try { r.start(); } catch { current = null; onError('other'); onEnd(); }
  },
};
