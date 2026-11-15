import { useEffect, useId, useRef, useState } from 'react';
import { countryName, placeLabel, rowToPlace, type Cities, type CityRow, type Place } from '../lib/places.ts';

interface Props {
  cities: Cities | null;
  place: Place | null;
  onPick: (p: Place) => void;
  announce: (t: string) => void;
  autoFocus?: boolean;
  lang?: 'tr' | 'en';
  /** Üst çubukta satır içi arama: etiket gizli, ipucu yok, konum düğmesi ikon. */
  compact?: boolean;
}

function AutoFocus({ target }: { target: React.RefObject<HTMLInputElement | null> }) {
  useEffect(() => { const t = setTimeout(() => target.current?.focus(), 30); return () => clearTimeout(t); }, [target]);
  return null;
}

/**
 * Şehir arama: WAI-ARIA 1.2 combobox (liste kutusu açılır, ↑/↓ seçenek, Enter seç, Esc kapat).
 * + "Konumumu kullan" (geolocation). Haritaya dokunma WorldMap bileşeninde.
 */
export function PlacePicker({ cities, place, onPick, announce, autoFocus, lang = 'tr', compact = false }: Props) {
  const en = lang === 'en';
  const T = (t: string, e: string) => (en ? e : t);
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
    if (q.trim().length >= 2) announce(h.length ? T(`${h.length} sonuç. İlki: ${h[0][0]}, ${countryName(h[0][1])}. Enter ile seç ya da aşağı okla gez.`, `${h.length} results. First: ${h[0][0]}, ${countryName(h[0][1])}. Press Enter to choose or use the down arrow.`) : T('Sonuç yok.', 'No results.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, cities, announce]);

  const choose = (row: CityRow) => {
    onPick(rowToPlace(row, 'arama'));
    setQ(''); setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const say = (i: number) => { const c = hits[i]; if (c) announce(`${c[0]}, ${countryName(c[1])}`); };
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); const i = Math.min(hits.length - 1, active + 1); setActive(i); say(i); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); const i = Math.max(0, active - 1); setActive(i); say(i); }
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
      setGeoMsg(T('Konum yalnızca güvenli bağlantıda (https ya da localhost) çalışır. Bu sayfa http ile açıldı. Şehir aramayı ya da küreye dokunmayı kullan.', 'Location only works on a secure connection (https or localhost). This page was opened over http. Search for a city or tap the globe.'));
      return;
    }
    if (!('geolocation' in navigator)) { setGeoMsg(T('Bu tarayıcı konum vermiyor. Şehir aramayı kullan.', 'This browser does not provide location. Search for a city.')); return; }
    setBusy(true); setGeoMsg(T('Konum isteniyor… (en fazla 20 saniye)', 'Asking for location… (up to 20 seconds)'));
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
        ? T('Konum izni verilmedi (tarayıcı adres çubuğundaki konum simgesinden izin verebilirsin).', 'Location permission was not given (allow it from the location icon in the address bar).')
        : err.code === err.TIMEOUT
          ? T('Cihaz 20 saniyede konumunu bulamadı (masaüstünde Wi-Fi ya da GPS yoksa sık olur).', 'The device could not find its location in 20 seconds (common on desktops without Wi-Fi or GPS).')
          : T('Cihaz konumunu belirleyemedi (işletim sisteminde konum hizmetleri kapalı olabilir).', 'The device could not determine its location (location services may be off).');
      setGeoMsg(`${why} ${T('Şehir aramayı ya da küreye dokunmayı kullan.', 'Search for a city or tap the globe.')}`);
    };
    // önce önbellekteki konum (hızlı), olmazsa taze konum
    navigator.geolocation.getCurrentPosition(ok, () => navigator.geolocation.getCurrentPosition(ok, fail, { enableHighAccuracy: false, timeout: 20000, maximumAge: 0 }),
      { enableHighAccuracy: false, timeout: 1500, maximumAge: Infinity });
  };

  return (
    <div className={compact ? 'picker compact' : 'picker'}>
      <div className="combo">
        <label htmlFor={`${id}-in`} className={compact ? 'sr' : 'lbl'}>{T('Şehir ara', 'Search for a city')}</label>
        <input
          id={`${id}-in`} ref={input} type="text" className="field" autoComplete="off" spellCheck={false}
          placeholder={!cities ? T('Şehir listesi yükleniyor…', 'Loading city list…') : compact && place ? `${placeLabel(place)} · ${T('başka yer ara…', 'search another place…')}` : T('Örn. şehir adı yaz…', 'e.g. type a city name…')} disabled={!cities}
          role="combobox" aria-autocomplete="list" aria-expanded={open && hits.length > 0} aria-controls={listId}
          aria-activedescendant={open && active >= 0 ? `${id}-opt-${active}` : undefined}
          value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        <ul id={listId} role="listbox" aria-label={T('Şehir sonuçları', 'City results')} className="listbox" hidden={!(open && hits.length > 0)}>
          {hits.map((c, i) => (
            <li key={`${c[0]}-${c[1]}-${c[2]}`} id={`${id}-opt-${i}`} role="option" aria-selected={i === active}
              className={i === active ? 'opt active' : 'opt'} onMouseDown={(e) => { e.preventDefault(); choose(c); }}>
              <b>{c[0]}</b>, {countryName(c[1])} <small>{T('nüfus', 'population')} {c[4].toLocaleString(en ? 'en-US' : 'tr-TR')}</small>
            </li>
          ))}
        </ul>
      </div>
      <button type="button" className={compact ? 'btn icon-only' : 'btn'} onClick={useMyLocation} disabled={busy} aria-label={T('Konumumu kullan', 'Use my location')} title={T('Konumumu kullan', 'Use my location')}><span aria-hidden="true">📍</span>{compact ? '' : ' ' + T('Konumumu kullan', 'Use my location')}</button>
      {geoMsg && <p className="hint" role="status">{geoMsg}</p>}
      {place && !compact && <p className="chosen">{T('Seçili yer:', 'Selected:')} <b>{placeLabel(place)}</b></p>}
      {autoFocus && <AutoFocus target={input} />}
    </div>
  );
}
