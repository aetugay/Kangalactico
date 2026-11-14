// Ses dünyası temaları (katmanlar panelinin üstü): bir dokunuşla birkaç ses dünyasını birlikte aç.
import type { Lang } from '../i18n.ts';

export const THEME_NAMES: { tr: string; en: string }[] = [
  { tr: 'Çöl ve Toz', en: 'Desert and dust' }, { tr: 'Fırtına', en: 'Storm' }, { tr: 'Okyanus', en: 'Ocean' },
  { tr: 'Şehirler ve Ormanlar', en: 'Cities and forests' }, { tr: 'Sıcak ve Soğuk', en: 'Hot and cold' },
];

export function WorldThemes({ lang, active, onPick }: { lang: Lang; active: string | null; onPick: (i: number) => void }) {
  const en = lang === 'en';
  return (
    <div className="themes">
      <h4 className="eyebrow" id="wthemes-h">{en ? 'Ready-made themes' : 'Hazır temalar'}</h4>
      <div className="m24-presets" role="group" aria-labelledby="wthemes-h">
        {THEME_NAMES.map((t, i) => (
          <button key={t.tr} type="button" className="chip small-chip theme-chip" aria-pressed={active === t.tr} onClick={() => onPick(i)}>{en ? t.en : t.tr}</button>
        ))}
      </div>
    </div>
  );
}
