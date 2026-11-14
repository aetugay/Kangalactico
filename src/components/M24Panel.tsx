// Aylık NASA katmanları paneli (MERRA-2 2024 + OCO-2 GEOS L3 2021; Ceyhun'un paketi sürüm 3, yalnız denetimden geçenler).
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
  /** Hazır seçim (preset): yalnız UYGUN katmanlar; removed = denetimden geçmediği için çıkarılanlar. */
  onPreset?: (ids: string[], name: string, removed: string[]) => void;
}

export function M24Panel({ lang, m24, loading, onOpen, on, setOn, visualId, onShow, month, place, announce, onPreset }: Props) {
  const en = lang === 'en';
  const [busy, setBusy] = useState(false);
  const run = useRef(0);

  /** Seçili yerin 365 günlük CO₂'si (yıl: meta.files.co2DailyStart): her gün bir nota (keman); veri olmayan gün sessiz. */
  const listenDaily = async () => {
    if (!m24 || !place) return;
    if (busy) { run.current++; setBusy(false); announce(en ? 'Stopped.' : 'Durduruldu.'); return; }
    engine.unlock(); setBusy(true);
    const my = ++run.current;
    try {
      if (!m24.dailyLoaded) { announce(en ? 'Loading 365 days of carbon dioxide…' : '365 günlük karbondioksit yükleniyor…'); await m24.loadDaily(import.meta.env.BASE_URL); }
      const s = m24.dailyCo2(place);
      const valid = s.map((v, d) => ({ v, d })).filter((x) => !Number.isNaN(x.v));
      if (!valid.length) { announce(en ? 'No daily data here.' : 'Burada günlük veri yok.'); return; }
      const hi = valid.reduce((a, b) => (b.v > a.v ? b : a)), lo = valid.reduce((a, b) => (b.v < a.v ? b : a));
      const dYear = +(m24.meta.files.co2DailyStart ?? '2021').slice(0, 4);
      const day = (d: number) => new Date(Date.UTC(dYear, 0, 1 + d)).toLocaleDateString(en ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
      announce(en ? `${place.name}, ${dYear}: 365 days of carbon dioxide, one note per day; the lowest day is the lowest note, the highest day two octaves higher. Highest ${hi.v.toFixed(1)} ppm on ${day(hi.d)}, lowest ${lo.v.toFixed(1)} ppm on ${day(lo.d)}.`
        : `${place.name}, ${dYear}: karbondioksitin 365 günü, her gün bir nota; en düşük gün en pes, en yüksek gün iki oktav ince. En yüksek ${hi.v.toFixed(1)} ppm, ${day(hi.d)}; en düşük ${lo.v.toFixed(1)} ppm, ${day(lo.d)}.`);
      const step = 0.055; // 365 gün ≈ 20 sn
      for (let c = 0; c < s.length; c += 30) {
        if (my !== run.current) return;
        const t0 = engine.now + 0.1;
        for (let d = c; d < Math.min(s.length, c + 30); d++) {
          const v = s[d]; if (Number.isNaN(v)) continue; // veri yok → sessiz
          const t = hi.v > lo.v ? (v - lo.v) / (hi.v - lo.v) : 0.5; // yerel ölçek: bu yerin yılı (Adım 2)
          engine.voice('co2_24', noteHz(t, PARTS.co2_24, 'bilim'), t0 + (d - c) * step, step * 1.6, 0.3 + 0.7 * t, 0, t);
        }
        await new Promise((r) => setTimeout(r, 30 * step * 1000));
      }
    } catch (e) { announce(String(e)); }
    finally { if (my === run.current) setBusy(false); }
  };

  return (
    <details className="m24" onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) onOpen(); }}>
      <summary>{en ? 'Monthly NASA layers (MERRA-2 2024, OCO-2 2021)' : 'Aylık NASA katmanları (MERRA-2 2024, OCO-2 2021)'}</summary>
      <p className="small muted">{en ? 'Monthly means on a 2° × 2.5° grid (package version 3, no clipping). Only layers that passed our data audit; names follow the real NASA product in the evidence (kanit).' : 'Aylık ortalamalar, 2° × 2.5° ızgara (paket sürüm 3, uç değer kırpması yok). Yalnız veri denetimimizden geçen katmanlar; adlar kanıttaki gerçek NASA ürününe göre.'}</p>
      {loading && <p className="small" role="status">{en ? 'Loading (3.6 MB)…' : 'Yükleniyor (3.6 MB)…'}</p>}
      {m24 && !!m24.meta.presets?.length && onPreset && (
        <div className="m24-presets" role="group" aria-label={en ? 'Presets' : 'Hazır seçimler'}>
          {m24.meta.presets.map((p) => (
            <button key={p.key} type="button" className="chip small-chip" onClick={() => onPreset(p.layers, p.ad, p.removed)}
              title={p.removed.length ? (en ? `Removed (did not pass the audit): ${p.removed.join(', ')}` : `Çıkarıldı (denetimden geçmedi): ${p.removed.join(', ')}`) : undefined}>
              {p.ad}{p.removed.length ? ' *' : ''}
            </button>
          ))}
        </div>
      )}
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
                    <dt>{en ? 'Year' : 'Yıl'}</dt><dd>{L.year} · {en ? 'month' : 'ay'}: {monthName(month, lang)}{L.daily ? (en ? ' · daily series available' : ' · günlük seri var') : ''}</dd>
                    <dt>{en ? 'NASA match' : 'NASA eşleşmesi'}</dt><dd>{L.nasa}</dd>
                    {L.sourceLabel !== L.tr && <><dt>{en ? 'Original label' : 'Paketteki ad'}</dt><dd>{L.sourceLabel} {en ? '(corrected)' : '(düzeltildi)'}</dd></>}
                    {L.note && <><dt>{en ? 'Note' : 'Not'}</dt><dd>{L.note}</dd></>}
                    {L.kanit && <>
                      <dt>{en ? 'Evidence: collection' : 'Kanıt: koleksiyon'}</dt><dd>{L.kanit.nasa_koleksiyon}{L.kanit.nasa_koleksiyon !== L.product ? (en ? ` (NASA short name: ${L.product})` : ` (NASA kısa adı: ${L.product})`) : ''}</dd>
                      <dt>{en ? 'Evidence: NetCDF variable' : 'Kanıt: NetCDF değişkeni'}</dt><dd>{L.kanit.netcdf_degiskeni} — “{L.kanit.nasa_long_name}”</dd>
                      <dt>{en ? 'Evidence: original unit' : 'Kanıt: özgün birim'}</dt><dd>{L.kanit.orijinal_birim}{L.unit ? (en ? ` → shown as ${L.unit}` : ` → gösterilen: ${L.unit}`) : ''}</dd>
                      <dt>{en ? 'Evidence: sample granule' : 'Kanıt: örnek dosya'}</dt><dd className="mono">{L.kanit.ornek_granul_dosyasi}{L.kanit.dosya_sayisi ? ` · ${L.kanit.dosya_sayisi} ${en ? 'files' : 'dosya'}` : ''}</dd>
                    </>}
                    <dt>{en ? 'Range' : 'Aralık'}</dt><dd>{m24.meta.clipped
                      ? (en ? `Clipped to ${L.vmin}…${L.vmax}; values at the limits are read as ≥ / ≤.` : `${L.vmin}…${L.vmax} aralığına kırpılmış; sınırdaki değerler ≥ / ≤ diye okunur.`)
                      : (en ? `${L.vmin} … ${L.vmax} (full range, not clipped)` : `${L.vmin} … ${L.vmax} (tam aralık, kırpılmamış)`)}</dd>
                  </dl>
                </details>
                {L.daily && place && (
                  <button type="button" className="mini" onClick={listenDaily}>
                    {busy ? (en ? 'Stop' : 'Durdur') : (en ? `Listen to 365 days of ${(m24.meta.files.co2DailyStart ?? '2021').slice(0, 4)} at ${place.name} (9 MB)` : `${place.name}: ${(m24.meta.files.co2DailyStart ?? '2021').slice(0, 4)} yılının 365 gününü dinle (9 MB)`)}
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
