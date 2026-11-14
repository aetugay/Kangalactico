import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { engine } from './audio/engine.ts';
import { IconBars, IconBreath, IconStrings, IconWave } from './components/icons.tsx';
import { PlacePicker } from './components/PlacePicker.tsx';
import { RadarView } from './components/RadarView.tsx';
import { About, Dialog, Intro, LayerPills, NowCard, Timeline, TopBar, type Pill } from './components/Shell.tsx';
import { WorldMap } from './components/WorldMap.tsx';
import { useRadar } from './hooks/useRadar.ts';
import { tr, type Lang } from './i18n.ts';
import { formatLatLon, type LatLon } from './lib/geo.ts';
import { colorFor } from './lib/grid.ts';
import { LandMask, type LandFile } from './lib/land.ts';
import { loadAerosols, loadCo2, loadJson, loadSst, loadTemperature, type AerosolSource, type Co2Source, type SstSource, type TemperatureSource } from './lib/layers.ts';
import { Cities, countryName, placeLabel, rowToPlace, type CitiesFile, type Place } from './lib/places.ts';
import type { Mode, RadarLayer } from './lib/radar.ts';
import { landTexture, paintEquirect } from './lib/textures.ts';
import { Globe3D, hasWebGL, type GlobeSource } from './three/Globe3D.tsx';

const BASE = import.meta.env.BASE_URL;
type LayerId = 'co2' | 'temp' | 'sst' | 'aerosol';
const LAYER_UI: Record<LayerId, { label: { tr: string; en: string }; instrument: { tr: string; en: string }; color: string; icon: React.ReactNode }> = {
  co2: { label: { tr: 'Karbondioksit', en: 'Carbon dioxide' }, instrument: { tr: 'nefes', en: 'breath' }, color: '#ffb547', icon: <IconBreath /> },
  temp: { label: { tr: 'Yüzey sıcaklığı', en: 'Surface temperature' }, instrument: { tr: 'teller', en: 'strings' }, color: '#ff6b6b', icon: <IconStrings /> },
  sst: { label: { tr: 'Okyanus sıcaklığı', en: 'Ocean temperature' }, instrument: { tr: 'su sesi', en: 'water tone' }, color: '#4dd8e8', icon: <IconWave /> },
  aerosol: { label: { tr: 'Aerosoller', en: 'Aerosols' }, instrument: { tr: '4 enstrüman', en: '4 instruments' }, color: '#c49bff', icon: <IconBars /> },
};
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* yok say */ } } };
const params = new URLSearchParams(location.search);
const isTouchDevice = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;

export default function App() {
  // ---------- tercihler
  const [lang, setLangS] = useState<Lang>(() => (params.get('lang') === 'en' || store.get('lang') === 'en' ? 'en' : 'tr'));
  const [hc, setHcS] = useState(() => params.get('hc') === '1' || store.get('hc') === '1' || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-contrast: more)').matches));
  const can3d = useMemo(() => hasWebGL(), []);
  const forced = params.get('view');
  const [view3d, setView3dS] = useState(() => can3d && (forced === '3d' || (forced !== '2d' && store.get('view') !== '2d' && !isTouchDevice)));
  const [slowNote, setSlowNote] = useState(false);
  const [reduced, setReduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const m = matchMedia('(prefers-reduced-motion: reduce)'); const f = () => setReduced(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  const setLang = (l: Lang) => { setLangS(l); store.set('lang', l); };
  const setHc = (v: boolean) => { setHcS(v); store.set('hc', v ? '1' : '0'); };
  const setView3d = (v: boolean) => { setView3dS(v); store.set('view', v ? '3d' : '2d'); setSlowNote(false); };
  useEffect(() => { document.documentElement.classList.toggle('hc', hc); document.documentElement.lang = lang; }, [hc, lang]);

  // ---------- veri
  const [cities, setCities] = useState<Cities | null>(null);
  const [co2, setCo2] = useState<Co2Source | null>(null);
  const [temp, setTemp] = useState<TemperatureSource | null>(null);
  const [sst, setSst] = useState<SstSource | null>(null);
  const [aer, setAer] = useState<AerosolSource | null>(null);
  const [land, setLand] = useState<LandMask | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    loadJson<CitiesFile>(BASE, 'cities.json').then((d) => setCities(new Cities(d))).catch((e) => setErr(String(e)));
    loadCo2(BASE).then(setCo2).catch((e) => setErr(String(e)));
    loadJson<LandFile>(BASE, 'land_mask.json').then((d) => setLand(new LandMask(d))).catch(() => { /* kıyısız da çalışır */ });
  }, []);
  const landCanvas = useMemo(() => (land ? landTexture(land) : null), [land]);

  // ---------- durum
  const [place, setPlace] = useState<Place | null>(null);
  const [rangeKm, setRange] = useState(2000);
  const [mode, setMode] = useState<Mode>('bilim');
  const [month, setMonth] = useState(0);
  const [advance, setAdvance] = useState(true);
  const [tFrame, setTFrame] = useState(0);
  const [sstFrame, setSstFrame] = useState(0);
  const [on, setOn] = useState<Record<LayerId, boolean>>({ co2: true, temp: false, sst: false, aerosol: false });
  const [visual, setVisual] = useState<LayerId>('co2');
  const [pickOpen, setPickOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [live, setLive] = useState('');
  const [audioOk, setAudioOk] = useState(true);
  const announce = useCallback((t: string) => { setLive(''); requestAnimationFrame(() => setLive(t)); }, []);
  useEffect(() => engine.onStatus(setAudioOk) as unknown as void, []);

  // katmanlar açılınca yükle
  useEffect(() => { if (on.temp && !temp) loadTemperature(BASE).then((t) => { setTemp(t); setTFrame(t.frames - 1); }).catch((e) => setErr(String(e))); }, [on.temp, temp]);
  useEffect(() => { if (on.sst && !sst) loadSst(BASE).then(setSst).catch((e) => setErr(String(e))); }, [on.sst, sst]);
  useEffect(() => { if (on.aerosol && !aer) loadAerosols(BASE).then(setAer).catch((e) => setErr(String(e))); }, [on.aerosol, aer]);

  // SST videosu (küre dokusu) — yalnızca küre üstünde gösterilirken oynar; ızgara karesi video zamanını izler
  const video = useMemo(() => { const v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none'; v.src = `${BASE}media/sst_3912_1024.mp4`; return v; }, []);
  const showVideo = view3d && visual === 'sst' && on.sst;
  useEffect(() => { if (showVideo) { video.preload = 'auto'; video.play().catch(() => {}); } else video.pause(); }, [showVideo, video]);
  useEffect(() => {
    if (!on.sst || !sst) return;
    const id = setInterval(() => { const f = sst.frameAt(video.currentTime); setSstFrame((p) => (p === f ? p : f)); }, 500);
    return () => clearInterval(id);
  }, [on.sst, sst, video]);
  const [aerImg, setAerImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => { if (on.aerosol && !aerImg) { const i = new Image(); i.onload = () => setAerImg(i); i.src = `${BASE}media/aerosols_5669_2048.jpg`; } }, [on.aerosol, aerImg]);

  // ---------- yer seçimi
  const pickPoint = useCallback((p: LatLon, source: Place['source']) => {
    const near = cities?.nearest(p, 75);
    setPlace(near ? { lat: p.lat, lon: p.lon, name: `${near.row[0]} yakını`, country: countryName(near.row[1]), source } : { ...p, name: formatLatLon(p), source });
    setPickOpen(false);
  }, [cities]);
  useEffect(() => { // paylaşılabilir bağlantı (kullanıcı seçimi; kodda şehir yok)
    if (!cities || place) return;
    const q = params.get('q'), lat = params.get('lat'), lon = params.get('lon');
    if (q) { const row = cities.find(q); if (row) setPlace(rowToPlace(row, 'bağlantı')); }
    else if (lat && lon && !Number.isNaN(+lat) && !Number.isNaN(+lon)) pickPoint({ lat: +lat, lon: +lon }, 'bağlantı');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities]);
  useEffect(() => {
    if (!place) return;
    const u = new URL(location.href);
    if (place.source === 'arama' || place.source === 'bağlantı') { u.searchParams.set('q', place.name); u.searchParams.delete('lat'); u.searchParams.delete('lon'); }
    else { u.searchParams.delete('q'); u.searchParams.set('lat', place.lat.toFixed(3)); u.searchParams.set('lon', place.lon.toFixed(3)); }
    history.replaceState(null, '', u);
  }, [place]);
  useEffect(() => {
    if (!place || !co2) return;
    announce(`${placeLabel(place)} seçildi. Merkezde karbondioksit ${co2.grid.bilinear(place, month).toFixed(1)} ppm, ${co2.monthLabel(month)}. Radarı çalmak için Boşluk tuşu ya da Radarı çal düğmesi. İlk kez dinliyorsan önce sesli lejant.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, co2]);

  // ---------- radar katmanları
  const layers = useMemo(() => {
    const L: RadarLayer[] = [];
    if (on.co2 && co2) L.push(co2.radarLayer(month));
    if (on.temp && temp) L.push(temp.radarLayer(tFrame));
    if (on.sst && sst) L.push(sst.radarLayer(sstFrame));
    if (on.aerosol && aer) L.push(...aer.radarLayers());
    return L;
  }, [on, co2, temp, sst, aer, month, tFrame, sstFrame]);

  const advanceRef = useRef(advance); advanceRef.current = advance;
  const radar = useRadar({
    placeName: place ? placeLabel(place) : '', center: place, layers, rangeKm, mode, announce,
    onRevolution: () => { if (advanceRef.current && on.co2) setMonth((m) => (m + 1) % 12); },
  });

  const toggleLayer = (id: LayerId) => {
    const v = !on[id];
    setOn((o) => ({ ...o, [id]: v }));
    if (v) setVisual(id);
    else if (visual === id) { const rest = (Object.keys(on) as LayerId[]).find((k) => k !== id && on[k]); if (rest) setVisual(rest); }
    announce(`${LAYER_UI[id].label.tr} ${v ? 'açıldı' : 'kapandı'}.`);
  };

  // ---------- görsel: küre dokusu ve 2D boyama (görünen katman)
  const paintLL = useCallback((p: LatLon): [number, number, number] | null => {
    if (visual === 'co2' && co2) return co2.color(co2.grid.bilinear(p, month), month);
    if (visual === 'temp' && temp) { const v = temp.layer.sample(tFrame, p); return Number.isNaN(v) ? null : colorFor(temp.cs, v); }
    if (visual === 'sst' && sst) { const v = sst.layer.sample(sstFrame, p); return Number.isNaN(v) ? null : colorFor(sst.cs, v); }
    if (visual === 'aerosol' && aer) {
      let best = -1, bv = 0.04; aer.file.categories.forEach((c, i) => { const v = aer.layers[c.id].sample(0, p); if (v > bv) { bv = v; best = i; } });
      if (best < 0) return null;
      const rgb = aer.file.categories[best].rgb, k = Math.min(1, 0.35 + bv * 1.6);
      return [rgb[0] * k, rgb[1] * k, rgb[2] * k];
    }
    return null;
  }, [visual, co2, temp, sst, aer, month, tFrame, sstFrame]);
  const paintKey = `${visual}-${visual === 'co2' ? month : visual === 'temp' ? tFrame : visual === 'sst' ? sstFrame : 0}-${!!co2}-${!!temp}-${!!sst}-${!!aer}`;
  const globeSource: GlobeSource | null = useMemo(() => {
    if (!view3d) return null;
    if (visual === 'sst' && on.sst) return { key: 'sst-video', el: video };
    if (visual === 'aerosol' && on.aerosol) return aerImg ? { key: 'aer-img', el: aerImg } : null;
    if (visual === 'co2' && co2) return { key: `co2-${month}`, el: paintEquirect(paintLL) };
    if (visual === 'temp' && temp) return { key: `temp-${tFrame}`, el: paintEquirect(paintLL) };
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view3d, visual, on.sst, on.aerosol, aerImg, co2 && month, temp && tFrame, video, paintKey]);

  // ---------- paneller
  const L = (id: LayerId) => LAYER_UI[id];
  const pills: Pill[] = (Object.keys(LAYER_UI) as LayerId[]).map((id) => ({
    id, label: L(id).label[lang], instrument: L(id).instrument[lang], icon: L(id).icon, color: L(id).color, on: on[id], visual: visual === id && on[id],
    loading: on[id] && ((id === 'temp' && !temp) || (id === 'sst' && !sst) || (id === 'aerosol' && !aer)),
    note: id === 'co2' ? 'OCO-2 GEOS 2021' : id === 'temp' ? 'GEOS-FP' : id === 'sst' ? 'ECCO2 2007–08' : 'GEOS 2025',
  }));
  const fmtShort = (l: RadarLayer, v: number) => (Number.isNaN(v) ? '—' : l.unit === '°C' ? `${Math.round(v)} °C` : l.unit === 'ppm' ? `${v.toFixed(1)} ppm` : l.fmt(v));
  const h = radar.headline;
  const headline = h ? { label: h.layer.label, center: fmtShort(h.layer, h.center), maxDir: h.maxDir, maxVal: fmtShort(h.layer, h.maxVal), when: h.layer.when } : null;
  const instruments = layers.map((l) => ({ id: l.id, label: l.label, instrument: l.instrument, color: l.id === 'co2' ? L('co2').color : l.id === 'temp' ? L('temp').color : l.id === 'sst' ? L('sst').color : L('aerosol').color }));
  const credits = [
    { title: lang === 'tr' ? 'Karbondioksit' : 'Carbon dioxide', text: `${co2?.grid.f.credit ?? 'Veri: NASA OCO-2 GEOS Level 3 Daily CO2 (OCO2_GEOS_L3CO2_DAY), GES DISC'}. 2021; ${lang === 'tr' ? 'aylık katmanlar ayın 1. günü; ekibimiz GES DISC verisinden üretti' : 'monthly layers are the 1st day of each month; produced by our team from GES DISC data'}.` },
    { title: lang === 'tr' ? 'Yüzey sıcaklığı' : 'Surface temperature', text: 'Visualization: NASA Scientific Visualization Studio, Joseph V. Ardizzone (NASA/GSFC); GEOS-FP (NASA GMAO)', href: 'https://svs.gsfc.nasa.gov/5147/' },
    { title: lang === 'tr' ? 'Okyanus sıcaklığı ve akıntılar' : 'Ocean temperature & currents', text: 'Visualization: NASA Scientific Visualization Studio, Greg Shirah (NASA/GSFC); ECCO2 (Hong Zhang, Dimitris Menemenlis)', href: 'https://svs.gsfc.nasa.gov/3912/' },
    { title: lang === 'tr' ? 'Aerosoller' : 'Aerosols', text: 'Visualization: NASA Scientific Visualization Studio, Joseph V. Ardizzone (NASA/GSFC), Helen-Nicole Kostis (STC); scientific consulting Lesley Ott (NASA/GSFC)', href: 'https://svs.gsfc.nasa.gov/5669/' },
    { title: lang === 'tr' ? 'Kıyı çizgileri' : 'Coastlines', text: lang === 'tr' ? 'NASA Scientific Visualization Studio NDVI görselinden (SVS 5544) türetilmiş kara maskesi' : 'Land mask derived from a NASA Scientific Visualization Studio NDVI visualization (SVS 5544)', href: 'https://svs.gsfc.nasa.gov/5544/' },
    { title: lang === 'tr' ? 'Şehirler' : 'Cities', text: 'GeoNames (geonames.org), CC BY 4.0' },
  ];

  return (
    <div className={`app${view3d ? ' is3d' : ' is2d'}`}>
      {view3d && (
        <Globe3D source={globeSource} landCanvas={landCanvas} center={place} rangeKm={rangeKm} angle={radar.angle} level={() => engine.level()}
          reducedMotion={reduced} onPick={(p) => pickPoint(p, 'harita')}
          onSlow={() => { if (forced !== '3d') { setView3dS(false); setSlowNote(true); } }} />
      )}

      <TopBar lang={lang} setLang={setLang} hc={hc} setHc={setHc} view3d={view3d} can3d={can3d} setView3d={setView3d} onPick={() => setPickOpen(true)} onAbout={() => setAboutOpen(true)} hasPlace={!!place} />

      <main className="stage">
        {!audioOk && <p role="alert" className="glass alert">{lang === 'tr' ? 'Ses başlatılamadı. Sessiz modu kapat, sesi aç ve bir düğmeye tekrar dokun.' : 'Audio could not start. Turn off silent mode, raise the volume and tap a button again.'}</p>}
        {err && <p role="alert" className="glass alert">{err}</p>}
        {slowNote && <p role="status" className="glass note">{tr(lang, 'fallback')}</p>}

        {!place && <Intro lang={lang} onPick={() => setPickOpen(true)} />}

        {!view3d && (
          <section className={`flat${place ? '' : ' empty'}`} aria-label={lang === 'tr' ? '2D harita ve radar' : '2D map and radar'}>
            {place && <div className="flat-radar"><RadarView center={place} rangeKm={rangeKm} paint={paintLL} paintKey={paintKey} angle={radar.angle} land={land} /></div>}
            <div className="flat-map"><WorldMap paint={paintLL} paintKey={paintKey} land={land} center={place} rangeKm={rangeKm} onPick={(p) => pickPoint(p, 'harita')} /></div>
          </section>
        )}

        {place && (
          <>
            <NowCard lang={lang} placeLabel={placeLabel(place)} playing={radar.playing} onToggle={radar.toggle} onLegend={radar.runLegend} legendBusy={!!radar.legend}
              onSummary={radar.summary} headline={headline} instruments={instruments} rangeKm={rangeKm} setRange={(km) => { setRange(km); announce(`Menzil ${km} km.`); }}
              revSec={radar.revSec} setRevSec={radar.setRevSec} mode={mode} setMode={(m) => { setMode(m); announce(m === 'hikaye' ? 'Hikâye modu: pentatonik perde, radar içine göre şiddet.' : 'Bilim modu: doğrusal perde, sabit ölçekte şiddet.'); }} legend={radar.legend} />
            <LayerPills lang={lang} pills={pills} onToggle={(id) => toggleLayer(id as LayerId)} onShow={(id) => setVisual(id as LayerId)}>
              {on.temp && temp && (
                <div className="sub-time">
                  <label htmlFor="t-frame" className="small">{lang === 'tr' ? 'Sıcaklık zamanı' : 'Temperature time'}: <b>{temp.dateLabel(tFrame)}</b></label>
                  <input id="t-frame" type="range" min={0} max={temp.frames - 1} value={tFrame} aria-valuetext={temp.dateLabel(tFrame)} onChange={(e) => setTFrame(+e.target.value)} />
                </div>
              )}
              {on.sst && <p className="small muted">{lang === 'tr' ? 'Okyanus: ECCO2 model, Mart 2007 – Mart 2008; video akarken radar sesi de ilerler.' : 'Ocean: ECCO2 model, Mar 2007 – Mar 2008; radar sound follows the video.'}</p>}
              {on.aerosol && <p className="small muted">{lang === 'tr' ? 'Aerosoller: 19 Ağu 2025 20:00 UTC; yoğunluk göreli.' : 'Aerosols: 19 Aug 2025 20:00 UTC; relative density.'}</p>}
            </LayerPills>
            {on.co2 && co2 && <Timeline lang={lang} month={month} setMonth={(m) => { setMonth(m); announce(`${co2.monthLabel(m)}: merkezde ${co2.grid.bilinear(place, m).toFixed(1)} ppm.`); }} label={co2.monthLabel(month)} advance={advance} setAdvance={setAdvance} />}
          </>
        )}
      </main>

      <Dialog open={pickOpen} onClose={() => setPickOpen(false)} title={tr(lang, 'searchTitle')} lang={lang}>
        <PlacePicker cities={cities} place={place} onPick={(p) => { setPlace(p); setPickOpen(false); }} announce={announce} autoFocus />
        <p className="small muted">{tr(lang, 'orTap')}</p>
      </Dialog>
      <About open={aboutOpen} onClose={() => setAboutOpen(false)} lang={lang} credits={credits} />

      <div className="sr" aria-live="polite" aria-atomic="true">{live}</div>
      <footer className="foot">{tr(lang, 'disclaimer')} <button type="button" className="linkish" onClick={() => setAboutOpen(true)}>{tr(lang, 'about')}</button></footer>
    </div>
  );
}
