import { useCallback, useEffect, useMemo, useState } from 'react';
import { engine } from './audio/engine.ts';
import { PlacePicker } from './components/PlacePicker.tsx';
import { RadarPanel, type LayerToggle } from './components/RadarPanel.tsx';
import { WorldMap } from './components/WorldMap.tsx';
import { formatLatLon, type LatLon } from './lib/geo.ts';
import { colorFor } from './lib/grid.ts';
import { co2Color, loadCo2, loadJson, loadTemperature, type Co2Source, type TemperatureSource } from './lib/layers.ts';
import { LandMask, type LandFile } from './lib/land.ts';
import { Cities, countryName, placeLabel, rowToPlace, type CitiesFile, type Place } from './lib/places.ts';
import type { Mode, RadarLayer } from './lib/radar.ts';

const BASE = import.meta.env.BASE_URL;

export default function App() {
  const [cities, setCities] = useState<Cities | null>(null);
  const [co2, setCo2] = useState<Co2Source | null>(null);
  const [temp, setTemp] = useState<TemperatureSource | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [rangeKm, setRange] = useState(2000);
  const [mode, setMode] = useState<Mode>('bilim');
  const [month, setMonth] = useState(0);
  const [tFrame, setTFrame] = useState(0);
  const [on, setOn] = useState<Record<string, boolean>>({ co2: true, temp: false });
  const [live, setLive] = useState('');
  const [land, setLand] = useState<LandMask | null>(null);
  const [audioOk, setAudioOk] = useState(true);

  const announce = useCallback((t: string) => { setLive(''); requestAnimationFrame(() => setLive(t)); }, []);
  useEffect(() => engine.onStatus(setAudioOk) as unknown as void, []);

  // veri yükle (sıcaklık katmanı açılınca yüklenir: 5 MB)
  useEffect(() => {
    loadJson<CitiesFile>(BASE, 'cities.json').then((d) => setCities(new Cities(d))).catch((e) => setErr(String(e)));
    loadCo2(BASE).then(setCo2).catch((e) => setErr(String(e)));
    loadJson<LandFile>(BASE, 'land_mask.json').then((d) => setLand(new LandMask(d))).catch(() => { /* kıyı çizgisi olmadan da çalışır */ });
  }, []);
  useEffect(() => {
    if (on.temp && !temp) loadTemperature(BASE).then((t) => { setTemp(t); setTFrame(t.frames - 1); }).catch((e) => setErr(String(e)));
  }, [on.temp, temp]);

  // paylaşılabilir bağlantı: ?q=<şehir> ya da ?lat=..&lon=.. (kullanıcının seçimi; kodda şehir yok)
  useEffect(() => {
    if (!cities || place) return;
    const u = new URLSearchParams(location.search);
    const q = u.get('q'), lat = u.get('lat'), lon = u.get('lon');
    if (q) { const row = cities.find(q); if (row) setPlace({ ...rowToPlace(row, 'bağlantı') }); }
    else if (lat && lon && !Number.isNaN(+lat) && !Number.isNaN(+lon)) pickPoint({ lat: +lat, lon: +lon }, 'bağlantı');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities]);
  useEffect(() => {
    if (!place) return;
    const u = new URL(location.href);
    u.search = place.source === 'arama' || place.source === 'bağlantı' ? `?q=${encodeURIComponent(place.name)}` : `?lat=${place.lat.toFixed(3)}&lon=${place.lon.toFixed(3)}`;
    history.replaceState(null, '', u);
  }, [place]);

  const pickPoint = useCallback((p: LatLon, source: Place['source']) => {
    const near = cities?.nearest(p, 75);
    setPlace(near ? { lat: p.lat, lon: p.lon, name: `${near.row[0]} yakını`, country: countryName(near.row[1]), source } : { ...p, name: formatLatLon(p), source });
  }, [cities]);

  // seçim sonrası duyuru
  useEffect(() => {
    if (!place || !co2) return;
    const v = co2.grid.bilinear(place, month);
    announce(`${placeLabel(place)} seçildi. Merkezde karbondioksit ${v.toFixed(1)} ppm, ${co2.monthLabel(month)}. Radarı çalmak için Boşluk tuşu ya da Radarı çal düğmesi. İlk kez dinliyorsan önce sesli lejant.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, co2]);

  const layers = useMemo(() => {
    const L: RadarLayer[] = [];
    if (on.co2 && co2) L.push(co2.radarLayer(month));
    if (on.temp && temp) L.push(temp.radarLayer(tFrame));
    return L;
  }, [on, co2, temp, month, tFrame]);

  const toggles: LayerToggle[] = [
    { id: 'co2', label: 'Karbondioksit (CO₂)', instrument: 'nefes gibi yumuşak ses', on: on.co2, available: !!co2, note: 'OCO-2 GEOS, 2021' },
    { id: 'temp', label: 'Yüzey sıcaklığı', instrument: 'yumuşak telli ses', on: on.temp, available: true, note: on.temp && !temp ? 'yükleniyor…' : 'GEOS-FP görseli, SVS 5147' },
  ];

  // görsel: ilk açık katman
  const primary = on.co2 && co2 ? 'co2' : on.temp && temp ? 'temp' : null;
  const paintLL = useCallback((p: LatLon): [number, number, number] | null => {
    if (primary === 'co2' && co2) return co2.color(co2.grid.bilinear(p, month), month);
    if (primary === 'temp' && temp) { const v = temp.layer.sample(tFrame, p); return Number.isNaN(v) ? null : colorFor(temp.cs, v); }
    return [210, 210, 210];
  }, [primary, co2, temp, month, tFrame]);
  const paintKey = `${primary}-${month}-${tFrame}`;

  const timeExtra = (
    <>
      {on.co2 && co2 && (
        <div className="fs">
          <label className="lbl" htmlFor="co2-month">CO₂ ayı: <b>{co2.monthLabel(month)}</b></label>
          <input id="co2-month" type="range" min={0} max={co2.months - 1} step={1} value={month} aria-valuetext={co2.monthLabel(month)}
            onChange={(e) => { const m = +e.target.value; setMonth(m); if (place) announce(`${co2.monthLabel(m)}: merkezde ${co2.grid.bilinear(place, m).toFixed(1)} ppm.`); }} />
          <div className="scalebar" aria-hidden="true">
            <span>{co2.grid.monthRange(month).min.toFixed(1)} ppm</span>
            <i style={{ background: `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map((t) => `rgb(${co2Color(t).join(',')})`).join(',')})` }} />
            <span>{co2.grid.monthRange(month).max.toFixed(1)} ppm</span>
          </div>
        </div>
      )}
      {on.temp && temp && (
        <div className="fs">
          <label className="lbl" htmlFor="t-frame">Sıcaklık zamanı: <b>{temp.dateLabel(tFrame)}</b></label>
          <input id="t-frame" type="range" min={0} max={temp.frames - 1} step={1} value={tFrame} aria-valuetext={temp.dateLabel(tFrame)} onChange={(e) => setTFrame(+e.target.value)} />
          <div className="scalebar" aria-hidden="true">
            <span>{temp.cs.min} °C</span>
            <i style={{ background: `linear-gradient(90deg, ${temp.cs.steps.filter((_, i) => i % 16 === 0 || i === temp.cs.steps.length - 1).map((s) => `rgb(${s.rgb.join(',')})`).join(',')})` }} />
            <span>{temp.cs.max} °C</span>
          </div>
        </div>
      )}
    </>
  );

  return (
    <main>
      <header className="top">
        <h1>EarthEar</h1>
        <p className="sub">Dünyanın herhangi bir yerinin çevresini sesle dinle: seçtiğin yerde dönen bir veri radarı.</p>
      </header>

      {!audioOk && <p role="alert" className="alert">Ses başlatılamadı. Sessiz modu kapat, sesi aç ve bir düğmeye tekrar dokun.</p>}
      {err && <p role="alert" className="alert">Veri yüklenemedi: {err}</p>}

      <section aria-labelledby="pick-h" className="card">
        <h2 id="pick-h">1. Bir yer seç</h2>
        <p className="hint">Şehir adı yaz, haritaya dokun ya da konumunu kullan. Radar seçtiğin yerin çevresinde döner.</p>
        <PlacePicker cities={cities} place={place} onPick={setPlace} announce={announce} />
        {co2 && (
          <WorldMap paint={paintLL} paintKey={paintKey} land={land} center={place} rangeKm={rangeKm}
            onPick={(p) => pickPoint(p, 'harita')} />
        )}
      </section>

      {!place ? (
        <section className="card prompt" aria-live="polite">
          <h2>2. Radar</h2>
          <p>Henüz bir yer seçmedin. Yukarıdan bir şehir ara ya da <b>📍 Konumumu kullan</b> düğmesine bas.</p>
        </section>
      ) : (
        <RadarPanel
          placeName={placeLabel(place)} center={place} layers={layers} toggles={toggles}
          onToggle={(id, v) => setOn((o) => ({ ...o, [id]: v }))}
          rangeKm={rangeKm} setRange={setRange} mode={mode} setMode={setMode}
          paint={paintLL} paintKey={paintKey} announce={announce} extra={timeExtra} land={land}
        />
      )}

      <section aria-labelledby="src-h" className="card sources">
        <h2 id="src-h">Kaynaklar</h2>
        <ul>
          <li><b>Karbondioksit:</b> {co2?.grid.f.credit ?? 'Veri: NASA OCO-2 GEOS Level 3 Daily CO2 (OCO2_GEOS_L3CO2_DAY), GES DISC'}. 2021; aylık katmanlar ayın 1. günü. Ekibimiz GES DISC verisinden üretti.</li>
          <li><b>Yüzey sıcaklığı:</b> Visualization: NASA Scientific Visualization Studio; GEOS-FP (NASA GMAO). <a href="https://svs.gsfc.nasa.gov/5147/">svs.gsfc.nasa.gov/5147</a>. Renkler görseldeki renk skalasından değere çevrildi; son saatler tahmindir.</li>
          <li><b>Şehirler:</b> GeoNames (geonames.org), CC BY 4.0.</li>
        </ul>
      </section>

      <div className="sr" aria-live="polite" aria-atomic="true">{live}</div>

      <footer>
        Bu proje NASA verisi kullanılarak NASA Space Apps Challenge 2026 için hazırlanmıştır; NASA tarafından onaylanmamıştır.
      </footer>
    </main>
  );
}
