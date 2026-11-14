// Ses dünyası temaları ("Dinle" sekmesinin üstü): büyük kartlar — ikon + ad + tek satır açıklama; seçili olan vurgulu.
import type { Lang } from '../i18n.ts';

export const THEME_NAMES: { tr: string; en: string; icon: string; dTr: string; dEn: string }[] = [
  { tr: 'Çöl ve Toz', en: 'Desert and dust', icon: '🏜️', dTr: 'Kum fırtınası, yangın, sıcak hava', dEn: 'Sandstorm, fire, hot air' },
  { tr: 'Fırtına', en: 'Storm', icon: '⛈️', dTr: 'Gök gürültüsü ve dalgalar', dEn: 'Thunder and waves' },
  { tr: 'Okyanus', en: 'Ocean', icon: '🌊', dTr: 'Dalgalar, serpinti, deniz havası', dEn: 'Waves, spray, sea air' },
  { tr: 'Şehirler ve Ormanlar', en: 'Cities and forests', icon: '🌃', dTr: 'Şehir uğultusu, kuşlar, yapraklar', dEn: 'City hum, birds, leaves' },
  { tr: 'Sıcak ve Soğuk', en: 'Hot and cold', icon: '🌡️', dTr: 'Ağustos böceği ↔ buzlu rüzgâr, dalga', dEn: 'Cicadas ↔ icy wind, waves' },
];

export function WorldThemes({ lang, active, onPick }: { lang: Lang; active: string | null; onPick: (i: number) => void }) {
  const en = lang === 'en';
  return (
    <section className="themes" aria-labelledby="wthemes-h">
      <h3 className="sec-title" id="wthemes-h">{en ? 'Ready-made themes' : 'Hazır temalar'}</h3>
      <div className="tcards" role="group" aria-labelledby="wthemes-h">
        {THEME_NAMES.map((t, i) => (
          <button key={t.tr} type="button" className="tcard" aria-pressed={active === t.tr} onClick={() => onPick(i)}>
            <span className="tcard-ico" aria-hidden="true">{t.icon}</span>
            <span className="tcard-txt"><b>{en ? t.en : t.tr}</b><small>{en ? t.dEn : t.dTr}</small></span>
          </button>
        ))}
      </div>
    </section>
  );
}
