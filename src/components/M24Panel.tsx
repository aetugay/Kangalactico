// 2024 aylık NASA katmanları paneli (MERRA-2 + OCO-2 GEOS L3; Ceyhun'un paketinden denetimden geçenler).
// Her katman: aç/kapa, küre üstünde göster, bilgi kartı (kaynak ürün + değişken + çözünürlük + yıl + NASA eşleşmesi).
import { useRef, useState } from 'react';
import { engine } from '../audio/engine.ts';
import type { LatLon } from '../lib/geo.ts';
import { INSTRUMENT_LABEL, type M24 } from '../lib/m24.ts';
import { monthName } from '../lib/co2.ts';
import { noteHz, PARTS } from '../lib/radar.ts';

interface Props {
  lang: 'tr' | 'en';
  m24: M24 | null;
  loading: boolean;
  onOpen: () => void;
  on: Record<string, boolean>;
  setOn: (id: string, v: boolean) => void;
  visualId: string | null;
  onShow: (id: string) => void;
  month: number;
  place: (LatLon & { name: string }) | null;
  announce: (t: string) => void;
}

export function M24Panel({ lang, m24, loading, onOpen, on, setOn, visualId, onShow, month, place, announce }: Props) {
  const en = lang === 'en';
  const [busy, setBusy] = useState(false);
  const run = useRef(0);

  /** Seçili yerin 2024'teki 365 günlük CO₂'si: her gün bir nota (keman); veri olmayan gün sessiz. */
  const listenDaily = async () => {
    if (!m24 || !place) return;
    if (busy) { run.current++; setBusy(false); announce(en ? 'Stopped.' : 'Durduruldu.'); return; }
    engine.unlock(); setBusy(true);
    const my = ++run.current;
    try {
      if (!m24.dailyLoaded) { announce(en ? 'Loading 365 days of carbon dioxide…' : '365 günlük karbondioksit yükleniyor…'); await m24.loadDaily(import.meta.env.BASE_URL); }
      const L = m24.meta.layers.find((l) => l.daily)!;
      const s = m24.dailyCo2(place);
      const valid = s.map((v, d) => ({ v, d })).filter((x) => !Number.isNaN(x.v));
      if (!valid.length) { announce(en ? 'No daily data here.' : 'Burada günlük veri yok.'); return; }
      const hi = valid.reduce((a, b) => (b.v > a.v ? b : a)), lo = valid.reduce((a, b) => (b.v < a.v ? b : a));
      const day = (d: number) => new Date(Date.UTC(2024, 0, 1 + d)).toLocaleDateString(en ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
      announce(en ? `${place.name}, 2024: 365 days of carbon dioxide, one note per day. Highest ${hi.v.toFixed(1)} ppm on ${day(hi.d)}, lowest ${lo.v.toFixed(1)} ppm on ${day(lo.d)}.`
        : `${place.name}, 2024: karbondioksitin 365 günü, her gün bir nota. En yüksek ${hi.v.toFixed(1)} ppm, ${day(hi.d)}; en düşük ${lo.v.toFixed(1)} ppm, ${day(lo.d)}.`);
      const step = 0.055; // 365 gün ≈ 20 sn
      for (let c = 0; c < s.length; c += 30) {
        if (my !== run.current) return;
        const t0 = engine.now + 0.1;
        for (let d = c; d < Math.min(s.length, c + 30); d++) {
          const v = s[d]; if (Number.isNaN(v)) continue; // veri yok → sessiz
          const t = Math.max(0, Math.min(1, (v - L.vmin) / (L.vmax - L.vmin)));
          engine.voice('co2_24', noteHz(t, PARTS.co2_24), t0 + (d - c) * step, step * 1.6, t, 0);
        }
        await new Promise((r) => setTimeout(r, 30 * step * 1000));
      }
    } catch (e) { announce(String(e)); }
    finally { if (my === run.current) setBusy(false); }
  };

  return (
    <details className="m24" onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) onOpen(); }}>
      <summary>{en ? '2024 monthly NASA layers (MERRA-2, OCO-2)' : '2024 aylık NASA katmanları (MERRA-2, OCO-2)'}</summary>
      <p className="small muted">{en ? 'Monthly means of 2024 on a 2° × 2.5° grid. Only layers that passed our data audit; names corrected to the real NASA product.' : '2024 aylık ortalamaları, 2° × 2.5° ızgara. Yalnız veri denetimimizden geçen katmanlar; adlar gerçek NASA ürününe göre düzeltildi.'}</p>
      {loading && <p className="small" role="status">{en ? 'Loading (2.7 MB)…' : 'Yükleniyor (2.7 MB)…'}</p>}
      {m24 && (
        <ul className="m24-list">
          {m24.meta.layers.map((L) => {
            const name = en ? L.en : L.tr, inst = INSTRUMENT_LABEL[L.id]?.[lang] ?? '';
            return (
              <li key={L.id}>
                <label className="switch">
                  <input type="checkbox" checked={!!on[L.id]} onChange={(e) => setOn(L.id, e.target.checked)} />
                  <span><b>{name}</b> <small className="muted">· {inst}</small></span>
                </label>
                {on[L.id] && visualId !== L.id && <button type="button" className="mini" onClick={() => onShow(L.id)}>{en ? 'Show on globe' : 'Küre üstünde göster'}</button>}
                <details className="m24-info">
                  <summary>{en ? `About: ${name}` : `Bilgi: ${name}`}</summary>
                  <dl>
                    <dt>{en ? 'Source product' : 'Kaynak ürün'}</dt><dd>{L.product}</dd>
                    <dt>{en ? 'Variable' : 'Değişken'}</dt><dd>{L.variable}{L.unit ? ` (${L.unit})` : ''}</dd>
                    <dt>{en ? 'Resolution' : 'Çözünürlük'}</dt><dd>{m24.meta.grid.cell} {en ? '(about 220 × 280 km at the equator)' : '(ekvatorda yaklaşık 220 × 280 km)'}</dd>
                    <dt>{en ? 'Year' : 'Yıl'}</dt><dd>{m24.meta.year} · {en ? 'month' : 'ay'}: {monthName(month, lang)}{L.daily ? (en ? ' · daily series available' : ' · günlük seri var') : ''}</dd>
                    <dt>{en ? 'NASA match' : 'NASA eşleşmesi'}</dt><dd>{L.nasa}</dd>
                    {L.sourceLabel !== L.tr && <><dt>{en ? 'Original label' : 'Paketteki ad'}</dt><dd>{L.sourceLabel} {en ? '(corrected)' : '(düzeltildi)'}</dd></>}
                    {L.note && <><dt>{en ? 'Note' : 'Not'}</dt><dd>{L.note}</dd></>}
                    <dt>{en ? 'Limits' : 'Sınırlar'}</dt><dd>{en ? `Values are clipped to ${L.vmin}…${L.vmax} (about the 2nd–98th percentile); values at the limits are read as ≥ / ≤.` : `Değerler ${L.vmin}…${L.vmax} aralığına kırpılmış (yaklaşık %2–%98 yüzdelik); sınırdaki değerler ≥ / ≤ diye okunur.`}</dd>
                  </dl>
                </details>
                {L.daily && place && (
                  <button type="button" className="mini" onClick={listenDaily}>
                    {busy ? (en ? 'Stop' : 'Durdur') : (en ? `Listen to 365 days of 2024 at ${place.name} (9 MB)` : `${place.name}: 2024'ün 365 gününü dinle (9 MB)`)}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="small muted">{en ? 'Data: NASA GES DISC (MERRA-2, OCO-2 GEOS L3), prepared by our team member Ceyhun.' : 'Veri: NASA GES DISC (MERRA-2, OCO-2 GEOS L3); ekibimizden Ceyhun hazırladı.'} {en ? 'Audit:' : 'Denetim:'} data/audit_ceyhun.md</p>
    </details>
  );
}
