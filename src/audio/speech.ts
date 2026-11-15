// Sesli rehber (tarayıcının konuşma sentezi). Ekran okuyucusu olmayan kullanıcı için her şeyi sesli söyler.
// İki öncelik: "öncelikli" konuşma (duyuru, özet, lejant) her şeyi keser; "ipucu" (düğme adı) öncelikliyi kesmez.
export type SpeechLang = 'tr' | 'en';

let lang: SpeechLang = 'tr';
let rateMul = 1;        // kullanıcının konuşma hızı tercihi
let token = 0;          // her yeni konuşma/iptal bir öncekini geçersiz kılar
let priority = false;   // öncelikli konuşma sürüyor mu
const listeners = new Set<(active: boolean) => void>();
const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

const emit = () => listeners.forEach((fn) => fn(priority));
const setPriority = (v: boolean) => { if (priority !== v) { priority = v; emit(); } };

function voiceFor(l: SpeechLang): SpeechSynthesisVoice | undefined {
  const vs = speechSynthesis.getVoices();
  return vs.find((v) => v.lang.toLowerCase().startsWith(l) && v.localService) ?? vs.find((v) => v.lang.toLowerCase().startsWith(l));
}

/** Uzun metni cümlelere böl (bazı tarayıcılar ~15 sn'den uzun tek parçayı yarıda keser). */
function chunks(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
}

function utter(text: string, rate: number): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'tr' ? 'tr-TR' : 'en-US';
  u.rate = rate * rateMul;
  const v = voiceFor(lang); if (v) u.voice = v;
  return u;
}

export const speech = {
  supported,
  setLang(l: SpeechLang) { lang = l; },
  setRate(mul: number) { rateMul = Math.max(0.6, Math.min(2, mul)); },
  /** Kullanıcının konuşma hızı çarpanı (0.8–2). */
  get rate() { return rateMul; },
  /** Öncelikli konuşma sürerken true (özet/lejant düğmelerini "durdur"a çevirmek için). */
  get active() { return priority; },
  onChange(fn: (active: boolean) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },

  /** Her şeyi sustur. */
  stop() {
    token++;
    setPriority(false);
    if (supported) try { speechSynthesis.cancel(); } catch { /* yok say */ }
  },

  /** Öncelikli konuşma: süren her şeyi keser. Bitince (ya da kesilince) çözülür; true = sonuna kadar okundu. */
  say(text: string, rate = 1.05): Promise<boolean> {
    return new Promise((resolve) => {
      if (!supported || !text.trim()) { resolve(true); return; }
      const my = ++token;
      try { speechSynthesis.cancel(); } catch { /* yok say */ }
      setPriority(true);
      const parts = chunks(text);
      let left = parts.length;
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return; done = true;
        clearInterval(watch);
        if (my === token) setPriority(false);
        resolve(ok);
      };
      // güvenlik: onend gelmezse (bazı tarayıcılar) süre tahminiyle bitir; iptal edildiyse hemen bitir
      const limit = Date.now() + 2500 + text.length * 110;
      const watch = setInterval(() => { if (my !== token) finish(false); else if (Date.now() > limit) finish(true); }, 120);
      for (const p of parts) {
        const u = utter(p, rate);
        u.onend = () => { if (my !== token) finish(false); else if (--left <= 0) finish(true); };
        u.onerror = () => finish(my === token && left <= 1);
        try { speechSynthesis.speak(u); } catch { finish(false); }
      }
    });
  },

  /** İpucu (düğme adı): öncelikli konuşmayı kesmez; önceki ipucunu keser. */
  hint(text: string) {
    if (!supported || priority || !text.trim()) return;
    token++;
    try { speechSynthesis.cancel(); speechSynthesis.speak(utter(text, 1.15)); } catch { /* yok say */ }
  },
};

if (supported) { try { speechSynthesis.getVoices(); } catch { /* bazı tarayıcılar sesleri geç yükler */ } }
