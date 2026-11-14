import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { engine } from './audio/engine.ts';
import { speech } from './audio/speech.ts';
import { handsFree, listener } from './audio/listen.ts';
import { IconBars, IconBreath, IconStrings, IconWave } from './components/icons.tsx';
import { DEFAULT_MIX, EventsDialog, Explore, instrumentName, SoundDialog, StoriesDialog, type EarthEvent, type Mix, type StoryInfo } from './components/Extras.tsx';
import { PlacePicker } from './components/PlacePicker.tsx';
import { isFormTarget, shortcutAllowed } from './lib/keys.ts';
import { loadLandRaster, type LandRaster } from './lib/nemask.ts';
import { Guide, type CmdEntry, type GuideStatus } from './components/Guide.tsx';
import { monthName } from './lib/co2.ts';
import { RadarView } from './components/RadarView.tsx';
import { About, Dialog, Intro, LayerPills, NowCard, Timeline, TopBar, type Pill } from './components/Shell.tsx';
import { WorldMap } from './components/WorldMap.tsx';
import { useRadar } from './hooks/useRadar.ts';
import { tr, type Lang } from './i18n.ts';
import { bearing as bearingTo, compass8, destination, formatKm, formatLatLon, haversineKm, type LatLon } from './lib/geo.ts';
import { colorFor } from './lib/grid.ts';
import { LandMask, type LandFile } from './lib/land.ts';
import { co2Color, loadAerosols, loadCo2, loadJson, loadSst, loadTemperature, type AerosolSource, type Co2Source, type SstSource, type TemperatureSource } from './lib/layers.ts';
import { INSTRUMENT_LABEL, M24 } from './lib/m24.ts';
import { M24Panel } from './components/M24Panel.tsx';
import { Cities, countryName, fold, placeLabel, rowToPlace, type CitiesFile, type Place } from './lib/places.ts';
import { noteHz, PARTS, type Mode, type RadarLayer, type Scale } from './lib/radar.ts';
import { landTexture, paintEquirect } from './lib/textures.ts';
import { Globe3D, hasWebGL, type GlobeSource } from './three/Globe3D.tsx';

const BASE = import.meta.env.BASE_URL;
type LayerId = 'co2' | 'temp' | 'sst' | 'aerosol';
const LAYER_UI: Record<LayerId, { label: { tr: string; en: string }; instrument: { tr: string; en: string }; color: string; icon: React.ReactNode }> = {
  co2: { label: { tr: 'Karbondioksit', en: 'Carbon dioxide' }, instrument: { tr: 'keman', en: 'violin' }, color: '#ffb547', icon: <IconBreath /> },
  temp: { label: { tr: 'Yüzey sıcaklığı', en: 'Surface temperature' }, instrument: { tr: 'gitar', en: 'guitar' }, color: '#ff6b6b', icon: <IconStrings /> },
  sst: { label: { tr: 'Okyanus sıcaklığı', en: 'Ocean temperature' }, instrument: { tr: 'arp + dalga sesi', en: 'harp + waves' }, color: '#4dd8e8', icon: <IconWave /> },
  aerosol: { label: { tr: 'Aerosoller', en: 'Aerosols' }, instrument: { tr: 'çello, çelesta, flüt, marimba', en: 'cello, celesta, flute, marimba' }, color: '#c49bff', icon: <IconBars /> },
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
  const [guide, setGuideS] = useState(() => store.get('guide') !== '0'); // sesli rehber: her şeyi sesli söyler (varsayılan açık)
  const guideRef = useRef(guide); guideRef.current = guide;
  const langRef = useRef(lang); langRef.current = lang;
  speech.setLang(lang);
  const setLang = (l: Lang) => { langRef.current = l; setLangS(l); store.set('lang', l); speech.setLang(l); handsFree.setLang(l); announceRef.current(l === 'en' ? 'Language: English. Voice commands, the voice guide and the screen are now in English.' : 'Dil: Türkçe. Sesli komut, sesli rehber ve ekran artık Türkçe.'); };
  const announceRef = useRef<(t: string) => void>(() => {});
  const setGuide = (v: boolean) => {
    setGuideS(v); store.set('guide', v ? '1' : '0');
    if (v) void speech.say(langRef.current === 'en' ? 'Voice guide on.' : 'Sesli rehber açık.');
    else { speech.stop(); setLive(''); requestAnimationFrame(() => setLive(langRef.current === 'en' ? 'Voice guide off.' : 'Sesli rehber kapalı.')); }
  };
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
  const landRef = useRef(land); landRef.current = land;

  // ---------- durum
  const [place, setPlace] = useState<Place | null>(null);
  const [rangeKm, setRange] = useState(2000);
  const [mode, setMode] = useState<Mode>('bilim'); // Adım 1: bilim modu varsayılan — yalnız veri sesleri; tam ton dizisi
  const [scale, setScaleS] = useState<Scale>('local'); // Adım 2: yerel ölçek varsayılan — bu alandaki farklar 2 oktava yayılır
  const [month, setMonth] = useState(0);
  const [advance, setAdvance] = useState(true);
  const [tFrame, setTFrame] = useState(0);
  const [sstFrame, setSstFrame] = useState(0);
  const [on, setOn] = useState<Record<LayerId, boolean>>({ co2: true, temp: false, sst: false, aerosol: false });
  const [visual, setVisual] = useState<LayerId>('co2');
  // 2024 aylık NASA katmanları (MERRA-2 / OCO-2; denetimden geçenler) — ayrı durum, mevcut 4 katmana dokunmaz
  const [m24, setM24] = useState<M24 | null>(null);
  const [m24Loading, setM24Loading] = useState(false);
  const [m24On, setM24On] = useState<Record<string, boolean>>({});
  const [m24Visual, setM24Visual] = useState<string | null>(null);
  /** 2024 katmanını aç/kapat (panel ve sesli/yazılı komut ortak). Veri yüklü değilse yükler. */
  const M24_NAMES: Record<string, { tr: string; en: string }> = {
    co2_24: { tr: 'Atmosferik CO₂ 2021 (aylık ortalama)', en: 'Atmospheric CO₂ 2021 (monthly mean)' },
    o3_24: { tr: 'Toplam sütun ozonu 2024', en: 'Total column ozone 2024' }, twland_24: { tr: 'Kara su depolaması farkı 2024', en: 'Land water storage departure 2024' },
    lai_24: { tr: 'Yaprak alanı indeksi 2024', en: 'Leaf area index 2024' }, gwettop_24: { tr: 'Üst toprak nemi 2024', en: 'Topsoil wetness 2024' }, so2_24: { tr: 'Yüzey SO₂ 2024', en: 'Surface SO₂ 2024' },
    aod_24: { tr: 'Aerosol optik derinliği 2024', en: 'Aerosol optical depth 2024' }, t2m_24: { tr: '2 m hava sıcaklığı 2024', en: '2 m air temperature 2024' },
    ts_24: { tr: 'Yüzey deri sıcaklığı 2024', en: 'Surface skin temperature 2024' }, albedo_24: { tr: 'Yüzey albedosu 2024', en: 'Surface albedo 2024' },
    sst_24: { tr: 'Deniz yüzeyi sıcaklığı 2024', en: 'Sea surface temperature 2024' }, precip_24: { tr: 'Kara üstü yağış 2024', en: 'Precipitation over land 2024' },
    seaice_24: { tr: 'Deniz buzu oranı 2024', en: 'Sea-ice fraction 2024' },
  };
  const setM24Layer = (id: string, v: boolean) => {
    setActiveTheme(null); // elle değişiklik → tema vurgusu kalkar
    if (!m24 && !m24Loading) openM24();
    setM24On((o) => ({ ...o, [id]: v }));
    if (v) setM24Visual(id); else setM24Visual((cur) => (cur === id ? null : cur));
    const en = langRef.current === 'en', n = M24_NAMES[id]?.[en ? 'en' : 'tr'] ?? id, inst = INSTRUMENT_LABEL[id]?.[en ? 'en' : 'tr'];
    announce(v ? (en ? `${n} on: ${inst}.` : `${n} açıldı: ${inst}.`) : (en ? `${n} off.` : `${n} kapandı.`));
  };
  const anyM24On = Object.values(m24On).some(Boolean);
  /** Ceyhun'un presetleri: yalnız UYGUN katmanlar açılır, diğer aylık katmanlar kapanır; çıkarılanlar söylenir. */
  const [activeTheme, setActiveTheme] = useState<string | null>(null);
  const applyM24Preset = (ids: string[], name: string, removed: string[]) => {
    setActiveTheme(name);
    setM24On(Object.fromEntries(ids.map((id) => [id, true]))); setM24Visual(ids[0] ?? null);
    setOn({ co2: false, temp: false, sst: false, aerosol: false }); // tema = yalnız o katmanlar
    const en = langRef.current === 'en', names = ids.map((id) => M24_NAMES[id]?.[en ? 'en' : 'tr'] ?? id).join(', ');
    announce(en ? `${name}: ${names}.${removed.length ? ` Not included because it did not pass our data audit: ${removed.join(', ')}.` : ''}` : `${name}: ${names}.${removed.length ? ` Veri denetimimizden geçmediği için eklenmedi: ${removed.join(', ')}.` : ''}`);
  };
  const m24Started = useRef(false);
  const [m24Rev, setM24Rev] = useState(0); // API yedeğinde hücreler geldikçe radar yeniden örneklesin
  useEffect(() => { if (m24) m24.onUpdate = () => setM24Rev((r) => r + 1); }, [m24]);
  const openM24 = () => { if (m24 || m24Loading || m24Started.current) return; m24Started.current = true; setM24Loading(true); M24.load(import.meta.env.BASE_URL).then((m) => { setM24(m); if (m.source === 'api') announce(langRef.current === 'en' ? 'Monthly layer file could not be loaded; using the team API as backup. Layers will sound after a short loading pause.' : 'Aylık katman dosyası yüklenemedi; ekip API\'si yedek olarak kullanılıyor. Katmanlar kısa bir yüklemeden sonra çalar.'); }).catch((e) => setErr(String(e))).finally(() => setM24Loading(false)); };
  const [pickOpen, setPickOpen] = useState(false);
  // iki yeri karşılaştırma: B yeri, sırayla dinleme ve tur sayacı
  const [pickFor, setPickFor] = useState<'A' | 'B'>('A');
  const [placeB, setPlaceB] = useState<Place | null>(null);
  const [compare, setCompare] = useState(false);
  const [cmpTurn, setCmpTurn] = useState(0);
  const [storiesOpen, setStoriesOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [soundOpen, setSoundOpen] = useState(false);
  const [story, setStory] = useState<string | null>(null);
  const [narrator, setNarratorS] = useState(() => store.get('narrator') === '1');
  const [events, setEvents] = useState<{ status: 'idle' | 'loading' | 'ok' | 'error'; list: { id: string; title: string; cat: string; lat: number; lon: number; date: string }[] }>({ status: 'idle', list: [] });
  const [mix, setMixS] = useState<Mix>(() => { try { const m = JSON.parse(store.get('mix') ?? 'null'); return m ? { ...DEFAULT_MIX, ...m, vol: { ...DEFAULT_MIX.vol, ...m.vol }, inst: { ...DEFAULT_MIX.inst, ...m.inst } } : DEFAULT_MIX; } catch { return DEFAULT_MIX; } });
  const setMix = (m: Mix) => { setMixS(m); store.set('mix', JSON.stringify(m)); };
  useEffect(() => {
    engine.setMaster(mix.master); engine.setReverb(mix.reverb); speech.setRate(mix.rate);
    engine.mix.vol = { co2: mix.vol.co2, temp: mix.vol.temp, sst: mix.vol.sst, black_carbon: mix.vol.aerosol, dust: mix.vol.aerosol, sea_salt: mix.vol.aerosol, sulfate: mix.vol.aerosol };
    engine.mix.inst = { ...mix.inst };
  }, [mix]);
  /** Karşılaştırmada sırası gelen yer (A ya da B); yoksa seçili yer. */
  const active = compare && placeB && cmpTurn % 2 === 1 ? placeB : place;
  const [aboutOpen, setAboutOpen] = useState(false);
  const [live, setLive] = useState('');
  const [audioOk, setAudioOk] = useState(true);
  // Duyuru: sesli rehber açıksa tarayıcı konuşur; kapalıysa ekran okuyucuya (aria-live) bırakılır — ikisi üst üste binmez.
  const capture = useRef<string[] | null>(null);
  const announce = useCallback((t: string) => {
    if (capture.current) { capture.current.push(t); return; }
    if (guideRef.current && speech.supported) { void speech.say(t); return; }
    setLive(''); requestAnimationFrame(() => setLive(t));
  }, []);
  announceRef.current = announce;
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
    if (!showVideo) return; // video oynamıyorken kareyi kullanıcı seçer (tarih seçici)
    const id = setInterval(() => { const f = sst.frameAt(video.currentTime); setSstFrame((p) => (p === f ? p : f)); }, 500);
    return () => clearInterval(id);
  }, [on.sst, sst, video, showVideo]);
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
  // ---------- radar katmanları
  const layers = useMemo(() => {
    const L: RadarLayer[] = [];
    const named = (id: 'co2' | 'temp' | 'sst', l: RadarLayer): RadarLayer => (mix.inst[id] && mix.inst[id] !== id ? { ...l, instrument: instrumentName(mix.inst[id], lang) } : l);
    if (on.co2 && co2) L.push(named('co2', co2.radarLayer(month, lang)));
    if (on.temp && temp) L.push(named('temp', temp.radarLayer(tFrame, lang)));
    if (on.sst && sst) L.push(named('sst', sst.radarLayer(sstFrame, lang)));
    if (on.aerosol && aer) L.push(...aer.radarLayers(lang));
    if (m24) m24.meta.layers.forEach((l, i) => { if (m24On[l.id]) L.push(m24.radarLayer(i, month, lang)); });
    return L;
  }, [m24Rev, on, co2, temp, sst, aer, month, tFrame, sstFrame, lang, mix.inst, m24, m24On]);

  const advanceRef = useRef(advance); advanceRef.current = advance;
  const anyM24RefOn = useRef(false); anyM24RefOn.current = anyM24On;
  // zaman uyumsuz akışların (hikâye, anlatıcı, tur geri çağrısı) güncel durumu okuması için
  const live2 = useRef({ compare: false, story: null as string | null, narrator: false, place: null as Place | null, placeB: null as Place | null, co2, temp, aer, cities, rangeKm, month, tFrame, lang });
  live2.current = { compare: compare && !!placeB, story, narrator, place, placeB, co2, temp, aer, cities, rangeKm, month, tFrame, lang };
  const narrIdx = useRef(0);
  /** Anlatıcı: her turun sonunda (başka konuşma yoksa) bir katman hakkında kısa bir bilgi. */
  const narrate = () => {
    const S = live2.current, R = radarRef.current;
    if (!S.narrator || S.story || speech.active || !R.computed.length || !R.P) return;
    const { layer, vals } = R.computed[narrIdx.current++ % R.computed.length];
    let best = -1, bv = -Infinity; vals.forEach((v, i) => { if (!Number.isNaN(v) && v > bv) { bv = v; best = i; } });
    if (best < 0) return;
    const dir = compass8(((Math.floor(best / R.P.rings)) * 360) / R.P.beams, S.lang), c = layer.sample(R.P.center);
    void speech.say(S.lang === 'en'
      ? `${layer.label}: ${Number.isNaN(c) ? 'no data at the center' : layer.fmt(c) + ' at the center'}; highest toward the ${dir}, ${layer.fmt(bv)}.`
      : `${layer.label}: ${Number.isNaN(c) ? 'merkezde veri yok' : 'merkezde ' + layer.fmt(c)}; en yüksek ${dir} yönünde, ${layer.fmt(bv)}.`);
  };
  const radar = useRadar({
    placeName: active ? placeLabel(active) : '', center: active, layers, rangeKm, mode, scale, lang, announce,
    pair: compare && place && placeB ? [{ tag: 'A', name: placeLabel(place), center: place }, { tag: 'B', name: placeLabel(placeB), center: placeB }] : null,
    beamPlaces: (br) => {
      if (!cities || !active) return '';
      const hits = cities.inSector(active, br, 180 / 32 + 3, rangeKm, 2);
      if (!hits.length) return lang === 'en' ? 'No large city in this direction.' : 'Bu yönde büyük şehir yok.';
      return (lang === 'en' ? 'In this direction: ' : 'Bu yönde: ') + hits.sort((x, y) => x.km - y.km).map((h) => `${h.row[0]}, ${formatKm(h.km)}`).join('; ') + '.';
    },
    onRevolution: () => {
      if (live2.current.compare) { setCmpTurn((t) => t + 1); return; }          // karşılaştırmada zaman sabit kalır, yer değişir
      if (advanceRef.current && (on.co2 || anyM24RefOn.current) && !live2.current.story) setMonth((m) => (m + 1) % 12);
      narrate();
    },
  });
  const radarRef = useRef(radar); radarRef.current = radar;
  /** Ölçek anahtarı (Adım 2). Ses değişir; okunan değerler hep gerçek değerdir. */
  const setScale = (s: Scale) => {
    setScaleS(s);
    const en = langRef.current === 'en';
    announce(s === 'local'
      ? (en ? 'Local scale: the lowest value in this area is the lowest note, the highest value the highest note. Small differences become audible. Spoken values are always the real values.' : 'Yerel ölçek: bu alandaki en düşük değer en pes, en yüksek değer en ince nota. Küçük farklar da duyulur. Okunan değerler her zaman gerçek değerdir.')
      : (en ? 'Global scale: the same value is the same note everywhere. Use it to compare places.' : 'Küresel ölçek: aynı değer her yerde aynı nota. Yerleri karşılaştırmak için.'));
  };

  const toggleLayer = (id: LayerId) => {
    const v = !on[id];
    if (v) setM24Visual(null);
    setOn((o) => ({ ...o, [id]: v }));
    if (v) setVisual(id);
    else if (visual === id) { const rest = (Object.keys(on) as LayerId[]).find((k) => k !== id && on[k]); if (rest) setVisual(rest); }
    const U = LAYER_UI[id];
    announce(lang === 'en' ? `${U.label.en} ${v ? `on: ${U.instrument.en}` : 'off'}.` : `${U.label.tr} ${v ? `açıldı: ${U.instrument.tr}` : 'kapandı'}.`);
  };

  // ---------- yer değişince duyuru. Radar çalıyorsa kısa tut (müzik kesilmeden yeni yerin sesi gelir).
  const playingRef = useRef(false); playingRef.current = radar.playing;
  useEffect(() => {
    if (!place || !co2) return;
    const name = placeLabel(place);
    if (playingRef.current) { announce(`${name}.`); return; }
    const ppm = co2.grid.bilinear(place, month).toFixed(1);
    announce(lang === 'en'
      ? `${name} selected. Carbon dioxide at the center: ${ppm} ppm, ${co2.monthLabel(month, 'en')}. Press Space to play the radar, or press T and say "play". Press L for the audio legend, H for help.`
      : `${name} seçildi. Merkezde karbondioksit ${ppm} ppm, ${co2.monthLabel(month)}. Radarı çalmak için Boşluk tuşuna bas ya da T tuşuna basıp "çal" de. Sesli lejant için L, yardım için H.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, co2]);

  // ---------- sesli rehber: karşılama, yardım, düğme adlarını okuma, kısayollar
  const helpText = useCallback(() => (langRef.current === 'en'
    ? 'EarthEar help. Press T and speak a command, for example: go to Ankara, play, stop, temperature on, summary. Moving the mouse over the globe says the name of the place under it. Press C to choose a place: type a city name, pick with the down arrow, confirm with Enter. Space plays or stops the radar. Each data layer is an instrument: keys 1 to 4 turn layers on and off. 1 carbon dioxide, violin. 2 surface temperature, guitar. 3 ocean temperature, harp and waves. 4 aerosols. While the music plays, travel across the Earth with I for north, K for south, J for west and M for east. Left and right arrows turn the beam by hand. B compares with a second place, Y opens Earth stories, E lists natural events near you, V opens your soundscape settings, N turns the narrator on. Dates are chosen in the layers panel and the date bar. S reads a summary, L plays the audio legend, Escape silences speech, G turns this voice guide off if you use a screen reader. H repeats this help.'
    : 'EarthEar yardım. T tuşuna basıp komut söyleyebilirsin, örneğin: Ankara\'ya git, çal, dur, sıcaklığı aç, özet. Fareyi Dünya üzerinde gezdirince altındaki yerin adı söylenir. Yer seçmek için C tuşuna bas: şehir adını yaz, aşağı okla seç, Enter ile onayla. Boşluk radarı çalar ya da durdurur. Her veri katmanı bir enstrümandır: 1 ile 4 arası tuşlar katmanları açıp kapatır. 1 karbondioksit, keman. 2 yüzey sıcaklığı, gitar. 3 okyanus sıcaklığı, arp ve dalga sesi. 4 aerosoller. Müzik çalarken Dünya üzerinde gezmek için I kuzey, K güney, J batı, M doğu tuşlarını kullan. Sol ve sağ ok ışını elle çevirir. B ikinci bir yerle karşılaştırır, Y Dünya hikâyelerini açar, E yakındaki doğa olaylarını listeler, V ses sahneni açar, N anlatıcıyı açar. Tarihler katmanlar panelinden ve tarih çubuğundan seçilir. S özeti okur, L sesli lejantı çalar, Escape konuşmayı susturur. Ekran okuyucu kullanıyorsan G tuşu bu sesli rehberi kapatır. H bu yardımı tekrarlar.'), []);
  const welcomed = useRef(false);
  // ---------- tek dokunuşla başlama + eller serbest dinleme (kör kullanıcı için tuş bilmek gerekmez)
  const [started, setStarted] = useState(false);
  const [hfWanted, setHfWantedS] = useState(() => store.get('hf') !== '0'); // eller serbest dinleme tercihi (varsayılan açık)
  const hfWantedRef = useRef(hfWanted); hfWantedRef.current = hfWanted;
  const [hfLive, setHfLive] = useState(false);       // şu an sürekli dinliyor mu
  const hfStoppedByVoice = useRef(false);
  const wakeUntil = useRef(0); // "Dünya" tek başına söylenince kısa süre komut beklenir             // "sus" / "dinlemeyi durdur" ile kapandı → herhangi bir tuş tekrar açar
  const hfApi = useRef({ start: (_say: boolean) => {}, stop: (_byVoice: boolean) => {}, unavailable: () => {} });
  const welcome = useCallback(() => {
    if (welcomed.current) return; welcomed.current = true;
    setStarted(true);
    setTimeout(() => document.querySelector<HTMLElement>('.speak-btn')?.focus(), 60); // başlatma katmanı kalkınca odak Konuş düğmesine
    engine.unlock(); // AudioContext kullanıcı hareketiyle açılır
    const en = langRef.current === 'en';
    const canListen = listener.supported && hfWantedRef.current;
    const msg = canListen
      ? (en ? 'Hello, I am EarthEar. I am listening to you. We recommend wearing headphones. Start each command with "Earth", for example: Earth, go to Tokyo. For help say "Earth, help".'
        : 'Merhaba, ben EarthEar. Sizi dinliyorum. Kulaklık takmanızı öneririz. Komut vermek için cümleye "Dünya" diye başlayın, örneğin: Dünya, Sivas\'ı aç. Yardım için "Dünya, yardım" deyin.')
      : (en ? 'Hello, I am EarthEar. We recommend wearing headphones. Voice commands are not available right now. You can type commands: type a city name in the command box, for example Sivas.'
        : 'Merhaba, ben EarthEar. Kulaklık takmanızı öneririz. Sesli komut şu an kullanılamıyor. Yazarak komut verebilirsiniz: komut kutusuna bir şehir adı yazın, örneğin Sivas.');
    setLive(''); requestAnimationFrame(() => setLive(msg)); // ekran okuyucu her zaman duyar
    if (canListen) hfApi.current.start(false);          // mikrofon izni hemen istenir (kullanıcı hareketiyle); kendi sesimiz yankı süzgecinde
    const after = () => { if (canListen && handsFree.enabled) engine.beep(); else if (!listener.supported) hfApi.current.unavailable(); };
    if (guideRef.current && speech.supported) void speech.say(msg).then(after); else after();
  }, []);

  // düğmenin, bağlantının, kaydırıcının adını oku (fare üstüne gelince ya da klavyeyle odaklanınca)
  useEffect(() => {
    let last: Element | null = null, timer = 0;
    const nameOf = (el: Element): string => {
      const h = el as HTMLElement;
      const aria = h.getAttribute('aria-label');
      let t = aria ?? '';
      if (!t && h.getAttribute('aria-labelledby')) t = h.getAttribute('aria-labelledby')!.split(' ').map((id) => document.getElementById(id)?.innerText ?? '').join(' ');
      if (!t && h instanceof HTMLInputElement) t = (h.labels?.[0]?.innerText ?? h.closest('label')?.innerText ?? h.placeholder ?? '');
      if (!t && h instanceof HTMLSelectElement) t = `${h.closest('label')?.childNodes[0]?.textContent ?? ''} ${h.selectedOptions[0]?.text ?? ''}`;
      if (!t) t = h.innerText ?? '';
      t = t.replace(/\s+/g, ' ').trim();
      const en = langRef.current === 'en';
      const pressed = h.getAttribute('aria-pressed') ?? (h instanceof HTMLInputElement && (h.type === 'checkbox' || h.type === 'radio') ? String(h.checked) : null);
      if (pressed === 'true') t += en ? ', on' : ', açık'; else if (pressed === 'false') t += en ? ', off' : ', kapalı';
      const vt = h.getAttribute('aria-valuetext'); if (vt) t += `, ${vt}`;
      return t;
    };
    const handle = (target: EventTarget | null, viaMouse: boolean) => {
      if (!guideRef.current || !(target instanceof Element)) return;
      const el = target.closest('button, a[href], input, select, [role="option"], [role="combobox"]');
      if (!el || el === last) return;
      last = el;
      clearTimeout(timer);
      timer = window.setTimeout(() => { const t = nameOf(el); if (t) speech.hint(t); }, viaMouse ? 160 : 30);
    };
    const over = (e: Event) => handle(e.target, true);
    const focus = (e: Event) => handle(e.target, false);
    const out = (e: Event) => { if (e.target instanceof Element && last && e.target.closest('button, a[href], input, select, [role="option"]') === last) last = null; };
    document.addEventListener('mouseover', over); document.addEventListener('focusin', focus); document.addEventListener('mouseout', out);
    return () => { clearTimeout(timer); document.removeEventListener('mouseover', over); document.removeEventListener('focusin', focus); document.removeEventListener('mouseout', out); };
  }, []);

  // yer seçme penceresi açılınca ne yapılacağını söyle
  useEffect(() => {
    if (!pickOpen) return;
    welcomed.current = true;
    announce(pickFor === 'B' ? (lang === 'en' ? 'Choose the second place to compare. Type a city name and press Enter.' : 'Karşılaştırılacak ikinci yeri seç. Şehir adını yaz ve Enter tuşuna bas.') : lang === 'en' ? 'Choose a place. Type a city name, move through results with the down arrow, press Enter to select. Escape closes.' : 'Bir yer seç. Şehir adını yaz, sonuçlarda aşağı okla gez, Enter ile seç. Escape kapatır.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickOpen]);

  // ---------- karşılaştırma: sırası gelen yeri söyle; farkı söyle
  useEffect(() => {
    if (!compare || !placeB || !place || !playingRef.current) return;
    announce(`${cmpTurn % 2 === 1 ? 'B' : 'A'}: ${(cmpTurn % 2 === 1 ? placeB : place).name}.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmpTurn]);
  const sayDiff = () => {
    if (!place || !placeB) return;
    const en = lang === 'en';
    const parts = layers.map((l) => {
      const a = l.sample(place), b = l.sample(placeB);
      if (Number.isNaN(a) || Number.isNaN(b)) return en ? `${l.label}: no data at one of the places.` : `${l.label}: yerlerden birinde veri yok.`;
      const d = Math.abs(a - b), hi = a > b ? place.name : placeB.name;
      const diff = l.unit === 'ppm' ? `${d.toFixed(1)} ppm` : l.unit === '°C' ? `${Math.round(d)} ${en ? 'degrees' : 'derece'}` : `${Math.round(d * 100)}`;
      const same = l.unit === 'ppm' ? d < 0.05 : l.unit === '°C' ? d < 0.5 : d < 0.01;
      return en ? `${l.label}: ${place.name} ${l.fmt(a)}, ${placeB.name} ${l.fmt(b)}. ${same ? 'About the same.' : `${hi} is higher by ${diff}.`}`
        : `${l.label}: ${place.name} ${l.fmt(a)}, ${placeB.name} ${l.fmt(b)}. ${same ? 'Neredeyse aynı.' : `${hi} ${diff} daha yüksek.`}`;
    });
    const km = formatKm(haversineKm(place, placeB));
    announce((en ? `${place.name} and ${placeB.name} are ${km} apart. ` : `${place.name} ile ${placeB.name} arası ${km}. `) + (parts.length ? parts.join(' ') : en ? 'No layer is on.' : 'Hiç katman açık değil.'));
  };

  // ---------- anlatıcı
  const setNarrator = (v: boolean) => {
    setNarratorS(v); store.set('narrator', v ? '1' : '0');
    announce(v ? (lang === 'en' ? 'Narrator on: a short fact after every sweep.' : 'Anlatıcı açık: her turun sonunda kısa bir bilgi.') : (lang === 'en' ? 'Narrator off.' : 'Anlatıcı kapalı.'));
  };

  // ---------- Dünya olayları (NASA EONET: son 30 günün açık doğa olayları)
  const CAT: Record<string, { tr: string; en: string }> = {
    wildfires: { tr: 'Orman yangını', en: 'Wildfire' }, severeStorms: { tr: 'Şiddetli fırtına', en: 'Severe storm' }, volcanoes: { tr: 'Yanardağ', en: 'Volcano' },
    seaLakeIce: { tr: 'Deniz ve göl buzu', en: 'Sea and lake ice' }, floods: { tr: 'Sel', en: 'Flood' }, drought: { tr: 'Kuraklık', en: 'Drought' },
    dustHaze: { tr: 'Toz ve pus', en: 'Dust and haze' }, earthquakes: { tr: 'Deprem', en: 'Earthquake' }, landslides: { tr: 'Heyelan', en: 'Landslide' },
    snow: { tr: 'Kar', en: 'Snow' }, tempExtremes: { tr: 'Aşırı sıcaklık', en: 'Temperature extreme' }, waterColor: { tr: 'Su rengi değişimi', en: 'Water color' }, manmade: { tr: 'İnsan kaynaklı olay', en: 'Human-made event' },
  };
  const nearEvents: EarthEvent[] = useMemo(() => {
    if (!place) return [];
    return events.list.map((e) => ({ id: e.id, title: e.title, category: CAT[e.cat]?.[lang] ?? e.cat, lat: e.lat, lon: e.lon, date: e.date.slice(0, 10), km: haversineKm(place, e), dir: compass8(bearingTo(place, e), lang) }))
      .sort((a, b) => a.km - b.km).slice(0, 8); // dünyadaki tüm açık olaylardan sana en yakın 8'i
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.list, place, lang]);
  const eventsSaid = useRef(false);
  const openEvents = () => {
    setEventsOpen(true); eventsSaid.current = false;
    if (events.status === 'ok' || events.status === 'loading') return;
    setEvents({ status: 'loading', list: [] });
    fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30&limit=300')
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((j: { events: { id: string; title: string; categories: { id: string }[]; geometry: { date: string; type: string; coordinates: number[] }[] }[] }) => {
        const list = j.events.flatMap((e) => {
          const g = e.geometry[e.geometry.length - 1];
          return g && g.type === 'Point' ? [{ id: e.id, title: e.title, cat: e.categories[0]?.id ?? '', lon: g.coordinates[0], lat: g.coordinates[1], date: g.date }] : [];
        });
        setEvents({ status: 'ok', list });
      })
      .catch(() => setEvents({ status: 'error', list: [] }));
  };
  useEffect(() => {
    if (!eventsOpen || eventsSaid.current || events.status === 'idle' || events.status === 'loading') return;
    eventsSaid.current = true;
    const en = lang === 'en';
    if (events.status === 'error') { announce(en ? 'Could not load Earth events. An internet connection is needed.' : 'Dünya olayları alınamadı. İnternet bağlantısı gerekli.'); return; }
    if (!nearEvents.length) { announce(en ? 'There are no open natural events right now.' : 'Şu anda açık doğa olayı yok.'); return; }
    const n = nearEvents[0];
    announce(en ? `The ${nearEvents.length} open natural events nearest to you. The nearest: ${n.category}, ${n.title}, ${formatKm(n.km)} to the ${n.dir}. Use Tab to move through the list and Enter to go there.`
      : `Sana en yakın ${nearEvents.length} açık doğa olayı listelendi. En yakını: ${n.category}, ${n.title}, ${n.dir} yönünde ${formatKm(n.km)} uzakta. Listede Tab ile gez, Enter ile oraya git.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsOpen, events.status, nearEvents]);

  // ---------- Dünya hikâyeleri: seçilen yerden başlayan, veriyle anlatılan rehberli yolculuklar (kodda sabit yer yok)
  const storyRun = useRef(0);
  const stopStory = () => { if (!live2.current.story) return; storyRun.current++; setStory(null); speech.stop(); };
  const storyList: StoryInfo[] = lang === 'en' ? [
    { id: 'breath', title: 'The planet breathes', text: 'One year of carbon dioxide above your place, month by month (violin).' },
    { id: 'journey', title: 'Journey toward the equator', text: 'Travel from your place toward the equator and hear the temperature change (guitar).' },
    { id: 'dust', title: 'Travelers in the air', text: 'Find the densest dust within 5000 km of your place and go there (celesta).' },
  ] : [
    { id: 'breath', title: 'Gezegenin nefesi', text: 'Bulunduğun yerin üstündeki karbondioksitin bir yılı, ay ay (keman).' },
    { id: 'journey', title: 'Ekvatora yolculuk', text: 'Bulunduğun yerden ekvatora doğru git, sıcaklığın değişimini dinle (gitar).' },
    { id: 'dust', title: 'Havadaki yolcular', text: '5000 km içindeki en yoğun tozu bul ve oraya git (çelesta).' },
  ];
  const runStory = async (id: string) => {
    const start = live2.current.place; if (!start) return;
    const run = ++storyRun.current, en = live2.current.lang === 'en';
    const alive = () => run === storyRun.current;
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const tell = async (t: string) => { if (alive()) await speech.say(t); return alive(); };
    const until = async (ok: () => boolean, ms = 10000) => { const t0 = Date.now(); while (!ok() && Date.now() - t0 < ms && alive()) await sleep(150); return ok(); };
    const nameOf = (p: LatLon) => { const n = live2.current.cities?.nearest(p, 150); return n ? n.row[0] : formatLatLon(p); };
    const only = (k: LayerId) => { setOn({ co2: k === 'co2', temp: k === 'temp', sst: k === 'sst', aerosol: k === 'aerosol' }); setVisual(k); };
    const title = storyList.find((s) => s.id === id)?.title ?? id;
    radarRef.current.hush(); setCompare(false); setStory(title); engine.unlock();
    const prevMode = mode, prevAdvance = advance;
    try {
      if (id === 'breath') {
        const co2s = live2.current.co2; if (!co2s) return;
        only('co2'); setAdvance(false); setMode('bilim'); setMonth(0);
        const series = co2s.grid.monthSeries(start);
        if (!await tell(en ? `The planet breathes. You will hear one year of carbon dioxide above ${start.name}. When the violin rises, there is more carbon dioxide in the air.`
          : `Gezegenin nefesi. ${start.name} üzerindeki karbondioksitin bir yılını dinleyeceksin. Keman inceldikçe havadaki karbondioksit artar.`)) return;
        await sleep(200); if (!radarRef.current.playing) radarRef.current.play();
        for (let m = 0; m < 12; m++) {
          if (!alive()) return;
          setMonth(m);
          if (!await tell(`${monthName(m, en ? 'en' : 'tr')}: ${series[m].toFixed(1)}.`)) return;
          await sleep(2600);
        }
        let hi = 0, lo = 0; series.forEach((v, i) => { if (v > series[hi]) hi = i; if (v < series[lo]) lo = i; });
        await tell(en ? `Highest in ${monthName(hi, 'en')}, ${series[hi].toFixed(1)} parts per million. Lowest in ${monthName(lo, 'en')}, ${series[lo].toFixed(1)}. A difference of ${(series[hi] - series[lo]).toFixed(1)}. Plants take carbon dioxide out of the air while they grow and give it back when they rest; this is how the planet breathes. This data is from 2021.`
          : `En yüksek ${monthName(hi)} ayında, milyonda ${series[hi].toFixed(1)}. En düşük ${monthName(lo)} ayında, ${series[lo].toFixed(1)}. Aradaki fark ${(series[hi] - series[lo]).toFixed(1)}. Bitkiler büyürken havadan karbondioksit çeker, dinlenirken geri verir; gezegen böyle nefes alır. Bu veriler 2021 yılına aittir.`);
      } else if (id === 'journey') {
        only('temp');
        if (!await until(() => !!live2.current.temp)) { await tell(en ? 'Temperature data could not be loaded.' : 'Sıcaklık verisi yüklenemedi.'); return; }
        const t = live2.current.temp!, frame = live2.current.tFrame || t.frames - 1, dir = start.lat >= 0 ? 180 : 0;
        const val = (p: LatLon) => t.layer.sample(frame, p);
        const total = Math.abs(start.lat) * 111, steps = Math.max(2, Math.min(8, Math.round(total / 700)));
        if (!await tell(en ? `Journey toward the equator. We leave ${start.name} and travel ${dir === 180 ? 'south' : 'north'}. When the guitar rises, the surface is warmer.`
          : `Ekvatora yolculuk. ${start.name} üzerinden ${dir === 180 ? 'güneye' : 'kuzeye'} doğru gidiyoruz. Gitar inceldikçe yüzey daha sıcak.`)) return;
        await sleep(200); if (!radarRef.current.playing) radarRef.current.play();
        const v0 = val(start); let vLast = v0;
        for (let i = 1; i <= steps; i++) {
          if (!alive()) return;
          const p = destination(start, dir, (i * total) / steps);
          pickPoint(p, 'harita'); await sleep(350);
          const v = val(p); if (!Number.isNaN(v)) vLast = v;
          if (!await tell(`${nameOf(p)}: ${Number.isNaN(v) ? (en ? 'no data' : 'veri yok') : `${Math.round(v)} ${en ? 'degrees' : 'derece'}`}.`)) return;
          await sleep(2800);
        }
        await tell(en ? `We reached the equator. At the start it was ${Math.round(v0)} degrees, here it is ${Math.round(vLast)}: a difference of ${Math.abs(Math.round(vLast - v0))} degrees. The Sun's light falls more directly near the equator. This is a NASA model image of surface air temperature, ${t.dateLabel(frame, 'en')}.`
          : `Ekvatora vardık. Başlangıçta ${Math.round(v0)} dereceydi, burada ${Math.round(vLast)} derece: ${Math.abs(Math.round(vLast - v0))} derece fark. Güneş ışığı ekvatora daha dik gelir. Bu, NASA'nın yüzey hava sıcaklığı model görselidir, ${t.dateLabel(frame)}.`);
      } else if (id === 'dust') {
        only('aerosol');
        if (!await until(() => !!live2.current.aer)) { await tell(en ? 'Aerosol data could not be loaded.' : 'Aerosol verisi yüklenemedi.'); return; }
        const dust = live2.current.aer!.layers.dust;
        let best = { v: 0, br: 0, km: 0 };
        for (let br = 0; br < 360; br += 10) for (let km = 250; km <= 5000; km += 250) { const v = dust.sample(0, destination(start, br, km)); if (v > best.v) best = { v, br, km }; }
        if (best.v < 0.08) { await tell(en ? `Travelers in the air. There is no dense dust within 5000 kilometers of ${start.name} in this image.` : `Havadaki yolcular. Bu görselde ${start.name} çevresinde 5000 kilometre içinde yoğun toz yok.`); return; }
        if (!await tell(en ? `Travelers in the air. The densest dust is ${formatKm(best.km)} to the ${compass8(best.br, 'en')} of ${start.name}. We are going there. The celesta bells are dust.`
          : `Havadaki yolcular. En yoğun toz ${start.name} üzerinden ${compass8(best.br)} yönünde, ${formatKm(best.km)} uzakta. Oraya gidiyoruz. Çelesta çanları tozu gösterir.`)) return;
        await sleep(200); if (!radarRef.current.playing) radarRef.current.play();
        for (let i = 1; i <= 4; i++) {
          if (!alive()) return;
          const p = destination(start, best.br, (best.km * i) / 4);
          pickPoint(p, 'harita'); await sleep(350);
          if (!await tell(`${nameOf(p)}.`)) return;
          await sleep(3200);
        }
        await tell(en ? `We are inside the dust. Relative density ${Math.round(best.v * 100)}. Wind can carry dust thousands of kilometers away from where it rose. This NASA model image is from 19 August 2025.`
          : `Tozun içindeyiz. Göreli yoğunluk ${Math.round(best.v * 100)}. Rüzgâr tozu kalktığı yerden binlerce kilometre uzağa taşıyabilir. Bu NASA model görseli 19 Ağustos 2025 tarihlidir.`);
      }
    } finally {
      if (alive()) setStory(null);
      setMode(prevMode); setAdvance(prevAdvance);
    }
  };

  // ---------- haritadaki yerlerin adları: fare küre/harita üstünde gezerken altındaki yeri söyle
  const describePoint = useCallback((p: LatLon): string => {
    const C = live2.current.cities, en = langRef.current === 'en';
    const big = C?.notable(p, 150);
    if (big) return `${big[0]}, ${countryName(big[1])}`;
    const sea = landRef.current ? !landRef.current.isLand(p) : false;
    const near = C?.nearest(p, 900);
    // deniz adı: kaba kutularla (kıyı ayrıntısı yok; yalnızca yön bulmaya yardım için)
    const seaName = (): [string, string] => {
      const { lat, lon } = p;
      if (lat > 40.5 && lat < 47.5 && lon > 27 && lon < 42) return ['Karadeniz', 'Black Sea'];
      if (lat > 30 && lat < 46 && lon > -6 && lon < 36.5) return ['Akdeniz', 'Mediterranean Sea'];
      if (lat > 66) return ['Arktik Okyanusu', 'Arctic Ocean'];
      if (lat < -60) return ['Güney Okyanusu', 'Southern Ocean'];
      if ((lon > -70 && lon <= 20) || (lon > -100 && lon <= -70 && lat > 8 && lat < 31) || (lon > -82 && lon <= -70 && lat >= 31)) return ['Atlas Okyanusu', 'Atlantic Ocean'];
      if ((lon > 20 && lon <= 120 && lat < 30) || (lon > 120 && lon <= 147 && lat < -10)) return ['Hint Okyanusu', 'Indian Ocean'];
      return ['Büyük Okyanus', 'Pacific Ocean'];
    };
    const where = sea ? seaName()[en ? 1 : 0] : (en ? 'Land' : 'Kara');
    if (near) return en ? `${where}. Nearest city ${near.row[0]}, ${formatKm(near.km)}.` : `${where}. En yakın şehir ${near.row[0]}, ${formatKm(near.km)}.`;
    const la = Math.round(Math.abs(p.lat)), lo = Math.round(Math.abs(p.lon));
    return en ? `${where}. ${la} degrees ${p.lat >= 0 ? 'north' : 'south'}, ${lo} degrees ${p.lon >= 0 ? 'east' : 'west'}.`
      : `${where}. ${la} derece ${p.lat >= 0 ? 'kuzey' : 'güney'}, ${lo} derece ${p.lon >= 0 ? 'doğu' : 'batı'}.`;
  }, []);
  const lastHover = useRef('');
  const onHover = useCallback((p: LatLon | null) => {
    if (!p) { lastHover.current = ''; return; }
    if (!guideRef.current) return;
    const t = describePoint(p);
    if (t === lastHover.current) return;
    lastHover.current = t;
    speech.hint(t);
  }, [describePoint]);

  // ---------- sesli komutlar: T tuşuna (ya da mikrofon düğmesine) bas, konuş; söyleneni yapar
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const findCity = (raw: string) => {
    const C = live2.current.cities; if (!C) return undefined;
    const STOP = new Set(['git', 'gidelim', 'gotur', 'goturur', 'musun', 'yer', 'sec', 'sehir', 'sehri', 'sehrine', 'lutfen', 'bana', 'beni', 'oraya', 'karsilastir', 'kiyasla', 'ile', 've', 'icin', 'dinle', 'dinlemek', 'istiyorum', 'ac',
      'go', 'to', 'take', 'me', 'choose', 'select', 'place', 'city', 'please', 'compare', 'with', 'the', 'listen', 'i', 'want', 'open']);
    // şehir listesi İngilizce adları kullanır; sık kullanılan Türkçe adlar (eş ad)
    const ALIAS: Record<string, string> = { roma: 'Rome', londra: 'London', moskova: 'Moscow', atina: 'Athens', viyana: 'Vienna', kahire: 'Cairo', pekin: 'Beijing', tahran: 'Tehran', bagdat: 'Baghdad', bruksel: 'Brussels', lizbon: 'Lisbon', varsova: 'Warsaw', prag: 'Prague', kudus: 'Jerusalem', munih: 'Munich', napoli: 'Naples', venedik: 'Venice', kopenhag: 'Copenhagen', lefkosa: 'Nicosia', tiflis: 'Tbilisi', erivan: 'Yerevan', selanik: 'Thessaloniki', cenevre: 'Geneva', floransa: 'Florence', belgrad: 'Belgrade', budapeste: 'Budapest', sofya: 'Sofia', bukres: 'Bucharest' };
    const words = raw.replace(/[’'`]\S*/g, ' ').replace(/[.,!?]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(fold(w))).map((w) => ALIAS[fold(w)] ?? w);
    const exact = (cand: string) => {
      for (let cut = 0; cut <= 4 && cand.length - cut >= 3; cut++) { // Türkçe ekler: "ankaraya", "sivasa", "izmire"
        const c = cand.slice(0, cand.length - cut), row = C.find(c);
        if (row && (fold(row[0]) === fold(c) || (cut === 0 && c.includes(' ') && fold(row[0]).startsWith(fold(c))))) return row; // "New York" → "New York City"
      }
      return undefined;
    };
    if (!words.length) return undefined;
    return exact(words.join(' ')) ?? (words.length > 1 ? exact(words.slice(-2).join(' ')) : undefined) ?? words.map(exact).find(Boolean)
      ?? (words.join(' ').length >= 4 ? C.find(words.join(' ')) : undefined);
  };
  const MONTH_WORDS = [['ocak', 'january'], ['subat', 'february'], ['mart', 'march'], ['nisan', 'april'], ['mayis', 'may'], ['haziran', 'june'], ['temmuz', 'july'], ['agustos', 'august'], ['eylul', 'september'], ['ekim', 'october'], ['kasim', 'november'], ['aralik', 'december']];
  const commandHelp = () => (lang === 'en'
    ? 'You can say or type: go to Ankara. Play. Stop. Temperature on. Ocean off. Sea temperature on. Precipitation on. Sea ice on. Summary. Legend. Go north. Range two thousand. July. Compare with Tokyo. Local scale. Tell the breath story. Events. Switch to Turkish. Stop listening. Help.'
    : 'Şunları söyleyebilir ya da yazabilirsin: Ankara\'ya git. Çal. Dur. Sıcaklığı aç. Okyanusu kapat. Deniz sıcaklığını aç. Yağışı aç. Deniz buzunu aç. Özet. Lejant. Kuzeye git. Menzil iki bin. Temmuz. Tokyo ile karşılaştır. Yerel ölçek. Nefes hikâyesini anlat. Olaylar. İngilizceye geç. Dinlemeyi durdur. Yardım.');
  /** Söylenen cümleyi komuta çevir ve uygula. Anlaşıldıysa true. */
  const runCommand = (text: string): boolean => {
    const en = lang === 'en', R = radarRef.current;
    const t = ` ${fold(text).replace(/[.,!?’'`]/g, ' ').replace(/\s+/g, ' ').trim()} `;
    const has = (...w: string[]) => w.some((x) => t.includes(x));
    const word = (...w: string[]) => w.some((x) => t.includes(` ${x} `));
    const needPlace = () => { if (place) return true; announce(en ? 'Choose a place first. Say, for example: go to Ankara.' : 'Önce bir yer seç. Örneğin şöyle söyle: Ankara\'ya git.'); return false; };

    // dil (Adım 4): "Switch to English", "English", "İngilizceye geç" / "Türkçeye geç", "Turkish", "Türkçe" — iki dilde de çalışır
    if (has('ingilizce', 'english', 'ingilizceye')) { setLang('en'); return true; }
    if (has('turkce', 'turkish', 'turkceye')) { setLang('tr'); return true; }
    if (word('yardim', 'help', 'komutlar', 'commands') || has('ne soyleyebilirim', 'what can i say')) { announce(commandHelp()); return true; }
    if (has('dinlemeyi durdur', 'dinlemeyi kapat', 'dinlemeyi birak', 'stop listening') || word('sus')) {
      R.hush(); stopStory(); hfApi.current.stop(true);
      announce(en ? 'Listening is off. Press any key or tap the screen to turn it back on.' : 'Dinleme kapandı. Tekrar açmak için herhangi bir tuşa basın ya da ekrana dokunun.');
      return true;
    }
    if (has('dinlemeye basla', 'dinlemeyi ac', 'dinlemeyi baslat', 'start listening')) { hfApi.current.start(true); return true; }
    if (word('sessiz', 'sessizlik', 'quiet', 'silence')) { R.hush(); stopStory(); return true; }

    if (has('hikaye', 'story', 'stories', 'oyku', 'gezegenin nefesi', 'planet breathes')) {
      if (!needPlace()) return true;
      if (has('nefes', 'breath')) { void runStory('breath'); return true; }
      if (has('ekvator', 'equator', 'yolculuk', 'journey')) { void runStory('journey'); return true; }
      if (has('toz', 'dust', 'yolcu', 'traveler')) { void runStory('dust'); return true; }
      setStoriesOpen(true);
      announce(en ? 'Three stories: the planet breathes, journey toward the equator, travelers in the air. Say, for example: tell the breath story.' : 'Üç hikâye var: Gezegenin nefesi, Ekvatora yolculuk, Havadaki yolcular. Örneğin şöyle söyle: nefes hikâyesini anlat.');
      return true;
    }
    if (has('olay', 'event')) { if (needPlace()) openEvents(); return true; }
    if (has('karsilastir', 'kiyasla', 'compare')) {
      if (!needPlace()) return true;
      const row = findCity(text);
      if (row) { const p = rowToPlace(row, 'arama'); setPlaceB(p); setCompare(true); setCmpTurn(0); announce(en ? `Comparing with ${placeLabel(p)}: one sweep here, one sweep there. Say "difference" to hear the numbers.` : `${placeLabel(p)} ile karşılaştırılıyor: bir tur burası, bir tur orası. Sayıları duymak için "fark" de.`); if (!R.playing) setTimeout(() => radarRef.current.play(), 300); }
      else { setPickFor('B'); setPickOpen(true); }
      return true;
    }
    if (has('yerel olcek', 'local scale', 'yerel')) { setScale('local'); return true; }
    if (has('kuresel olcek', 'global scale', 'kuresel', 'sabit olcek')) { setScale('global'); return true; }
    if (has('fark', 'difference')) { if (placeB) sayDiff(); else announce(en ? 'There is no second place yet. Say: compare with Tokyo.' : 'Henüz ikinci yer yok. Şöyle söyle: Tokyo ile karşılaştır.'); return true; }
    if (has('neredeyim', 'where am i', 'burasi neresi')) { if (needPlace()) announce(en ? `You are at ${placeLabel(active ?? place!)}.` : `${placeLabel(active ?? place!)} üzerindesin.`); return true; }
    if (has(' ozet', 'summary')) { if (needPlace()) R.summary(); return true; }
    if (has('lejant', 'legend', 'enstrumanlari tanit')) { if (needPlace()) void R.runLegend(); return true; }
    if (has('anlatici', 'narrator')) { setNarrator(!has('kapat', ' off ', 'kapa ')); return true; }

    // 2024 aylık NASA katmanları (önce: daha özgül ifadeler). "deniz sıcaklığı" → 2024 MERRA-2; "okyanus" → ECCO2 katmanı
    const m24id = has('deniz yuzeyi sicakl', 'deniz sicakl', 'sea surface temp', 'sea temperature', 'sea surface') ? 'sst_24'
      : has('yagis', 'yagmur', 'precip', ' rain') ? 'precip_24'
        : has('deniz buzu', ' buz', 'sea ice', ' ice ') ? 'seaice_24'
          : has('kukurt', 'so2', 's o 2', 'sulfur', 'sulphur') ? 'so2_24'
            : has('optik derinlik', ' aod', 'optical depth') ? 'aod_24'
              : has('albedo', 'yansitma', 'reflectiv') ? 'albedo_24'
                : has('deri sicakl', 'skin temp') ? 'ts_24'
                  : has('hava sicakl', 'air temp', 'iki metre', '2 metre') || (has('2024') && has('sicakl', 'temperature')) ? 't2m_24'
                    : has('ozon', 'ozone') ? 'o3_24'
                      : has('toprak nem', 'soil moist', 'soil wet', 'toprak islak') ? 'gwettop_24'
                      : has('yaprak', 'bitki ortusu', 'vejetasyon', 'leaf area', 'vegetation', ' lai ') ? 'lai_24'
                        : has('su depolama', 'yer alti suyu', 'water storage', 'groundwater', 'grace') ? 'twland_24'
                          : has('aylik karbon', 'monthly carbon') || (has('2021') && has('aylik', 'monthly') && has('karbon', 'co2', 'carbon')) ? 'co2_24' : null;
    if (m24id) {
      const want = has('kapat', 'kapa ', 'kaldir', ' off ', 'remove') ? false : has(' ac ', 'ekle', 'goster', ' on ', ' add ', 'dinle', 'listen') ? true : !m24On[m24id];
      setM24Layer(m24id, want);
      return true;
    }
    const layer: LayerId | null = has('okyanus', 'deniz', 'ocean', ' sea ') ? 'sst' : has('karbon', 'co2', 'c o 2', 'carbon') ? 'co2' : has('sicakl', 'temperature', ' isi ') ? 'temp' : has('aerosol', 'toz', 'duman', 'dust', 'smoke') ? 'aerosol' : null;
    if (layer) {
      const want = has('kapat', 'kapa ', 'kaldir', ' off ', 'remove') ? false : has(' ac ', 'ekle', 'goster', ' on ', ' add ', 'dinle', 'listen') ? true : !on[layer];
      if (on[layer] !== want) toggleLayer(layer);
      else announce(en ? `${LAYER_UI[layer].label.en} is already ${want ? 'on' : 'off'}.` : `${LAYER_UI[layer].label.tr} zaten ${want ? 'açık' : 'kapalı'}.`);
      return true;
    }

    if (has('sonraki ay', 'next month')) { setMonth((m) => (m + 1) % 12); return true; }
    if (has('onceki ay', 'previous month')) { setMonth((m) => (m + 11) % 12); return true; }
    const mi = MONTH_WORDS.findIndex((names) => names.some((n) => t.includes(` ${n} `) || t.includes(` ${n}a `) || t.includes(` ${n}e `)));
    if (mi >= 0 && co2) { setMonth(mi); announce(en ? `${co2.monthLabel(mi, 'en')}.` : `${co2.monthLabel(mi)}.`); return true; }

    if (has('menzil', 'range', 'kilometre', 'kilometer', 'yakinlas', 'uzaklas', 'zoom')) {
      const km = has('5000', 'bes bin', 'five thousand') ? 5000 : has('2000', 'iki bin', 'two thousand') ? 2000 : has('500', 'bes yuz', 'five hundred') ? 500
        : has('yakinlas', 'zoom in', 'daralt', 'kucult') ? (rangeKm === 5000 ? 2000 : 500) : has('uzaklas', 'zoom out', 'genislet', 'buyut') ? (rangeKm === 500 ? 2000 : 5000) : 0;
      if (km) { setRange(km); announce(en ? `Range ${km} kilometers.` : `Menzil ${km} kilometre.`); return true; }
    }
    if (word('hizli', 'hizlan', 'hizlandir', 'faster', 'fast')) { R.setRevSec(5); announce(en ? 'Faster.' : 'Hızlandı.'); return true; }
    if (word('yavas', 'yavasla', 'yavaslat', 'slower', 'slow')) { R.setRevSec(12); announce(en ? 'Slower.' : 'Yavaşladı.'); return true; }

    const dir = word('kuzey', 'kuzeye', 'north') ? 0 : word('dogu', 'doguya', 'east') ? 90 : word('guney', 'guneye', 'south') ? 180 : word('bati', 'batiya', 'west') ? 270 : -1;
    if (dir >= 0) { if (needPlace()) pickPoint(destination(place!, dir, rangeKm / 4), 'harita'); return true; }

    if (word('dur', 'durdur', 'stop', 'pause', 'duraklat', 'yeter')) { R.stop(); stopStory(); return true; }
    if (word('cal', 'baslat', 'basla', 'oynat', 'play', 'start', 'devam', 'dinle', 'muzik')) { if (needPlace() && !R.playing) R.play(); return true; }

    const goWords = has(' git ', 'gidelim', 'gotur', 'yer sec', ' go to ', 'take me', ' sehir', ' ac ', ' sec ', ' open ');
    const row = findCity(text);
    if (row && (goWords || fold(row[0]) === fold(text.replace(/[’'`]\S*/g, '').trim()))) {
      setPlace(rowToPlace(row, 'arama')); setPickOpen(false);
      if (!R.playing) setTimeout(() => radarRef.current.play(), 2500); // yer duyurusundan sonra müzik başlasın
      return true;
    }
    if (goWords) { setPickFor('A'); setPickOpen(true); return true; }
    return false;
  };
  const cmdRef = useRef(runCommand); cmdRef.current = runCommand;
  const [cmdHistory, setCmdHistory] = useState<CmdEntry[]>([]);
  const [guideStatus, setGuideStatus] = useState<GuideStatus>({ kind: 'idle' });
  const guideInput = useRef<HTMLInputElement>(null);
  const [guideOpen, setGuideOpenS] = useState(() => store.get('guideOpen') !== '0');
  const setGuideOpen = (v: boolean) => { setGuideOpenS(v); store.set('guideOpen', v ? '1' : '0'); };
  const EXAMPLES = { tr: 'Ankara\'ya git; çal; sıcaklığı aç', en: 'go to Tokyo; play; temperature on' };
  /** Sesli ya da yazılı komut: aynı çözümleyici. Anlaşılırsa onay sesi + "Anlaşıldı: …" + komutun kendi duyurusu; anlaşılmazsa 3 örnek. */
  const execCommand = (alts: string[], source: 'voice' | 'text') => {
    capture.current = [];
    let hit: string | null = null;
    try { for (const a of alts) if (cmdRef.current(a)) { hit = a; break; } } finally { /* duyurular aşağıda */ }
    const msgs = capture.current ?? []; capture.current = null;
    const en = langRef.current === 'en'; // dil komutu langRef'i hemen değiştirir → onay yeni dilde
    const text = hit ?? alts[0];
    let reply: string;
    if (hit) {
      engine.unlock(); engine.confirm(true);
      reply = [en ? `Understood: ${text}.` : `Anlaşıldı: ${text}.`, ...msgs].join(' ');
    } else {
      engine.unlock(); engine.confirm(false);
      reply = en ? `I did not understand: ${text}. Try for example: ${EXAMPLES.en}.` : `Anlamadım: ${text}. Örneğin şunları deneyebilirsin: ${EXAMPLES.tr}.`;
    }
    announce(reply);
    setGuideStatus({ kind: hit ? 'ok' : 'fail', text: reply });
    setCmdHistory((h) => [{ text, ok: !!hit, source, reply }, ...h].slice(0, 6));
    return !!hit;
  };
  /** Sesli komut kullanılamıyorsa yazılı kutuya yönlendir. */
  const toTextBox = (why: string) => {
    const en = langRef.current === 'en';
    const msg = `${why ? why + ' ' : ''}${en ? 'Voice commands are not available right now. You can type commands.' : 'Sesli komut şu an kullanılamıyor. Yazarak komut verebilirsiniz.'}`;
    announce(msg); setGuideStatus({ kind: 'error', text: msg });
    setGuideOpenS(true); setTimeout(() => guideInput.current?.focus(), 80);
  };
  const talk = (hold = false) => {
    const en = langRef.current === 'en';
    if (listener.active) { if (hold) return; listener.cancel(); setListening(false); engine.setMaster(mix.master); return; }
    if (!listener.supported) { toTextBox(''); return; }
    welcomed.current = true;
    radarRef.current.hush();                      // rehber sussun ki mikrofon kendi sesimizi duymasın
    engine.unlock(); engine.northTick(engine.now + 0.02);
    engine.setMaster(mix.master * 0.2);           // dinlerken müziği kıs
    setListening(true); setHeard(null); setGuideStatus({ kind: 'listening' });
    listener.once(langRef.current, (alts) => {
      setHeard(alts[0]);
      execCommand(alts, 'voice');
    }, (err) => {
      if (err === 'nospeech') { const m = en ? 'I did not hear anything. Press Alt+T and speak, or type the command.' : 'Bir şey duymadım. Alt+T\'ye basıp konuş ya da komutu yaz.'; announce(m); setGuideStatus({ kind: 'error', text: m }); return; }
      toTextBox(err === 'denied' ? (en ? 'Microphone permission was not given.' : 'Mikrofon izni verilmedi.')
        : err === 'network' ? (en ? 'Voice commands need an internet connection.' : 'Sesli komut için internet bağlantısı gerekli.')
          : (en ? 'Voice command failed.' : 'Sesli komut çalışmadı.'));
    }, () => { setListening(false); engine.setMaster(mix.master); setGuideStatus((s) => (s.kind === 'listening' ? { kind: 'idle' } : s)); }, hold);
  };
  // geliştirme: mikrofon olmadan komutları sınamak için
  if (import.meta.env.DEV) (window as unknown as { __cmd?: (t: string) => boolean }).__cmd = (t) => execCommand([t], 'text');
  const execRef = useRef(execCommand); execRef.current = execCommand;
  const mixRef = useRef(mix); mixRef.current = mix;
  hfApi.current = {
    start: (say: boolean) => {
      hfStoppedByVoice.current = false;
      if (!listener.supported) { hfApi.current.unavailable(); return; }
      handsFree.start(langRef.current, {
        onText: (alts) => {
          // Eller serbest: yalnız "Dünya" / "EarthEar" (EN "Earth") ile başlayan cümle komuttur; diğer konuşmalar SESSİZCE yok sayılır.
          // Yalnız "Dünya" denirse 8 sn boyunca bir sonraki cümle uyandırma kelimesi olmadan komut sayılır.
          const WAKE = /^\s*(dünya|dunya|earth\s?ear|earth|örtır|ört ır)\b[\s,.!:;-]*/i;
          const woke = alts.map((a) => (WAKE.test(a) ? a.replace(WAKE, '').trim() : null)).filter((x): x is string => x !== null);
          if (woke.length) {
            const rest = woke.filter(Boolean);
            if (!rest.length) { wakeUntil.current = Date.now() + 8000; engine.beep(); setGuideStatus({ kind: 'listening', text: langRef.current === 'en' ? 'Yes? Say the command.' : 'Evet? Komutu söyleyin.' }); return; }
            wakeUntil.current = 0; execRef.current(rest, 'voice'); return;
          }
          if (Date.now() < wakeUntil.current) { wakeUntil.current = 0; execRef.current(alts, 'voice'); return; }
          // uyandırma kelimesi yok → oda konuşması: hiçbir şey yapma (geçmişe de yazma)
        },
        onSpeech: (talking) => { if (!listener.active) engine.setMaster(talking ? mixRef.current.master * 0.25 : mixRef.current.master); }, // konuşurken müziği kıs
        onError: (err) => { setHfLive(false); engine.setMaster(mixRef.current.master); toTextBox(err === 'denied' ? (langRef.current === 'en' ? 'Microphone permission was not given.' : 'Mikrofon izni verilmedi.') : ''); },
      });
      setHfLive(true); setGuideStatus({ kind: 'idle' }); // durum satırı: "Sizi dinliyorum"
      if (say) { engine.unlock(); engine.beep(); announce(langRef.current === 'en' ? 'I am listening. Start commands with "Earth", for example: Earth, play.' : 'Sizi dinliyorum. Komutlara "Dünya" diye başlayın, örneğin: Dünya, çal.'); }
    },
    stop: (byVoice: boolean) => { handsFree.stop(); setHfLive(false); if (!byVoice) setGuideStatus({ kind: 'idle' }); hfStoppedByVoice.current = byVoice; engine.setMaster(mixRef.current.master); },
    unavailable: () => toTextBox(''),
  };
  const setHfWanted = (v: boolean) => { setHfWantedS(v); store.set('hf', v ? '1' : '0'); if (v) hfApi.current.start(true); else { hfApi.current.stop(false); announce(langRef.current === 'en' ? 'Hands-free listening off.' : 'Eller serbest dinleme kapalı.'); } };
  useEffect(() => () => handsFree.stop(), []);
  // Boşluk: kısa basış = çal/durdur; 400 ms'den uzun basılı tutma = bas-konuş (bırakınca komut işlenir). Yazı alanında yok.
  const spaceTimer = useRef(0), spaceHold = useRef(false);

  // genel kısayollar: C yer seç · H yardım · G sesli rehber · Esc sustur · 1-4 katman · I/J/K/M gez
  const globalKeys = useRef<(e: KeyboardEvent) => void>(() => {});
  globalKeys.current = (e) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.code === 'KeyT' || e.key.toLowerCase() === 't')) { e.preventDefault(); talk(); return; } // Alt+T: her yerde
    // yazı alanında ya da açık diyalogda hiçbir kısayol çalışmaz (Esc'yi diyalog işler: yalnız pencereyi kapatır)
    if (!shortcutAllowed(e)) return;
    if (e.key === 'Escape') { radar.hush(); stopStory(); return; }
    if (e.key === ' ' || e.code === 'Space') {
      const tag = e.target instanceof HTMLElement ? e.target.tagName.toLowerCase() : '';
      if (tag === 'button' || tag === 'summary' || tag === 'a') return; // odaktaki düğme kendi işini yapar
      e.preventDefault();
      if (e.repeat || spaceTimer.current || spaceHold.current) return;
      spaceTimer.current = window.setTimeout(() => { spaceTimer.current = 0; spaceHold.current = true; talk(true); }, 400);
      return;
    }
    const k = e.key.toLowerCase();
    if (k === 'c') { e.preventDefault(); setPickFor('A'); setPickOpen(true); }
    else if (k === 'h' || e.key === '?') { e.preventDefault(); welcomed.current = true; radar.hush(); if (guideRef.current) void speech.say(helpText()); else announce(helpText()); }
    else if (k === 'g') { e.preventDefault(); setGuide(!guideRef.current); }
    else if (k === 'b' && place) { e.preventDefault(); setPickFor('B'); setPickOpen(true); }
    else if (k === 'y') { e.preventDefault(); setStoriesOpen(true); }
    else if (k === 'e' && place) { e.preventDefault(); openEvents(); }
    else if (k === 'v') { e.preventDefault(); setSoundOpen(true); }
    else if (k === 'n') { e.preventDefault(); setNarrator(!live2.current.narrator); }
    else if (k === 't') { e.preventDefault(); talk(); }
    else if (['1', '2', '3', '4'].includes(k)) { e.preventDefault(); toggleLayer((['co2', 'temp', 'sst', 'aerosol'] as LayerId[])[+k - 1]); }
    else if (place && ['i', 'j', 'k', 'm'].includes(k)) {
      e.preventDefault();
      const bearing = k === 'i' ? 0 : k === 'm' ? 90 : k === 'k' ? 180 : 270;
      pickPoint(destination(place, bearing, rangeKm / 8), 'harita');
    } else if (!welcomed.current && !['enter', ' ', 'tab', 'shift'].includes(k)) welcome();
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => globalKeys.current(e);
    const SKIP = new Set(['Tab', 'Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'OS', 'CapsLock', 'Insert', 'NumLock', 'ScrollLock', 'ContextMenu', 'Fn', 'Unidentified']);
    const any = (e: KeyboardEvent) => { // yakalama evresi: diğer işleyicilerden önce
      if (SKIP.has(e.key) || e.isComposing) return;
      if (!welcomed.current) { e.preventDefault(); e.stopImmediatePropagation(); welcome(); return; } // başlatan tuş başka iş yapmasın
      if (hfStoppedByVoice.current && hfWantedRef.current && !isFormTarget(e.target) && !e.altKey) hfApi.current.start(true); // "sus" sonrası herhangi bir tuş
    };
    const up = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.code !== 'Space') return;
      if (spaceTimer.current) { clearTimeout(spaceTimer.current); spaceTimer.current = 0; radarRef.current.toggle(); }
      else if (spaceHold.current) { spaceHold.current = false; listener.finish(); }
    };
    const tap = () => { if (!welcomed.current) welcome(); else if (hfStoppedByVoice.current && hfWantedRef.current) hfApi.current.start(true); };
    document.addEventListener('keydown', any, true); document.addEventListener('keydown', key); document.addEventListener('keyup', up); document.addEventListener('pointerdown', tap, true);
    return () => { document.removeEventListener('keydown', any, true); document.removeEventListener('keydown', key); document.removeEventListener('keyup', up); document.removeEventListener('pointerdown', tap, true); };
  }, [welcome]);

  // ---------- görsel: küre dokusu ve 2D boyama (görünen katman)
  // Yalnız GÖRSEL: yumuşak (çift doğrusal, yüksek çözünürlüklü doku, Natural Earth kıyısıyla kırpılmış) ya da ham veri hücreleri.
  // Ses ve radar bunlardan etkilenmez: onlar katmanların 'sound' örneklemesini (gerçek hücre değerleri) kullanır.
  const [showCells, setShowCellsS] = useState(() => store.get('cells') === '1');
  const setShowCells = (v: boolean) => { setShowCellsS(v); store.set('cells', v ? '1' : '0'); announce(v ? (lang === 'en' ? 'Showing raw data cells.' : 'Ham veri hücreleri gösteriliyor.') : (lang === 'en' ? 'Smooth view.' : 'Yumuşak görünüm.')); };
  const [landRaster, setLandRaster] = useState<LandRaster | null>(null);
  useEffect(() => { loadLandRaster(BASE).then(setLandRaster).catch(() => { /* kırpmasız da çalışır */ }); }, []);
  const vmode: 'smooth' | 'cells' = showCells ? 'cells' : 'smooth';
  const m24Idx = m24 && m24Visual && m24On[m24Visual] ? m24.meta.layers.findIndex((l) => l.id === m24Visual) : -1;
  const paintLL = useCallback((p: LatLon): [number, number, number] | null => {
    if (m24 && m24Idx >= 0) { const v = m24.visual(m24Idx, month, p, vmode); if (Number.isNaN(v)) return null; const r = m24.monthRange(m24Idx, month); return co2Color((v - r.min) / (r.max - r.min || 1)); }
    if (visual === 'co2' && co2) return co2.color(vmode === 'cells' ? co2.grid.nearest(p, month).ppm : co2.grid.bilinear(p, month), month);
    if (visual === 'temp' && temp) { const v = temp.layer.sample(tFrame, p, vmode); return Number.isNaN(v) ? null : colorFor(temp.cs, v); }
    if (visual === 'sst' && sst) { const v = sst.layer.sample(sstFrame, p, vmode); return Number.isNaN(v) ? null : colorFor(sst.cs, v); }
    if (visual === 'aerosol' && aer) {
      let best = -1, bv = 0.04; aer.file.categories.forEach((c, i) => { const v = aer.layers[c.id].sample(0, p, vmode); if (v > bv) { bv = v; best = i; } });
      if (best < 0) return null;
      const rgb = aer.file.categories[best].rgb, k = Math.min(1, 0.35 + bv * 1.6);
      return [rgb[0] * k, rgb[1] * k, rgb[2] * k];
    }
    return null;
  }, [visual, co2, temp, sst, aer, month, tFrame, sstFrame, m24, m24Idx, vmode]);
  // yalnız karada / yalnız denizde tanımlı katman → Natural Earth kara poligonlarıyla kırp (yumuşak görünümde; ham hücrelerde kırpma yok)
  const domain: 'land' | 'sea' | 'all' = m24 && m24Idx >= 0 ? (m24.meta.layers[m24Idx].domain ?? 'all') : visual === 'sst' ? 'sea' : 'all';
  const keep = !showCells && landRaster && domain !== 'all' ? (lat: number, lon: number) => landRaster.isLand(lat, lon) === (domain === 'land') : undefined;
  const paintVis = useCallback((p: LatLon) => (keep && !keep(p.lat, p.lon) ? null : paintLL(p)), [paintLL, keep]); // 2D harita ve radar görünümü için
  /** Görünen katmanın veri çözünürlüğü (dürüstlük etiketi). */
  const dataRes = m24 && m24Idx >= 0 ? { km: 220, cell: m24.meta.grid.cell } : visual === 'co2' && on.co2 ? { km: 330, cell: '3° × 3.75°' } : (visual === 'temp' && on.temp) || (visual === 'sst' && on.sst) || (visual === 'aerosol' && on.aerosol) ? { km: 110, cell: '1° × 1°' } : null;
  const paintKey = `${vmode}-${domain}-${!!keep}-${m24Idx >= 0 ? 'm24' + m24Idx + '-' + month + '-' + m24Rev + '-' : ''}${visual}-${visual === 'co2' ? month : visual === 'temp' ? tFrame : visual === 'sst' ? sstFrame : 0}-${!!co2}-${!!temp}-${!!sst}-${!!aer}`;
  // boyanmış dokular saklanır: aynı ay/kare ikinci kez istenince yeniden hesaplanmaz (akıcı geçiş)
  const texCache = useRef(new Map<string, HTMLCanvasElement>());
  const cachedTex = (key: string) => {
    const m = texCache.current; let c = m.get(key);
    if (!c) { c = showCells ? paintEquirect(paintLL, 720, 360) : paintEquirect(paintLL, 1440, 720, keep); m.set(key, c); if (m.size > 48) m.delete(m.keys().next().value as string); }
    return c;
  };
  const globeSource: GlobeSource | null = useMemo(() => {
    if (!view3d) return null;
    const op = showCells ? 0.92 : 0.65;
    const tk = (k: string) => `${k}-${vmode}-${!!keep}`;
    if (m24Idx >= 0) return { key: tk(`m24-${m24Idx}-${month}-${m24Rev}`), el: cachedTex(tk(`m24-${m24Idx}-${month}-${m24Rev}`)), opacity: op };
    if (visual === 'sst' && on.sst) return { key: 'sst-video', el: video };
    if (visual === 'aerosol' && on.aerosol) return aerImg ? { key: 'aer-img', el: aerImg } : null;
    if (visual === 'co2' && co2) return { key: tk(`co2-${month}`), el: cachedTex(tk(`co2-${month}`)), opacity: op };
    if (visual === 'temp' && temp) return { key: tk(`temp-${tFrame}`), el: cachedTex(tk(`temp-${tFrame}`)), opacity: op };
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view3d, visual, on.sst, on.aerosol, aerImg, co2 && month, temp && tFrame, video, paintKey]);

  // ---------- paneller
  const L = (id: LayerId) => LAYER_UI[id];
  const pills: Pill[] = (Object.keys(LAYER_UI) as LayerId[]).map((id) => ({
    id, label: L(id).label[lang], instrument: id !== 'aerosol' && mix.inst[id] && mix.inst[id] !== id ? instrumentName(mix.inst[id], lang) + (id === 'sst' ? (lang === 'en' ? ' + waves' : ' + dalga sesi') : '') : L(id).instrument[lang], icon: L(id).icon, color: L(id).color, on: on[id], visual: visual === id && on[id],
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
    { title: lang === 'tr' ? 'Dünya olayları' : 'Earth events', text: lang === 'tr' ? 'NASA EONET (Earth Observatory Natural Event Tracker), canlı; son 30 günün açık olayları' : 'NASA EONET (Earth Observatory Natural Event Tracker), live; open events of the last 30 days', href: 'https://eonet.gsfc.nasa.gov/' },
    { title: lang === 'tr' ? 'Aylık katmanlar (paket sürüm 3)' : 'Monthly layers (package v3)', text: lang === 'tr' ? 'NASA GES DISC: MERRA-2 (M2TMNXAER SO2SMASS, TOTEXTTAU; M2TMNXSLV T2M, TS, TO3; M2TMNXRAD ALBEDO; M2TMNXOCN TSKINWTR, FRSEAICE; M2TMNXLND PRECTOTLAND, TWLAND, LAI) ve OCO-2 GEOS L3 CO₂ (OCO2_GEOS_L3CO2_DAY) 2021; MERRA-2 2024; 2° × 2.5°. Ekibimizden Ceyhun hazırladı; yalnız veri denetiminden geçen katmanlar.' : 'NASA GES DISC: MERRA-2 (M2TMNXAER SO2SMASS, TOTEXTTAU; M2TMNXSLV T2M, TS, TO3; M2TMNXRAD ALBEDO; M2TMNXOCN TSKINWTR, FRSEAICE; M2TMNXLND PRECTOTLAND, TWLAND, LAI) and OCO-2 GEOS L3 CO₂ (OCO2_GEOS_L3CO2_DAY) 2021; MERRA-2 2024; 2° × 2.5°. Prepared by our team member Ceyhun; only layers that passed our data audit.', href: 'https://disc.gsfc.nasa.gov/' },
    { title: lang === 'tr' ? 'Şehirler' : 'Cities', text: 'GeoNames (geonames.org), CC BY 4.0' },
    { title: lang === 'tr' ? 'Taban Dünya görüntüsü (3B küre)' : 'Base Earth image (3D globe)', text: lang === 'tr' ? 'NASA Earth Observatory, Blue Marble: Next Generation (Reto Stöckli, NASA GSFC), Aralık 2004; 5400×2700 görüntüden 4096×2048 / 2048×1024. Yalnız altlık; veri değildir.' : 'NASA Earth Observatory, Blue Marble: Next Generation (Reto Stöckli, NASA GSFC), December 2004; resized from 5400×2700 to 4096×2048 / 2048×1024. Base map only, not data.', href: 'https://earthobservatory.nasa.gov/features/BlueMarble' },
    { title: lang === 'tr' ? 'Kara poligonları (görsel kırpma)' : 'Land polygons (visual clipping)', text: lang === 'tr' ? 'Natural Earth 1:50m Land, kamu malı — yalnız karada / yalnız denizde tanımlı katmanların görüntüsünü kıyıdan kırpmak için; ses gerçek veri hücrelerini kullanır.' : 'Natural Earth 1:50m Land, public domain — only to clip land-only / sea-only layers at the coast in the display; sound uses the real data cells.', href: 'https://www.naturalearthdata.com/' },
    { title: lang === 'tr' ? 'Kıyı çizgileri (3B küre)' : 'Coastlines (3D globe)', text: lang === 'tr' ? 'Natural Earth 1:50m Coastline, kamu malı (naturalearthdata.com). Yalnız altlık; veri katmanlarının çözünürlüğü değişmez.' : 'Natural Earth 1:50m Coastline, public domain (naturalearthdata.com). Base map only; data layer resolution is unchanged.', href: 'https://www.naturalearthdata.com/' },
  ];

  const guidePanel = <Guide lang={lang} micSupported={listener.supported} listening={listening} status={guideStatus} history={cmdHistory} onTalk={() => talk()}
    onCommand={(t) => execCommand([t], 'text')} narrator={narrator} setNarrator={setNarrator} inputRef={guideInput}
    handsFree={hfLive} handsFreeWanted={hfWanted} setHandsFreeWanted={setHfWanted} open={guideOpen} setOpen={setGuideOpen} />;

  return (
    <div className={`app${view3d ? ' is3d' : ' is2d'}`}>
      {!started && (
        <div className="start-gate" lang={lang}>
          <h1 id="gate-h">{lang === 'en' ? 'Press any key or tap anywhere to start.' : 'Başlamak için herhangi bir tuşa basın ya da ekranın herhangi bir yerine dokunun.'}</h1>
          <p className="gate-brand" aria-hidden="true">Earth<span>Ear</span></p>
          <button type="button" className="gate-btn" autoFocus onClick={welcome} aria-describedby="gate-h">{lang === 'en' ? 'Start EarthEar' : 'EarthEar\'i başlat'}</button>
          <p className="gate-note">{lang === 'en' ? 'It will listen to your voice. Headphones recommended.' : 'Sesinizi dinleyecek. Kulaklık önerilir.'}</p>
        </div>
      )}
      {view3d && (
        <Globe3D source={globeSource} landCanvas={landCanvas} baseUrl={`${BASE}media/bluemarble_${isTouchDevice ? 2048 : 4096}.jpg`} center={active} rangeKm={rangeKm} angle={radar.angle} level={() => engine.level()}
          reducedMotion={reduced} onPick={(p) => pickPoint(p, 'harita')} onHover={onHover}
          onSlow={() => { if (forced !== '3d') { setView3dS(false); setSlowNote(true); } }} />
      )}

      <TopBar lang={lang} setLang={setLang} hc={hc} setHc={setHc} view3d={view3d} can3d={can3d} setView3d={setView3d} onPick={() => { setPickFor('A'); setPickOpen(true); }} onAbout={() => setAboutOpen(true)} hasPlace={!!place} guide={guide} setGuide={setGuide} listening={listening} onTalk={() => talk()} micSupported={listener.supported} />

      <main className="stage">
        {!audioOk && <p role="alert" className="glass alert">{lang === 'tr' ? 'Ses başlatılamadı. Sessiz modu kapat, sesi aç ve bir düğmeye tekrar dokun.' : 'Audio could not start. Turn off silent mode, raise the volume and tap a button again.'}</p>}
        {err && <p role="alert" className="glass alert">{err}</p>}
        {slowNote && <p role="status" className="glass note">{tr(lang, 'fallback')}</p>}

        {!place && <div className="right-col">{guidePanel}</div>}
        {!place && <Intro lang={lang} onPick={() => { setPickFor('A'); setPickOpen(true); }} onTalk={listener.supported ? () => talk() : undefined} />}
        {place && dataRes && (
          <div className="glass data-res" role="group" aria-label={lang === 'en' ? 'Data resolution' : 'Veri çözünürlüğü'}>
            <span>{lang === 'en' ? 'Data resolution' : 'Veri çözünürlüğü'}: <b>~{dataRes.km} km</b> <small className="muted">({dataRes.cell}{showCells ? '' : lang === 'en' ? ', smoothed for display; sound uses the real cells' : ', görüntüde yumuşatıldı; ses gerçek hücreleri kullanır'})</small></span>
            <label className="switch small"><input type="checkbox" checked={showCells} onChange={(e) => setShowCells(e.target.checked)} /> <span>{lang === 'en' ? 'Show data cells' : 'Veri hücrelerini göster'}</span></label>
          </div>
        )}
        {(listening || heard) && <p role="status" className="glass note heard">{listening ? tr(lang, 'listening') : `“${heard}”`}</p>}

        {!view3d && (
          <section className={`flat${place ? '' : ' empty'}`} aria-label={lang === 'tr' ? '2D harita ve radar' : '2D map and radar'}>
            {active && <div className="flat-radar"><RadarView center={active} rangeKm={rangeKm} paint={paintVis} paintKey={paintKey} angle={radar.angle} land={land} /></div>}
            <div className="flat-map"><WorldMap paint={paintVis} paintKey={paintKey} land={land} center={active} rangeKm={rangeKm} onPick={(p) => pickPoint(p, 'harita')} onHover={onHover} /></div>
          </section>
        )}

        {place && (
          <>
            <NowCard lang={lang} placeLabel={(compare && placeB ? (active === placeB ? 'B · ' : 'A · ') : '') + placeLabel(active ?? place)} playing={radar.playing} onToggle={radar.toggle} onLegend={radar.runLegend} 
              onSummary={radar.summary} headline={headline} instruments={instruments} rangeKm={rangeKm} setRange={(km) => { setRange(km); announce(lang === 'en' ? `Range ${km} kilometers.` : `Menzil ${km} kilometre.`); }}
              revSec={radar.revSec} setRevSec={radar.setRevSec} mode={mode} setMode={(m) => { setMode(m); announce(m === 'hikaye' ? (lang === 'en' ? 'Musical mode: pentatonic notes, with a soft chord and waves.' : 'Müzikal mod: pentatonik notalar, yumuşak zemin akoru ve dalga sesi.') : (lang === 'en' ? 'Science mode: whole-tone steps, so equal differences sound as equal steps. Data sounds only.' : 'Bilim modu: tam ton adımları; eşit fark eşit adım duyulur. Yalnız veri sesleri.')); }}
              scale={scale} setScale={setScale} scaleInfo={radar.scaleInfo} legend={radar.legend} talking={radar.talking} nowLines={radar.nowLines} liveLine={radar.liveLine}>
              <Explore lang={lang} placeA={placeLabel(place)} placeB={placeB ? placeLabel(placeB) : null} compare={compare}
                setCompare={(v) => { setCompare(v); setCmpTurn(0); announce(v ? (lang === 'en' ? 'Listening in turns: one sweep for A, one sweep for B. Time stays fixed.' : 'Sırayla dinleme açık: bir tur A, bir tur B. Zaman sabit kalır.') : (lang === 'en' ? 'Listening in turns off.' : 'Sırayla dinleme kapalı.')); }}
                onPickB={() => { setPickFor('B'); setPickOpen(true); }} onClearB={() => { setPlaceB(null); setCompare(false); setCmpTurn(0); }} onDiff={sayDiff}
                onStories={() => setStoriesOpen(true)} onEvents={openEvents} onSound={() => setSoundOpen(true)}
                narrator={narrator} setNarrator={setNarrator} story={story} onStopStory={stopStory} showNarrator={false} />
            </NowCard>
            <div className="right-col">
            <LayerPills lang={lang} top={<M24Panel part="themes" activeTheme={activeTheme} lang={lang} m24={m24} loading={m24Loading} onOpen={openM24} on={m24On} visualId={null} month={month} place={active} announce={announce} setOn={setM24Layer} onPreset={applyM24Preset} onShow={() => {}} />} pills={pills} onToggle={(id) => toggleLayer(id as LayerId)} onShow={(id) => { setM24Visual(null); setVisual(id as LayerId); }}>
              {on.temp && temp && (
                <div className="sub-time">
                  <label htmlFor="t-date" className="small">{lang === 'tr' ? 'Sıcaklık tarihi' : 'Temperature date'}</label>
                  <select id="t-date" value={tFrame} onChange={(e) => { const f = +e.target.value; setTFrame(f); announce(temp.dateLabel(f, lang)); }}>
                    {Array.from({ length: temp.frames }, (_, f) => <option key={f} value={f}>{temp.dateLabel(f, lang)}</option>)}
                  </select>
                  <input type="range" min={0} max={temp.frames - 1} value={tFrame} aria-label={lang === 'tr' ? 'Sıcaklık tarihi kaydırıcısı' : 'Temperature date slider'} aria-valuetext={temp.dateLabel(tFrame, lang)} onChange={(e) => setTFrame(+e.target.value)} />
                </div>
              )}
              {on.sst && sst && (
                <div className="sub-time">
                  <label htmlFor="s-date" className="small">{lang === 'tr' ? 'Okyanus tarihi (ECCO2 modeli)' : 'Ocean date (ECCO2 model)'}</label>
                  <select id="s-date" value={sstFrame} onChange={(e) => { const f = +e.target.value; setSstFrame(f); try { video.currentTime = f / sst.file.frames.fps; } catch { /* video hazır değil */ } announce(sst.dateLabel(f, lang)); }}>
                    {Array.from({ length: sst.frames }, (_, f) => <option key={f} value={f}>{`${sst.dateLabel(f, lang)} · ${f + 1}/${sst.frames}`}</option>)}
                  </select>
                  <input type="range" min={0} max={sst.frames - 1} value={sstFrame} aria-label={lang === 'tr' ? 'Okyanus tarihi kaydırıcısı' : 'Ocean date slider'} aria-valuetext={sst.dateLabel(sstFrame, lang)} onChange={(e) => { const f = +e.target.value; setSstFrame(f); try { video.currentTime = f / sst.file.frames.fps; } catch { /* video hazır değil */ } }} />
                </div>
              )}
              {on.aerosol && <p className="small muted">{lang === 'tr' ? 'Aerosoller: 19 Ağu 2025 20:00 UTC; yoğunluk göreli.' : 'Aerosols: 19 Aug 2025 20:00 UTC; relative density.'}</p>}
              <M24Panel lang={lang} m24={m24} loading={m24Loading} onOpen={openM24} on={m24On} visualId={m24Idx >= 0 ? m24Visual : null} month={month} place={active} announce={announce}
                setOn={setM24Layer} onPreset={applyM24Preset}
                onShow={(id) => setM24Visual(id)} />
            </LayerPills>
            {guidePanel}
            </div>
            {((on.co2 && co2) || anyM24On) && (() => {
              // etiket görünen/seçili katmanın yılını gösterir: 2024 katmanı görünüyorsa (ya da CO₂ 2021 kapalıysa) 2024, yoksa 2021 CO₂ paketi
              const use24 = !!m24 && (m24Idx >= 0 || !(on.co2 && co2));
              const idx24 = m24Idx >= 0 ? m24Idx : m24 ? m24.meta.layers.findIndex((l) => m24On[l.id]) : -1;
              const yr = m24 && idx24 >= 0 ? m24.meta.layers[idx24].year : 2024;
              const label24 = (m: number) => `${monthName(m, lang)} ${yr} · ${lang === 'en' ? 'monthly mean' : 'aylık ortalama'}`;
              const lbl = use24 || !co2 ? label24(month) : co2.monthLabel(month, lang);
              return <Timeline lang={lang} month={month} label={lbl} year={use24 || !co2 ? yr : 2021} title={use24 || !co2 ? (lang === 'en' ? `Date (monthly layers, ${yr})` : `Tarih (aylık katmanlar, ${yr})`) : undefined} advance={advance} setAdvance={setAdvance} setMonth={(m) => {
                setMonth(m);
                if ((use24 || !co2) && m24 && idx24 >= 0) { const L = m24.radarLayer(idx24, m, lang), v = L.sample(place); announce(`${label24(m)}: ${L.label}, ${Number.isNaN(v) ? (lang === 'en' ? 'no data at the center' : 'merkezde veri yok') : (lang === 'en' ? L.fmt(v) + ' at the center' : 'merkezde ' + L.fmt(v))}.`); }
                else if (co2) announce(lang === 'en' ? `${co2.monthLabel(m, 'en')}: ${co2.grid.bilinear(place, m).toFixed(1)} ppm at the center.` : `${co2.monthLabel(m)}: merkezde ${co2.grid.bilinear(place, m).toFixed(1)} ppm.`);
              }} />;
            })()}
          </>
        )}
      </main>

      <Dialog open={pickOpen} onClose={() => setPickOpen(false)} title={pickFor === 'B' ? (lang === 'en' ? 'Choose the second place' : 'İkinci yeri seç') : tr(lang, 'searchTitle')} lang={lang}>
        <PlacePicker cities={cities} place={pickFor === 'B' ? placeB : place} onPick={(p) => { if (pickFor === 'B') { setPlaceB(p); setCompare(true); setCmpTurn(0); announce(lang === 'en' ? `Second place: ${placeLabel(p)}. The radar now plays one sweep here and one sweep there. Press Space to listen.` : `İkinci yer: ${placeLabel(p)}. Radar artık bir tur birinci yeri, bir tur ikinci yeri çalar. Dinlemek için Boşluk.`); } else setPlace(p); setPickOpen(false); }} announce={announce} autoFocus lang={lang} />
        <p className="small muted">{tr(lang, 'orTap')}</p>
      </Dialog>
      <StoriesDialog open={storiesOpen} onClose={() => setStoriesOpen(false)} lang={lang} stories={storyList} hasPlace={!!place} onRun={(id) => { setStoriesOpen(false); void runStory(id); }} />
      <EventsDialog open={eventsOpen} onClose={() => setEventsOpen(false)} lang={lang} status={events.status} events={nearEvents}
        onGo={(e) => { setEventsOpen(false); pickPoint({ lat: e.lat, lon: e.lon }, 'harita'); }} />
      <SoundDialog open={soundOpen} onClose={() => setSoundOpen(false)} lang={lang} mix={mix} setMix={setMix}
        layerNames={{ co2: LAYER_UI.co2.label[lang], temp: LAYER_UI.temp.label[lang], sst: LAYER_UI.sst.label[lang], aerosol: LAYER_UI.aerosol.label[lang] }}
        onTest={(id) => { engine.unlock(); const ids = id === 'aerosol' ? ['black_carbon', 'dust', 'sea_salt', 'sulfate'] : [id]; ids.forEach((t, i) => [0.2, 0.5, 0.8].forEach((v, j) => engine.voice(t, noteHz(v, PARTS[t as keyof typeof PARTS]), engine.now + 0.05 + i * 1.1 + j * 0.3, 0.5, 0.8, 0))); }} />
      <About open={aboutOpen} onClose={() => setAboutOpen(false)} lang={lang} credits={credits} />

      <div className="sr" aria-live="polite" aria-atomic="true">{live}</div>
      <footer className="foot">{tr(lang, 'disclaimer')} <button type="button" className="linkish" onClick={() => setAboutOpen(true)}>{tr(lang, 'about')}</button></footer>
    </div>
  );
}
