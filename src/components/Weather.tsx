// "Meteorolog": NASA GEOS-FP tahmini (statik dosya, internetsiz). Bugünün kartı + gün düğmeleri; her düğme o günün SES SAHNESİNİ çalar ve anlatır.
// Her zaman: kaynak + çalıştırma saati + "model tahmini, resmi uyarı değildir"; dosya 24 saatten eskiyse tarih uyarısı.
import { engine } from '../audio/engine.ts';
import type { LatLon } from '../lib/geo.ts';
import { COND_ICON, condText, dayName, localDate, nowCond, sourceLine, spokenDetail, spokenSummary, staleLine, weatherScene, windText, type Forecast } from '../lib/forecast.ts';
import { seedOf } from '../lib/worlds.ts';
import { weatherMusic } from '../lib/music.ts';
import { Dialog } from './Shell.tsx';
import { speech } from '../audio/speech.ts';

/** Anlatımdan önce kaç sn ses. */
export const WX_LEAD = 2;
/** Hava sahnesini (doğa + müzik) çal; WX_LEAD sn sonra anlat. Süre metnin uzunluğuna göre (anlatım + 2 sn kuyruk). */
export function playThenSay(sc: ReturnType<typeof weatherScene>, key: string, d: Parameters<typeof weatherMusic>[0] | undefined, text: string,
  announce: (t: string) => void, o: { music: boolean; nature: boolean }) {
  engine.unlock(); const t0 = engine.now + 0.1;
  const dur = Math.min(40, WX_LEAD + 2.5 + text.length * 0.07 / speech.rate);
  if (o.nature) engine.weather(sc, t0, dur, seedOf('weather', key));
  if (o.music && d) { // hava durumu müziği (günün verisinden; doğanın altında)
    const m = weatherMusic(d), md = dur - 0.5, n = Math.max(1, Math.round(m.notesPerSec * md));
    for (let k = 0; k < n; k++) engine.musicNote(m.instr, m.instr === 'harp' ? m.freqs : [m.freqs[k % m.freqs.length]], t0 + (k * md) / n, Math.max(0.6, md / n * 1.4), o.nature ? 0.3 : 0.6, ((k % 3) - 1) * 0.4);
    if (m.timpani) for (let k = 0; k < Math.floor(md / 2); k++) engine.musicNote('timpani', [m.freqs[0] / 4], t0 + 1 + k * 2, 1.5, o.nature ? 0.35 : 0.6, 0);
  }
  // önceki konuşma (ör. "Anlaşıldı: …") bitene kadar bekle, ama en az WX_LEAD sn ses duyulsun
  const start = Date.now();
  const tick = () => { if (Date.now() - start >= WX_LEAD * 1000 && (!speech.active || Date.now() - start > 6000)) announce(text); else setTimeout(tick, 150); };
  setTimeout(tick, WX_LEAD * 1000);
}
/** Şu anın sahnesi + müzik girdisi. */
export function nowSceneOf(F: Forecast, p: LatLon, now = Date.now()) {
  const s = F.sample(F.nowStep(now), p);
  const d = { tMean: s.t, precipMm: s.precip * 24, snowMm: s.snow * 24, convMm: s.conv * 24, wind: s.wind, thunderChance: s.conv * 24 >= 5 && s.conv >= 0.5 * s.precip, cloud: s.cloud };
  return { s, d, sc: weatherScene(d) };
}

interface Props {
  open: boolean; onClose: () => void; lang: 'tr' | 'en';
  forecast: Forecast | null; error: string | null;
  target: (LatLon & { name: string }) | null;
  announce: (t: string) => void;
  music?: boolean; nature?: boolean;
  /** Panel sekmesinde (pencere yerine) göster. */
  inline?: boolean;
}

export function Weather({ open, onClose, lang, forecast: F, error, target, announce, music = true, nature = true, inline = false }: Props) {
  const en = lang === 'en';
  const now = Date.now(), todayIso = localDate(now);
  /** Önce ses (~2 sn), sonra anlatım; ses anlatım boyunca kısık sürer (konuşma kısması), bitince normale döner. */
  const play = (sc: ReturnType<typeof weatherScene>, key: string, d: Parameters<typeof weatherMusic>[0] | undefined, text: string) => playThenSay(sc, key, d, text, announce, { music, nature });
  let body: React.ReactNode;
  if (error) body = <p role="alert">{en ? 'The forecast file could not be loaded. The rest of the app keeps working.' : 'Tahmin dosyası yüklenemedi. Uygulamanın geri kalanı çalışmaya devam eder.'} <small className="muted">({error})</small></p>;
  else if (!F) body = <p role="status">{en ? 'Loading forecast…' : 'Tahmin yükleniyor…'}</p>;
  else if (!target) body = <p>{en ? 'Choose a place first (for example say "Earth, go to Ankara").' : 'Önce bir yer seç (örneğin "Dünya, Ankara\'ya git" de).'}</p>;
  else {
    const s = F.sample(F.nowStep(now), target), days = F.days(target).filter((d) => d.date >= todayIso), c = nowCond(s), stale = staleLine(F.meta, F.ageHours(now), lang);
    const ns = nowSceneOf(F, target, now);
    body = (
      <>
        <section className="wx-today" aria-labelledby="wx-today-h">
          <h3 id="wx-today-h" className="eyebrow">{en ? 'Now' : 'Şu an'} · {target.name}</h3>
          <p className="wx-big"><span aria-hidden="true">{COND_ICON[c]}</span> {Number.isNaN(s.t) ? '—' : `${Math.round(s.t)} °C`}</p>
          <p>{condText(c, lang)}, {windText(s.wind, lang)} ({Math.round(s.wind)} m/s)</p>
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => play(ns.sc, `now-${target.lat}-${target.lon}`, ns.d, spokenSummary(F, target.name, target, lang, now))}>{en ? 'Listen: now + week' : 'Dinle: şu an + hafta'}</button>
            <button type="button" className="btn" onClick={() => announce(spokenDetail(F, target, lang, now))}>{en ? 'More detail' : 'Daha fazla'}</button>
          </div>
        </section>
        <h3 className="eyebrow" id="wx-days-h">{en ? `${days.length}-day forecast` : `${days.length} günlük tahmin`}{days.length < 7 ? (en ? ` (from today; the run covers ${days.length} more days)` : ` (bugünden itibaren; çalıştırma ${days.length} günü kapsıyor)`) : ''}</h3>
        <ul className="wx-days" aria-labelledby="wx-days-h">
          {days.map((d) => {
            const name = dayName(d.date, todayIso, lang);
            const txt = `${name}: ${Math.round(d.tMin)}–${Math.round(d.tMax)} °C, ${condText(d.cond, lang)}${d.thunderChance ? (en ? ', chance of thunderstorms' : ', gök gürültülü sağanak olasılığı') : ''}, ${en ? 'precipitation' : 'yağış'} ${d.precipMm.toFixed(1)} mm, ${windText(d.wind, lang)}.`;
            return (
              <li key={d.date}>
                <button type="button" className="wx-day" aria-label={txt} onClick={() => play(weatherScene(d), `${d.date}-${target.lat}-${target.lon}`, d, txt)}>
                  <b>{name}</b><span aria-hidden="true" className="wx-ico">{COND_ICON[d.cond]}</span><span>{Math.round(d.tMax)}° / {Math.round(d.tMin)}°</span>
                  {d.thunderChance && <small>{en ? 'thunder?' : 'gök gürültüsü olasılığı'}</small>}
                </button>
              </li>
            );
          })}
        </ul>
        {stale && <p className="wx-stale" role="note">{stale}</p>}
      </>
    );
  }
  const src = F && <p className="small wx-src">{sourceLine(F.meta, lang)} <span className="muted">{en ? 'Grid 2° × 2.5°; daily precipitation estimated from 4 samples.' : 'Izgara 2° × 2.5°; günlük yağış 4 örnekten tahmini.'}</span></p>;
  if (inline) return <section className="wx-inline" aria-label={en ? 'Weather' : 'Hava durumu'}><h3 className="sec-title">{en ? 'Meteorologist' : 'Meteorolog'}{target ? ` — ${target.name}` : ''}</h3>{body}{src}</section>;
  return (
    <Dialog open={open} onClose={onClose} title={en ? `Meteorologist${target ? ' — ' + target.name : ''}` : `Meteorolog${target ? ' — ' + target.name : ''}`} lang={lang}>
      {body}
      {F && <p className="small wx-src">{sourceLine(F.meta, lang)} <span className="muted">{en ? `Grid 2° × 2.5°; daily precipitation estimated from 4 samples.` : `Izgara 2° × 2.5°; günlük yağış 4 örnekten tahmini.`}</span></p>}
    </Dialog>
  );
}
