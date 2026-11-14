// Enstrüman simgeleri — basit, kendi çizimimiz (inline SVG, currentColor). Hepsi dekoratif: aria-hidden.
const S = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

/** Nefes / rüzgâr kıvrımları — CO₂ */
export const IconBreath = () => (
  <svg {...S}><path d="M3 9h11a3 3 0 1 0-3-3" /><path d="M3 14h15a3 3 0 1 1-3 3" /><path d="M3 19h6" /></svg>
);
/** Teller — yüzey sıcaklığı (yumuşak telli ses) */
export const IconStrings = () => (
  <svg {...S}><path d="M6 3c-2 6-2 12 0 18" /><path d="M18 3c2 6 2 12 0 18" /><path d="M10 4v16" /><path d="M14 4v16" /></svg>
);
/** Dalga — deniz yüzeyi sıcaklığı */
export const IconWave = () => (
  <svg {...S}><path d="M2 9c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-2 5-1" /><path d="M2 15c2.5-3 5-3 7.5 0s5 3 7.5 0 3.5-2 5-1" /></svg>
);
/** Marimba çubukları + noktalar — aerosoller (4 enstrüman) */
export const IconBars = () => (
  <svg {...S}><path d="M4 6v12" /><path d="M9 8v8" /><path d="M14 5v14" /><path d="M19 9v6" /><circle cx="6.5" cy="3" r="0.6" fill="currentColor" /><circle cx="16.5" cy="21" r="0.6" fill="currentColor" /></svg>
);
/** Şimşek — yıldırım (olay alarmı) */
export const IconBolt = () => (
  <svg {...S}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
);
export const IconPin = () => (
  <svg {...S}><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
);
export const IconPlay = () => (<svg {...S}><path d="M7 4v16l13-8z" fill="currentColor" /></svg>);
export const IconPause = () => (<svg {...S}><path d="M7 4h3v16H7zM14 4h3v16h-3z" fill="currentColor" /></svg>);
export const IconHeadphones = () => (<svg {...S}><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="14" width="4" height="7" rx="1.5" /><rect x="17" y="14" width="4" height="7" rx="1.5" /></svg>);
export const IconSpeak = () => (<svg {...S}><path d="M4 9h4l5-4v14l-5-4H4z" /><path d="M17 9a4 4 0 0 1 0 6" /><path d="M19.5 6.5a8 8 0 0 1 0 11" /></svg>);
export const IconInfo = () => (<svg {...S}><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><path d="M12 7.5v.5" /></svg>);
export const IconContrast = () => (<svg {...S}><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" /></svg>);
export const IconGlobe = () => (<svg {...S}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" /></svg>);
