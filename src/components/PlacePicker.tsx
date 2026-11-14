import { useEffect, useId, useRef, useState } from 'react';
import { countryName, placeLabel, rowToPlace, type Cities, type CityRow, type Place } from '../lib/places.ts';

interface Props {
  cities: Cities | null;
  place: Place | null;
  onPick: (p: Place) => void;
  announce: (t: string) => void;
  autoFocus?: boolean;
}

function AutoFocus({ target }: { target: React.RefObject<HTMLInputElement | null> }) {
  useEffect(() => { const t = setTimeout(() => target.current?.focus(), 30); return () => clearTimeout(t); }, [target]);
  return null;
}

/**
 * Şehir arama: WAI-ARIA 1.2 combobox (liste kutusu açılır, ↑/↓ seçenek, Enter seç, Esc kapat).
 * + "Konumumu kullan" (geolocation). Haritaya dokunma WorldMap bileşeninde.
 */
export function PlacePicker({ cities, place, onPick, announce, autoFocus }: Props) {
  const id = useId();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<CityRow[]>([]);
  const [active, setActive] = useState(-1);
  const [geoMsg, setGeoMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const listId = `${id}-list`;

  useEffect(() => {
    if (!cities) return;
    const h = cities.search(q, 8);
    setHits(h);
    setActive(h.length ? 0 : -1);
    setOpen(q.trim().length >= 2);
    if (q.trim().length >= 2) announce(h.length ? `${h.length} sonuç. Aşağı okla gez, Enter ile seç.` : 'Sonuç yok.');
  }, [q, cities, announce]);

  const choose = (row: CityRow) => {
    onPick(rowToPlace(row, 'arama'));
    setQ(''); setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(hits.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { if (open && hits[active]) { e.preventDefault(); choose(hits[active]); } }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  /**
   * Konum: tarayıcı yalnızca GÜVENLİ bağlamda verir (https ya da localhost). LAN IP'si üzerinden http ile açılırsa
   * (ör. tablette http://192.168…) hemen reddedilir → `npm run dev:https` kullan.
   * Masaüstünde Wi-Fi/GPS yoksa işletim sistemi konum bulamayabilir → zaman aşımı (kod 3) ya da "bulunamadı" (kod 2).
   */
  const useMyLocation = () => {
    if (!window.isSecureContext) {
      setGeoMsg('Konum yalnızca güvenli bağlantıda (https ya da localhost) çalışır. Bu sayfa http ile açıldı. Şehir aramayı ya da küreye dokunmayı kullan.');
      return;
    }
    if (!('geolocation' in navigator)) { setGeoMsg('Bu tarayıcı konum vermiyor. Şehir aramayı kullan.'); return; }
    setBusy(true); setGeoMsg('Konum isteniyor… (en fazla 20 saniye)');
    const ok = (pos: GeolocationPosition) => {
      setBusy(false);
      const p = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      const near = cities?.nearest(p, 60);
      setGeoMsg('');
      onPick({ ...p, name: near ? `${near.row[0]} yakını` : 'Konumum', country: near ? countryName(near.row[1]) : undefined, source: 'konum' });
    };
    const fail = (err: GeolocationPositionError) => {
      setBusy(false);
      const why = err.code === err.PERMISSION_DENIED
        ? 'Konum izni verilmedi (tarayıcı adres çubuğundaki konum simgesinden izin verebilirsin).'
        : err.code === err.TIMEOUT
          ? 'Cihaz 20 saniyede konumunu bulamadı (masaüstünde Wi-Fi ya da GPS yoksa sık olur).'
          : 'Cihaz konumunu belirleyemedi (işletim sisteminde konum hizmetleri kapalı olabilir).';
      setGeoMsg(`${why} Şehir aramayı ya da küreye dokunmayı kullan.`);
    };
    // önce önbellekteki konum (hızlı), olmazsa taze konum
    navigator.geolocation.getCurrentPosition(ok, () => navigator.geolocation.getCurrentPosition(ok, fail, { enableHighAccuracy: false, timeout: 20000, maximumAge: 0 }),
      { enableHighAccuracy: false, timeout: 1500, maximumAge: Infinity });
  };

  return (
    <div className="picker">
      <div className="combo">
        <label htmlFor={`${id}-in`} className="lbl">Şehir ara</label>
        <input
          id={`${id}-in`} ref={input} type="text" className="field" autoComplete="off" spellCheck={false}
          placeholder={cities ? 'Örn. şehir adı yaz…' : 'Şehir listesi yükleniyor…'} disabled={!cities}
          role="combobox" aria-autocomplete="list" aria-expanded={open && hits.length > 0} aria-controls={listId}
          aria-activedescendant={open && active >= 0 ? `${id}-opt-${active}` : undefined}
          value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        <ul id={listId} role="listbox" aria-label="Şehir sonuçları" className="listbox" hidden={!(open && hits.length > 0)}>
          {hits.map((c, i) => (
            <li key={`${c[0]}-${c[1]}-${c[2]}`} id={`${id}-opt-${i}`} role="option" aria-selected={i === active}
              className={i === active ? 'opt active' : 'opt'} onMouseDown={(e) => { e.preventDefault(); choose(c); }}>
              <b>{c[0]}</b>, {countryName(c[1])} <small>nüfus {c[4].toLocaleString('tr-TR')}</small>
            </li>
          ))}
        </ul>
      </div>
      <button type="button" className="btn" onClick={useMyLocation} disabled={busy}>📍 Konumumu kullan</button>
      {geoMsg && <p className="hint" role="status">{geoMsg}</p>}
      {place && <p className="chosen">Seçili yer: <b>{placeLabel(place)}</b></p>}
      {autoFocus && <AutoFocus target={input} />}
    </div>
  );
}
