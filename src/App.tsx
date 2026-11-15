import './index.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { engine } from './audio/engine.ts';
import { speech } from './audio/speech.ts';
import { handsFree, listener } from './audio/listen.ts';
import { IconBars, IconBolt, IconBreath, IconGlobe, IconStrings, IconWave } from './components/icons.tsx';
import { DataInventory } from './components/DataInventory.tsx';
import { WorldThemes } from './components/WorldThemes.tsx';
import { AppHeader, HelpDialog, LayerCards, PlayerBar, SettingsDialog, SidePanel, type TabId } from './components/Layout.tsx';
import { moodOf } from './lib/music.ts';
import { nowSceneOf, playThenSay, Weather } from './components/Weather.tsx';
import { Forecast, spokenDetail, spokenSummary } from './lib/forecast.ts';
import { WORLD_OF, describeWorld, legendLine, type World } from './lib/worlds.ts';
import { soundBank, WEATHER_SOUNDS, WORLD_SOUNDS } from './audio/soundbank.ts';
import { DEFAULT_MIX, EventsDialog, Explore, instrumentName, SoundDialog, StoriesDialog, type EarthEvent, type Mix, type StoryInfo } from './components/Extras.tsx';
import { PlacePicker } from './components/PlacePicker.tsx';
import { inDialog, isFormTarget, setShortcutsEnabled, shortcutAllowed } from './lib/keys.ts';
import { StartGate } from './components/StartGate.tsx';
import { loadLandRaster, type LandRaster } from './lib/nemask.ts';
import { Guide, type CmdEntry, type GuideStatus } from './components/Guide.tsx';
import { monthName } from './lib/co2.ts';
import { RadarView } from './components/RadarView.tsx';
import { About, Dialog, Intro, type Pill } from './components/Shell.tsx';
import { WorldMap } from './components/WorldMap.tsx';
import { useRadar } from './hooks/useRadar.ts';
import { tr, type Lang } from './i18n.ts';
import { bearing as bearingTo, compass8, destination, formatKm, formatLatLon, haversineKm, type LatLon } from './lib/geo.ts';
import { colorFor } from './lib/grid.ts';
import { LandMask, type LandFile } from './lib/land.ts';
import { co2Color, loadAerosols, loadCo2, loadJson, loadLightning, loadLights, loadNdvi, loadSst, loadTemperature, type AerosolSource, type Co2Source, type LightningSource, type LightsSource, type NdviSource, type SstSource, type TemperatureSource } from './lib/layers.ts';
import { ImageScan } from './components/ImageScan.tsx';
import { INSTRUMENT_LABEL, M24 } from './lib/m24.ts';

import { Cities, countryName, fold, placeLabel, rowToPlace, type CitiesFile, type Place } from './lib/places.ts';
import { C5Source, loadC5, type C5Id } from './lib/cells5.ts';
import { RevGeo, type RegionsFile } from './lib/revgeo.ts';
import { Gazetteer, goLine, hitName, soru, type Hit, type PlacesFile } from './lib/gazetteer.ts';
import { gainFor, noteHz, PARTS, type Mode, type RadarLayer, type Scale, type SoundMode } from './lib/radar.ts';
import { landTexture, paintEquirect } from './lib/textures.ts';
import { Globe3D, hasWebGL, type GlobeSource } from './three/Globe3D.tsx';

const BASE = import.meta.env.BASE_URL;
type LayerId = 'co2' | 'temp' | 'sst' | 'aerosol' | 'ndvi' | 'lights' | 'lightning' | C5Id;
/** 5° ayrı katmanlar (Ceyhun paketi, onaylı): kendi kartları, kendi çözünürlük etiketi; radar 1° SVS/v3 ızgarasına karıştırılmaz. */
const C5_LAYERS: C5Id[] = ['currents', 'lis', 'gedi'];
/** Katmanlar panelinde: EIC görsellerinden (birincil) ve NASA ham verisi (ikincil). */
const EIC_LAYERS: LayerId[] = ['aerosol', 'lightning', 'sst', 'lights', 'ndvi', 'temp'];
const RAW_LAYERS: LayerId[] = []; // CO₂ (OCO-2) ve MERRA-2 ana deneyimden çıktı → Hakkında: veri doğrulaması
/** Ses dünyası temaları (yalnız bu 6 katman). */
const WORLD_THEMES: { tr: string; en: string; layers: LayerId[] }[] = [
  { tr: 'Çöl ve Toz', en: 'Desert and dust', layers: ['aerosol', 'temp'] },
  { tr: 'Fırtına', en: 'Storm', layers: ['lightning', 'sst'] },
  { tr: 'Okyanus', en: 'Ocean', layers: ['sst', 'aerosol'] },
  { tr: 'Şehirler ve Ormanlar', en: 'Cities and forests', layers: ['lights', 'ndvi'] },
  { tr: 'Sıcak ve Soğuk', en: 'Hot and cold', layers: ['temp', 'sst'] },
];
/** 30 sn'lik rehberli tur: 4 durak. need = radarda beklenecek katman kimlikleri. Değerler anlatımda veriden okunur. */
const TOUR: { tr: string; en: string; lat: number; lon: number; layers: LayerId[]; need: string[]; range: number }[] = [
  { tr: 'Sahra', en: 'the Sahara', lat: 23, lon: 12, layers: ['aerosol', 'temp'], need: ['dust', 'temp'], range: 2000 },
  { tr: 'Amazon', en: 'the Amazon', lat: -3.1, lon: -60, layers: ['ndvi'], need: ['ndvi'], range: 2000 },
  { tr: 'Orta Afrika', en: 'Central Africa', lat: -1.5, lon: 26, layers: ['lightning'], need: ['lightning'], range: 2000 },
  { tr: 'Kuzey Atlantik', en: 'the North Atlantic', lat: 55, lon: -30, layers: ['sst'], need: ['sst'], range: 500 },
];
const LAYER_UI: Record<LayerId, { label: { tr: string; en: string }; instrument: { tr: string; en: string }; color: string; icon: React.ReactNode }> = {
  co2: { label: { tr: 'Karbondioksit', en: 'Carbon dioxide' }, instrument: { tr: 'keman', en: 'violin' }, color: '#ffb547', icon: <IconBreath /> },
  temp: { label: { tr: 'Yüzey sıcaklığı', en: 'Surface temperature' }, instrument: { tr: 'buzlu rüzgâr ↔ ağustos böcekleri', en: 'icy wind ↔ cicadas' }, color: '#ff6b6b', icon: <IconStrings /> },
  sst: { label: { tr: 'Okyanus sıcaklığı', en: 'Ocean temperature' }, instrument: { tr: 'dalgalar', en: 'waves' }, color: '#4dd8e8', icon: <IconWave /> },
  aerosol: { label: { tr: 'Aerosoller', en: 'Aerosols' }, instrument: { tr: 'kum fırtınası, yangın, serpinti, volkan', en: 'sandstorm, fire, spray, volcano' }, color: '#c49bff', icon: <IconBars /> },
  ndvi: { label: { tr: 'Orman ve bitki örtüsü', en: 'Forest & vegetation' }, instrument: { tr: 'yaprak + kuşlar', en: 'leaves + birds' }, color: '#7ddc6a', icon: <IconGlobe /> },
  lights: { label: { tr: 'Gece ışıkları', en: 'Night lights' }, instrument: { tr: 'şehir uğultusu', en: 'city hum' }, color: '#ffe08a', icon: <IconBreath /> },
  lightning: { label: { tr: 'Yıldırım', en: 'Lightning' }, instrument: { tr: 'gök gürültüsü', en: 'thunder' }, color: '#fff36b', icon: <IconBolt /> },
  currents: { label: { tr: 'Okyanus akıntıları (5°)', en: 'Ocean currents (5°)' }, instrument: { tr: 'dalga temposu', en: 'wave tempo' }, color: '#5fb8ff', icon: <IconWave /> },
  lis: { label: { tr: 'Yıldırım iklimi (5°)', en: 'Lightning climatology (5°)' }, instrument: { tr: 'gök gürültüsü', en: 'thunder' }, color: '#ffd84a', icon: <IconBolt /> },
  gedi: { label: { tr: 'Orman yüksekliği (5°)', en: 'Forest height (5°)' }, instrument: { tr: 'yaprak + kuşlar', en: 'leaves + birds' }, color: '#3fbf6a', icon: <IconGlobe /> },
};
const store = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* yok say */ } } };
const params = new URLSearchParams(location.search);
// Derin bağlantı: ?layer=lis,gedi (ya da aylık katman kimliği, ör. seaice_24) · ?month=1–12 · ?lat=&lon= / ?q=
const URL_LAYERS = (params.get('layer') ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const URL_MONTH = (() => { const m = Number(params.get('month')); return Number.isInteger(m) && m >= 1 && m <= 12 ? m - 1 : 0; })();
const isTouchDevice = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;

export default function App() {
  // ---------- tercihler
  const [lang, setLangS] = useState<Lang>(() => { const p = params.get('lang'); if (p === 'en' || p === 'tr') { store.set('lang', p); return p; } return store.get('lang') === 'en' ? 'en' : 'tr'; }); // ?lang= (landing dili) önceliklidir
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
  const setLang = (l: Lang) => { langRef.current = l; setLangS(l); store.set('lang', l); try { const u = new URL(location.href); if (u.searchParams.has('lang')) { u.searchParams.set('lang', l); history.replaceState(null, '', u); } } catch { /* yok say */ } speech.setLang(l); handsFree.setLang(l); announceRef.current(l === 'en' ? 'Language: English. Voice commands, the voice guide and the screen are now in English.' : 'Dil: Türkçe. Sesli komut, sesli rehber ve ekran artık Türkçe.'); };
  const announceRef = useRef<(t: string) => void>(() => {});
  const setGuide = (v: boolean) => {
    setGuideS(v); store.set('guide', v ? '1' : '0');
    if (v) void speech.say(langRef.current === 'en' ? 'Voice guide on. To speak, hold the Space key and say a command, for example: go to Sivas. P plays or stops. H is help. Press the Voice guide button again to turn me off.' : 'Sesli rehber açık. Konuşmak için Boşluk tuşunu basılı tutun ve komutu söyleyin, örneğin: Sivas\'a git. Çalmak ya da durdurmak için P. Yardım için H. Kapatmak için Sesli Rehber düğmesine tekrar basın.');
    else { speech.stop(); setLive(''); requestAnimationFrame(() => setLive(langRef.current === 'en' ? 'Voice guide off.' : 'Sesli rehber kapalı.')); }
  };
  const setHc = (v: boolean) => { setHcS(v); store.set('hc', v ? '1' : '0'); };
  const setView3d = (v: boolean) => { setView3dS(v); store.set('view', v ? '3d' : '2d'); setSlowNote(false); };
  useEffect(() => { document.documentElement.classList.toggle('hc', hc); document.documentElement.lang = lang; }, [hc, lang]);

  // ---------- veri
  const [cities, setCities] = useState<Cities | null>(null);
  const [gaz, setGaz] = useState<Gazetteer | null>(null); // yer çözümleyici: ülkeler + bölgeler + şehirler, Türkçe ekler
  const gazRef = useRef(gaz); gazRef.current = gaz;
  const [revgeo, setRevgeo] = useState<RevGeo | null>(null); // ters coğrafi kodlama: nokta → ülke / deniz adı (TR/EN)
  const revRef = useRef(revgeo); revRef.current = revgeo;
  const [co2, setCo2] = useState<Co2Source | null>(null);
  const [temp, setTemp] = useState<TemperatureSource | null>(null);
  const [sst, setSst] = useState<SstSource | null>(null);
  const [aer, setAer] = useState<AerosolSource | null>(null);
  const [ndvi, setNdvi] = useState<NdviSource | null>(null);
  const [lights, setLights] = useState<LightsSource | null>(null);
  const [lightning, setLightning] = useState<LightningSource | null>(null);
  const [ndviFrame, setNdviFrame] = useState(0);
  const [lightsYear, setLightsYear] = useState(11);
  const [scanOpen, setScanOpen] = useState(false);
  // ---------- yeni düzen: sağ panel (sekmeler), ayarlar, yardım, kısayol anahtarı
  const [panelOpen, setPanelOpenS] = useState(() => store.get('panel') !== '0' && !(typeof matchMedia !== 'undefined' && matchMedia('(max-width: 900px)').matches));
  const setPanelOpen = (v: boolean) => { setPanelOpenS(v); store.set('panel', v ? '1' : '0'); };
  const [panelTab, setPanelTab] = useState<TabId>(() => { const p = params.get('panel'); return p === 'weather' || p === 'explore' || p === 'guide' ? p : 'listen'; }); // ?panel= derin bağlantı
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [shortcutsOn, setShortcutsOnS] = useState(() => store.get('shortcuts') !== '0');
  useEffect(() => { setShortcutsEnabled(shortcutsOn); }, [shortcutsOn]);
  const setShortcuts = (v: boolean) => { setShortcutsOnS(v); store.set('shortcuts', v ? '1' : '0'); };
  // ---------- Meteorolog (NASA GEOS-FP tahmini; statik dosya, internetsiz)
  const [wx, setWx] = useState<Forecast | null>(null);
  const [wxErr, setWxErr] = useState<string | null>(null);
  const [wxTarget, setWxTarget] = useState<(LatLon & { name: string }) | null>(null);
  const wxLoad = useRef<Promise<Forecast> | null>(null);
  const loadWx = () => { if (!wxLoad.current) wxLoad.current = Forecast.load(BASE).then((f) => { setWx(f); return f; }).catch((e) => { setWxErr(String(e)); wxLoad.current = null; throw e; }); return wxLoad.current; };
  /** Hava durumunu aç ve kısa anlatımı söyle (yer: verilen ya da seçili). */
  const openWeather = (t: (LatLon & { name: string }) | null) => {
    setWxTarget(t); setPanelTab('weather'); setPanelOpen(true); void soundBank.load(BASE, WEATHER_SOUNDS);
    if (!t) return;
    Promise.all([loadWx(), soundBank.load(BASE, WEATHER_SOUNDS).catch(() => {})]).then(([f]) => {
      const ns = nowSceneOf(f, t), sm = soundModeRef.current;
      playThenSay(ns.sc, `now-${t.lat}-${t.lon}`, ns.d, spokenSummary(f, t.name, t, langRef.current), announce, { music: sm !== 'nature', nature: sm !== 'music' });
    }).catch(() => announce(langRef.current === 'en' ? 'The forecast file could not be loaded.' : 'Tahmin dosyası yüklenemedi.'));
  };
  const [land, setLand] = useState<LandMask | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    loadJson<RegionsFile>(BASE, 'regions.json').then((f) => setRevgeo(new RevGeo(f))).catch(() => { /* adsız: koordinat okunur */ });
    loadJson<CitiesFile>(BASE, 'cities.json').then((d) => {
      setCities(new Cities(d));
      loadJson<PlacesFile>(BASE, 'places.json').then((pf) => setGaz(new Gazetteer(pf, d.cities, d.asciiNames)))
        .catch(() => setGaz(new Gazetteer({ countries: [], regions: [], cityAliases: {} }, d.cities, d.asciiNames)));
    }).catch((e) => setErr(String(e)));
    loadCo2(BASE).then(setCo2).catch((e) => setErr(String(e)));
    loadJson<LandFile>(BASE, 'land_mask.json').then((d) => setLand(new LandMask(d))).catch(() => { /* kıyısız da çalışır */ });
  }, []);
  const landCanvas = useMemo(() => (land ? landTexture(land) : null), [land]);
  const landRef = useRef(land); landRef.current = land;

  // ---------- durum
  const [place, setPlace] = useState<Place | null>(null);
  // ev konumu: yalnız bu tarayıcıda (localStorage), hiçbir yere gönderilmez
  const [home, setHomeS] = useState<Place | null>(() => { try { const h = JSON.parse(store.get('home') ?? 'null'); return h && typeof h.lat === 'number' ? h : null; } catch { return null; } });
  const homeRef = useRef(home); homeRef.current = home;
  const saveHome = (p: Place | null) => { setHomeS(p); if (p) store.set('home', JSON.stringify({ lat: p.lat, lon: p.lon, name: p.name, country: p.country, source: p.source, names: p.names })); else { try { localStorage.removeItem('home'); } catch { /* yok say */ } } };
  const quietPlace = useRef(false); // bir sonraki yer değişikliği duyurulmasın (ev karşılaması, tur dönüşü)
  const [rangeKm, setRange] = useState(2000);
  const [mode, setMode] = useState<Mode>('bilim'); // Adım 1: bilim modu varsayılan — yalnız veri sesleri; tam ton dizisi
  const [scale, setScaleS] = useState<Scale>('global');
  // Ses modu: doğa (bilim) · doğa + müzik (varsayılan) · sadece müzik
  const [soundMode, setSoundModeS] = useState<SoundMode>(() => (['nature', 'both', 'music'].includes(store.get('soundMode') ?? '') ? store.get('soundMode') as SoundMode : 'both'));
  const soundModeRef = useRef(soundMode); soundModeRef.current = soundMode;
  const setSoundMode = (m: SoundMode) => { setSoundModeS(m); store.set('soundMode', m); const en = langRef.current === 'en'; announce(m === 'nature' ? (en ? 'Nature sounds only (science mode).' : 'Yalnız doğa sesleri (bilim modu).') : m === 'music' ? (en ? 'Music only.' : 'Yalnız müzik.') : (en ? 'Nature sounds with music from the same data underneath.' : 'Doğa sesleri ve altında aynı veriden doğan müzik.')); }; // ses dünyaları: KÜRESEL ölçek (Sahra hep tozlu, Amazon hep yeşil) // Adım 2: yerel ölçek varsayılan — bu alandaki farklar 2 oktava yayılır
  const [month, setMonth] = useState(URL_MONTH);
  const [advance, setAdvance] = useState(true);
  const [tFrame, setTFrame] = useState(0);
  const [sstFrame, setSstFrame] = useState(0);
  const [on, setOn] = useState<Record<LayerId, boolean>>(() => {
    const base: Record<LayerId, boolean> = { co2: false, temp: true, sst: false, aerosol: false, ndvi: false, lights: false, lightning: false, currents: false, lis: false, gedi: false };
    const ids = URL_LAYERS.filter((x) => x in base) as LayerId[];
    if (!URL_LAYERS.length) return base;
    return { ...base, temp: false, ...Object.fromEntries(ids.map((k) => [k, true])) };
  });
  const [visual, setVisual] = useState<LayerId>(() => (URL_LAYERS.find((x) => ['co2', 'temp', 'sst', 'aerosol', 'ndvi', 'lights', 'lightning', 'currents', 'lis', 'gedi'].includes(x)) as LayerId) ?? 'temp');
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
  // derin bağlantıdaki aylık katmanlar (ör. ?layer=seaice_24): açılışta bir kez
  useEffect(() => { const ids = URL_LAYERS.filter((x) => /_24$/.test(x)); if (!ids.length) return; openM24(); setM24On(Object.fromEntries(ids.map((k) => [k, true]))); setM24Visual(ids[0]); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  /** Ceyhun'un presetleri: yalnız UYGUN katmanlar açılır, diğer aylık katmanlar kapanır; çıkarılanlar söylenir. */
  const [, setActiveTheme] = useState<string | null>(null);
  const [worldTheme, setWorldTheme] = useState<string | null>(null);
  const applyWorldTheme = (i: number) => {
    const th = WORLD_THEMES[i];
    setOn({ co2: false, temp: false, sst: false, aerosol: false, ndvi: false, lights: false, lightning: false, currents: false, lis: false, gedi: false, ...Object.fromEntries(th.layers.map((k) => [k, true])) });
    setM24On({}); setVisual(th.layers[0]); setWorldTheme(th.tr);
    const en = langRef.current === 'en';
    announce(`${en ? th.en : th.tr}: ${th.layers.map((k) => `${LAYER_UI[k].label[en ? 'en' : 'tr']} (${LAYER_UI[k].instrument[en ? 'en' : 'tr']})`).join(', ')}.`);
  };

  const m24Started = useRef(false);
  const [m24Rev, setM24Rev] = useState(0); // API yedeğinde hücreler geldikçe radar yeniden örneklesin
  useEffect(() => { if (m24) m24.onUpdate = () => setM24Rev((r) => r + 1); }, [m24]);
  const openM24 = () => { if (m24 || m24Loading || m24Started.current) return; m24Started.current = true; setM24Loading(true); M24.load(import.meta.env.BASE_URL).then((m) => { setM24(m); if (m.source === 'api') announce(langRef.current === 'en' ? 'Monthly layer file could not be loaded; using the team API as backup. Layers will sound after a short loading pause.' : 'Aylık katman dosyası yüklenemedi; ekip API\'si yedek olarak kullanılıyor. Katmanlar kısa bir yüklemeden sonra çalar.'); }).catch((e) => setErr(String(e))).finally(() => setM24Loading(false)); };
  const [pickOpen, setPickOpen] = useState(false);
  // iki yeri karşılaştırma: B yeri, sırayla dinleme ve tur sayacı
  const [pickFor, setPickFor] = useState<'A' | 'B' | 'H'>('A');
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
    engine.setMaster(mix.master); engine.setReverb(mix.reverb); engine.setMusic(mix.music); speech.setRate(mix.rate);
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
  const lastSpoken = useRef('');      // "tekrar et" için son anlatım
  const silentReply = useRef(false);  // "sus": onay sesi dışında hiçbir şey söyleme
  const announce = useCallback((t: string) => {
    if (capture.current) { capture.current.push(t); return; }
    lastSpoken.current = t;
    if (guideRef.current && speech.supported) { void speech.say(t); return; }
    setLive(''); requestAnimationFrame(() => setLive(t));
  }, []);
  announceRef.current = announce;
  useEffect(() => engine.onStatus(setAudioOk) as unknown as void, []);
  useEffect(() => speech.onChange((active) => engine.duck(active)), []);

  // katmanlar açılınca yükle
  useEffect(() => { if (on.temp && !temp) loadTemperature(BASE).then((t) => { setTemp(t); setTFrame(t.frames - 1); }).catch((e) => setErr(String(e))); }, [on.temp, temp]);
  useEffect(() => { if (on.sst && !sst) loadSst(BASE).then(setSst).catch((e) => setErr(String(e))); }, [on.sst, sst]);
  useEffect(() => { if (on.aerosol && !aer) loadAerosols(BASE).then(setAer).catch((e) => setErr(String(e))); }, [on.aerosol, aer]);
  useEffect(() => { if (on.ndvi && !ndvi) loadNdvi(BASE).then((n) => { setNdvi(n); setNdviFrame(n.frames - 1); }).catch((e) => setErr(String(e))); }, [on.ndvi, ndvi]);
  useEffect(() => { if (on.lights && !lights) loadLights(BASE).then((l) => { setLights(l); setLightsYear(l.years.length - 1); }).catch((e) => setErr(String(e))); }, [on.lights, lights]);
  useEffect(() => { if (on.lightning && !lightning) loadLightning(BASE).then(setLightning).catch((e) => setErr(String(e))); }, [on.lightning, lightning]);
  const [c5, setC5] = useState<Partial<Record<C5Id, C5Source>>>({});
  const [c5Land, setC5Land] = useState(0); // kara maskesi bağlanınca radar yeniden örneklesin
  useEffect(() => { for (const id of C5_LAYERS) if (on[id] && !c5[id]) loadC5(BASE, id, null).then((src) => setC5((m) => ({ ...m, [id]: src }))).catch((e) => setErr(String(e))); }, [on, c5]);

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
  /** Noktanın adı (TR ve EN): derin bağlantı adı > ülke / deniz (+300 km içindeki şehir) > koordinat. */
  const namesFor = useCallback((p: LatLon): { tr: string; en: string } => {
    const lm = cities?.landmark(p, 300), al = gazRef.current?.cityTr;
    const city = lm ? { tr: al ? al(lm.row[0]) : lm.row[0], en: lm.row[0], km: lm.km } : null;
    return revRef.current?.name(p, city) ?? (city ? { tr: `${city.tr} yakını`, en: `near ${city.en}` } : { tr: formatLatLon(p, 'tr'), en: formatLatLon(p, 'en') });
  }, [cities]);
  const pickPoint = useCallback((p: LatLon, source: Place['source'], given?: { tr: string; en: string }) => {
    const names = given ?? namesFor(p);
    setPlace({ lat: p.lat, lon: p.lon, name: names[langRef.current], names, source });
  }, [namesFor]);
  useEffect(() => { // paylaşılabilir bağlantı (kullanıcı seçimi; kodda şehir yok)
    if (!cities || place) return;
    const q = params.get('q'), lat = params.get('lat'), lon = params.get('lon');
    if (q) { const row = cities.find(q); if (row) setPlace(rowToPlace(row, 'bağlantı')); }
    else if (lat && lon && !Number.isNaN(+lat) && !Number.isNaN(+lon)) {
      const n = params.get('name'), ntr = params.get('name_tr') ?? n, nen = params.get('name_en') ?? n;
      pickPoint({ lat: +lat, lon: +lon }, 'bağlantı', ntr && nen ? { tr: ntr, en: nen } : undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities, revgeo]);
  useEffect(() => {
    if (!place) return;
    const u = new URL(location.href);
    // her zaman koordinat: yenileme / paylaşım aynı yeri açar ("Manaus yakını", "Kanada (Ottawa)" gibi adlar aranamaz)
    u.searchParams.delete('q'); u.searchParams.set('lat', place.lat.toFixed(3)); u.searchParams.set('lon', place.lon.toFixed(3));
    if (place.source !== 'bağlantı') for (const k of ['name', 'name_tr', 'name_en']) u.searchParams.delete(k); // ad yalnız bağlantıdan gelen yer için
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
    if (on.ndvi && ndvi) L.push(ndvi.radarLayer(ndviFrame, lang));
    if (on.lights && lights) L.push(lights.radarLayer(lightsYear, lang));
    if (on.lightning && lightning) L.push(lightning.radarLayer(lang));
    for (const id of C5_LAYERS) { const src = c5[id]; if (on[id] && src) L.push(src.radarLayer(lang)); }
    if (m24) m24.meta.layers.forEach((l, i) => { if (m24On[l.id]) L.push(m24.radarLayer(i, month, lang)); });
    return L;
  }, [m24Rev, c5, c5Land, on, co2, temp, sst, aer, ndvi, lights, lightning, ndviFrame, lightsYear, month, tFrame, sstFrame, lang, mix.inst, m24, m24On]);

  const advanceRef = useRef(advance); advanceRef.current = advance;
  const layersRef = useRef(layers); layersRef.current = layers;
  // kayıtlı sesler: açık ses dünyalarının dosyaları ilk açıldıklarında yüklenir (yüklenene kadar sentez çalar)
  useEffect(() => { const names = [...new Set(layers.flatMap((l) => { const w = WORLD_OF[l.id]; return w ? WORLD_SOUNDS[w] : []; }))]; if (names.length) void soundBank.load(BASE, names); }, [layers]);
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
    placeName: active ? placeLabel(active) : '', center: active, layers, rangeKm, mode, sound: soundMode, scale, lang, announce,
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
    setWorldTheme(null);
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
    if (quietPlace.current) { quietPlace.current = false; return; }
    if (!place || tourOn.current) return;
    const name = placeLabel(place);
    if (playingRef.current) { announce(`${name}.`); return; }
    const here = layersRef.current.map((l) => { const w = WORLD_OF[l.id]; const v = l.sample(place); return w && !Number.isNaN(v) ? describeWorld(w, v, gainFor(v, l, 'global'), lang) : null; }).filter(Boolean).join('; ');
    announce(lang === 'en'
      ? `${name} selected.${here ? ' Here: ' + here + '.' : ''} Press P to listen, or say "Earth, play". Press L for the audio legend, H for help.`
      : `${name} seçildi.${here ? ' Burada: ' + here + '.' : ''} Dinlemek için P tuşuna bas ya da "Dünya, çal" de. Sesli lejant için L, yardım için H.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place]);

  // ---------- sesli rehber: karşılama, yardım, düğme adlarını okuma, kısayollar
  const helpText = useCallback(() => (langRef.current === 'en'
    ? 'EarthEar help. To speak, hold the Space key, say a command and release, for example: go to Sivas, play, stop, temperature on, summary. With hands-free listening on, just start with "Earth". Moving the mouse over the globe says the name of the place under it. Press C to choose a place: type a city name, pick with the down arrow, confirm with Enter. P plays or stops the radar. Each data layer is a sound world: keys 1 to 4 turn layers on and off. While the music plays, travel across the Earth with I for north, K for south, J for west and M for east. Left and right arrows turn the beam by hand. B compares with a second place, Y opens Earth stories, E lists natural events near you, V opens your soundscape settings, N turns the narrator on, W the weather. S reads a summary, L plays the audio legend, Escape silences speech, G or the Voice guide button turns this voice guide on and off. H repeats this help.'
    : 'EarthEar yardım. Konuşmak için Boşluk tuşunu basılı tut, komutu söyle ve bırak; örneğin: Sivas\'a git, çal, dur, sıcaklığı aç, özet. Eller serbest dinleme açıksa cümleye "Dünya" diye başlaman yeter. Fareyi Dünya üzerinde gezdirince altındaki yerin adı söylenir. Yer seçmek için C tuşuna bas: şehir adını yaz, aşağı okla seç, Enter ile onayla. P radarı çalar ya da durdurur. Her veri katmanı bir ses dünyasıdır: 1 ile 4 arası tuşlar katmanları açıp kapatır. Müzik çalarken Dünya üzerinde gezmek için I kuzey, K güney, J batı, M doğu tuşlarını kullan. Sol ve sağ ok ışını elle çevirir. B ikinci bir yerle karşılaştırır, Y Dünya hikâyelerini açar, E yakındaki doğa olaylarını listeler, V ses sahneni açar, N anlatıcıyı açar, W hava durumu. S özeti okur, L sesli lejantı çalar, Escape konuşmayı susturur. G tuşu ya da Sesli Rehber düğmesi bu sesli rehberi açar ve kapatır. H bu yardımı tekrarlar.'), []);
  const welcomed = useRef(false);
  // ---------- tek dokunuşla başlama + eller serbest dinleme (kör kullanıcı için tuş bilmek gerekmez)
  const [started, setStarted] = useState(false);
  const [gateDone, setGateDone] = useState(false); // giriş ekranı Dünya'ya yaklaşma animasyonu bitti mi
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
      ? (en ? 'Hello, I am EarthEar. I am listening to you. We recommend wearing headphones. Start each command with "Earth", for example: Earth, go to Sivas. Or hold the Space key while you speak. For help say "Earth, help".'
        : 'Merhaba, ben EarthEar. Sizi dinliyorum. Kulaklık takmanızı öneririz. Komut vermek için cümleye "Dünya" diye başlayın, örneğin: Dünya, Sivas\'a git. Ya da konuşurken Boşluk tuşunu basılı tutun. Yardım için "Dünya, yardım" deyin.')
      : (en ? 'Hello, I am EarthEar. We recommend wearing headphones. Voice commands are not available right now. You can type commands: type a city name in the command box, for example Sivas.'
        : 'Merhaba, ben EarthEar. Kulaklık takmanızı öneririz. Sesli komut şu an kullanılamıyor. Yazarak komut verebilirsiniz: komut kutusuna bir şehir adı yazın, örneğin Sivas.');
    setLive(''); requestAnimationFrame(() => setLive(msg)); // ekran okuyucu her zaman duyar
    if (canListen) hfApi.current.start(false);          // mikrofon izni hemen istenir (kullanıcı hareketiyle); kendi sesimiz yankı süzgecinde
    const after = () => afterWelcome.current(canListen);
    if (guideRef.current && speech.supported) void speech.say(msg).then(after); else after();
  }, []);
  const afterWelcome = useRef<(canListen: boolean) => void>(() => {});
  // ---------- rehberli tur durumu
  const [tour, setTour] = useState<{ i: number; n: number; text: string } | null>(null);
  const [tourAsk, setTourAsk] = useState(false);
  const tourAskRef = useRef(false); tourAskRef.current = tourAsk;
  const tourRun = useRef(0), tourOn = useRef(false);
  const tourPrev = useRef<{ place: Place | null; on: Record<LayerId, boolean>; m24On: Record<string, boolean>; visual: LayerId; range: number; playing: boolean } | null>(null);
  const tourApi = useRef({ start: () => {}, end: (_why: 'done' | 'cancel' | 'cmd') => {}, answer: (_yes: boolean) => {} });

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
      const d = Math.abs(a - b), hi = a > b ? nm(place) : nm(placeB);
      const diff = l.unit === 'ppm' ? `${d.toFixed(1)} ppm` : l.unit === '°C' ? `${Math.round(d)} ${en ? 'degrees' : 'derece'}` : `${Math.round(d * 100)}`;
      const same = l.unit === 'ppm' ? d < 0.05 : l.unit === '°C' ? d < 0.5 : d < 0.01;
      return en ? `${l.label}: ${nm(place)} ${l.fmt(a)}, ${nm(placeB)} ${l.fmt(b)}. ${same ? 'About the same.' : `${hi} is higher by ${diff}.`}`
        : `${l.label}: ${nm(place)} ${l.fmt(a)}, ${nm(placeB)} ${l.fmt(b)}. ${same ? 'Neredeyse aynı.' : `${hi} ${diff} daha yüksek.`}`;
    });
    const km = formatKm(haversineKm(place, placeB));
    announce((en ? `${nm(place)} and ${nm(placeB)} are ${km} apart. ` : `${nm(place)} ile ${nm(placeB)} arası ${km}. `) + (parts.length ? parts.join(' ') : en ? 'No layer is on.' : 'Hiç katman açık değil.'));
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

  // ---------- 30 SANİYELİK REHBERLİ TUR: 4 durak. Her durakta kamera süzülür → ~1,5 sn ses → gerçek veriyle kısa anlatım → birkaç sn yalnız ses.
  // Herhangi bir tuş, "dur" ya da "geç" turu bitirir. Bitince (ya da kesilince) önceki yer ve katmanlar geri gelir; bir daha sorulmaz.
  const endLine = () => (langRef.current === 'en'
    ? (listener.supported ? 'Now it is your turn. Say "Earth" and a city name.' : 'Now it is your turn. Type a city name in the command box.')
    : (listener.supported ? 'Şimdi sıra sizde. "Dünya" deyip bir şehir söyleyin.' : 'Şimdi sıra sizde. Komut kutusuna bir şehir adı yazın.'));
  const tourLine = (i: number): string => {
    const en = langRef.current === 'en', lg = en ? 'en' : 'tr', S = TOUR[i];
    const L = (id: string) => layersRef.current.find((l) => l.id === id);
    const at = (id: string) => { const l = L(id); if (!l) return null; const v = l.sample(S); const w = WORLD_OF[l.id]; if (Number.isNaN(v) || !w) return null; const t = gainFor(v, l, 'global'); return { v, t, d: describeWorld(w, v, t, lg) }; };
    const R = radarRef.current;
    const mood = R.P && R.computed.length ? moodOf({ P: R.P, mode, layers: R.computed }) : null;
    const music = soundModeRef.current !== 'nature' && mood;
    if (i === 0) {
      const d = at('dust'), T = at('temp');
      return en
        ? `This is the Sahara. What you hear is ${d ? d.d : 'dust'}: how dusty the air is, relative.${T ? ` Surface ${Math.round(T.v)} degrees.` : ''}${music ? (mood.minor ? ' The music is tense, because the region is under stress.' : ' The music is calm, because the region is not under stress right now.') : ''}`
        : `Burası Sahra. Duyduğunuz ${d ? d.d : 'toz'}: havadaki tozun göreli yoğunluğu.${T ? ` Yüzey ${Math.round(T.v)} derece.` : ''}${music ? (mood.minor ? ' Müzik gergin, çünkü bölge zorlanıyor.' : ' Müzik sakin, çünkü bölge şu an zorlanmıyor.') : ''}`;
    }
    if (i === 1) {
      const d = at('ndvi');
      return en
        ? `This is the Amazon. You hear ${d ? d.d : 'the forest'}: how green the land is, relative.${music ? (mood.minor ? ' The marimba sounds tense.' : ' The marimba is bright, because the forest is rich.') : ''}`
        : `Burası Amazon. Duyduğunuz ${d ? d.d : 'orman'}: bitki örtüsünün göreli yoğunluğu.${music ? (mood.minor ? ' Marimba gergin.' : ' Marimba parlak, çünkü orman zengin.') : ''}`;
    }
    if (i === 2) {
      const d = at('lightning');
      return en
        ? `This is Central Africa, the Congo basin. You hear ${d ? d.d : 'thunder'}: how often lightning strikes, relative.${music ? ' Timpani play along with the thunder.' : ''}`
        : `Burası Orta Afrika, Kongo havzası. Duyduğunuz ${d ? d.d : 'gök gürültüsü'}: şimşek sıklığı, göreli.${music ? ' Timpani gök gürültüsüne eşlik ediyor.' : ''}`;
    }
    const d = at('sst');
    const cold = d ? d.v < 8 : false;
    return en
      ? `This is the North Atlantic. You hear ${d ? d.d : 'waves'}: the sea surface temperature.${music ? (cold ? ' The celesta plays the cold water.' : ' The harp plays the cool water.') : ''}`
      : `Burası Kuzey Atlantik. Duyduğunuz ${d ? d.d : 'dalgalar'}: deniz yüzeyinin sıcaklığı.${music ? (cold ? ' Çelesta soğuk suyu çalıyor.' : ' Arp serin suyu çalıyor.') : ''}`;
  };
  tourApi.current.end = (why) => {
    if (!tourOn.current) return;
    tourRun.current++; tourOn.current = false; setTour(null); store.set('tourDone', '1');
    speech.stop();
    const pr = tourPrev.current; tourPrev.current = null;
    if (pr) {
      setOn(pr.on); setM24On(pr.m24On); setVisual(pr.visual); setRange(pr.range);
      if (why !== 'cmd') { if (pr.place) quietPlace.current = true; setPlace(pr.place); if (!pr.place || !pr.playing) radarRef.current.stop(); }
    }
    if (why !== 'cmd') {
      const t = (why === 'cancel' ? (langRef.current === 'en' ? 'Tour ended. ' : 'Tur bitti. ') : '') + endLine();
      announce(t);
    }
  };
  tourApi.current.start = () => {
    setTourAsk(false);
    if (tourOn.current) return;
    const my = ++tourRun.current; tourOn.current = true;
    const alive = () => tourRun.current === my;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    welcomed.current = true; engine.unlock();
    radarRef.current.hush(); stopStory(); setCompare(false); setPickOpen(false);
    tourPrev.current = { place, on, m24On, visual, range: rangeKm, playing: radarRef.current.playing };
    const sayT = async (i: number, t: string) => {
      if (!alive()) return false;
      setTour({ i, n: TOUR.length, text: t }); lastSpoken.current = t;
      if (guideRef.current && speech.supported) await speech.say(t);
      else { setLive(''); requestAnimationFrame(() => setLive(`${i}/${TOUR.length}. ${t}`)); await wait(1500 + t.length * 60 / Math.max(0.8, speech.rate)); }
      return alive();
    };
    void (async () => {
      for (let i = 0; i < TOUR.length; i++) {
        const S = TOUR[i], en = langRef.current === 'en';
        setOn({ co2: false, temp: false, sst: false, aerosol: false, ndvi: false, lights: false, lightning: false, currents: false, lis: false, gedi: false, ...Object.fromEntries(S.layers.map((k) => [k, true])) });
        setM24On({}); setVisual(S.layers[0]); setWorldTheme(null); setRange(S.range);
        setPlace({ lat: S.lat, lon: S.lon, name: en ? S.en.replace(/^the /, 'The ') : S.tr, source: 'harita' });
        setTour({ i: i + 1, n: TOUR.length, text: en ? S.en.replace(/^the /, 'The ') : S.tr });
        // katman ilk kez açılıyorsa yüklenmesini bekle (en çok 5 sn)
        for (let k = 0; k < 50 && alive(); k++) { const ids = layersRef.current.map((l) => l.id as string); if (S.need.every((id) => ids.includes(id))) break; await wait(100); }
        if (!alive()) return;
        if (!radarRef.current.playing) radarRef.current.play();
        await wait(1500); if (!alive()) return;              // önce ses
        if (!await sayT(i + 1, tourLine(i))) return;        // sonra gerçek veriyle anlatım
        await wait(2200); if (!alive()) return;              // birkaç sn yalnız ses
      }
      tourApi.current.end('done');
    })();
  };
  tourApi.current.answer = (yes) => {
    setTourAsk(false);
    if (yes) { tourApi.current.start(); return; }
    store.set('tourDone', '1');
    announce((langRef.current === 'en' ? 'Okay. ' : 'Peki. ') + endLine().replace(/^(Now it is your turn|Şimdi sıra sizde)\. /, ''));
  };
  afterWelcome.current = (canListen) => {
    const en = langRef.current === 'en', h = homeRef.current;
    const done = () => { if (canListen && handsFree.enabled) engine.beep(); else if (!listener.supported) hfApi.current.unavailable(); };
    const parts: string[] = [];
    if (h) { quietPlace.current = true; setPlace({ ...h }); parts.push(en ? `Welcome home, ${nm(h)}.` : `Evinize hoş geldiniz, ${nm(h)}.`); }
    if (store.get('tourDone') !== '1') {
      setTourAsk(true);
      parts.push(canListen ? (en ? 'Shall I let you listen to the Earth? Say yes or no.' : 'Sana Dünya\'yı dinleteyim mi? Evet ya da hayır deyin.')
        : (en ? 'Shall I let you listen to the Earth? Choose Start tour or Skip.' : 'Sana Dünya\'yı dinleteyim mi? Turu başlat ya da Geç düğmesini seçin.'));
    }
    if (!parts.length) { done(); return; }
    const t = parts.join(' '); lastSpoken.current = t;
    setLive(''); requestAnimationFrame(() => setLive(t));
    if (guideRef.current && speech.supported) void speech.say(t).then(done); else done();
  };
  useEffect(() => { if (tourAsk) setTimeout(() => document.querySelector<HTMLElement>('.tour-ask .btn.primary')?.focus(), 60); }, [tourAsk]);
  const storyList: StoryInfo[] = lang === 'en' ? [
    { id: 'journey', title: 'Journey toward the equator', text: 'Travel from your place toward the equator and hear the temperature change (guitar).' },
    { id: 'dust', title: 'Travelers in the air', text: 'Find the densest dust within 5000 km of your place and go there (celesta).' },
  ] : [
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
    const only = (k: LayerId) => { setOn({ co2: k === 'co2', temp: k === 'temp', sst: k === 'sst', aerosol: k === 'aerosol', ndvi: false, lights: false, lightning: false, currents: false, lis: false, gedi: false }); setVisual(k); };
    const title = storyList.find((s) => s.id === id)?.title ?? id;
    radarRef.current.hush(); setCompare(false); setStory(title); engine.unlock();
    const prevMode = mode, prevAdvance = advance;
    try {
      if (id === 'breath') {
        const co2s = live2.current.co2; if (!co2s) return;
        only('co2'); setAdvance(false); setMode('bilim'); setMonth(0);
        const series = co2s.grid.monthSeries(start);
        if (!await tell(en ? `The planet breathes. You will hear one year of carbon dioxide above ${nm(start)}. When the violin rises, there is more carbon dioxide in the air.`
          : `Gezegenin nefesi. ${nm(start)} üzerindeki karbondioksitin bir yılını dinleyeceksin. Keman inceldikçe havadaki karbondioksit artar.`)) return;
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
        if (!await tell(en ? `Journey toward the equator. We leave ${nm(start)} and travel ${dir === 180 ? 'south' : 'north'}. When the guitar rises, the surface is warmer.`
          : `Ekvatora yolculuk. ${nm(start)} üzerinden ${dir === 180 ? 'güneye' : 'kuzeye'} doğru gidiyoruz. Gitar inceldikçe yüzey daha sıcak.`)) return;
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
        if (best.v < 0.08) { await tell(en ? `Travelers in the air. There is no dense dust within 5000 kilometers of ${nm(start)} in this image.` : `Havadaki yolcular. Bu görselde ${nm(start)} çevresinde 5000 kilometre içinde yoğun toz yok.`); return; }
        if (!await tell(en ? `Travelers in the air. The densest dust is ${formatKm(best.km)} to the ${compass8(best.br, 'en')} of ${nm(start)}. We are going there. The celesta bells are dust.`
          : `Havadaki yolcular. En yoğun toz ${nm(start)} üzerinden ${compass8(best.br)} yönünde, ${formatKm(best.km)} uzakta. Oraya gidiyoruz. Çelesta çanları tozu gösterir.`)) return;
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

  // ---------- sesli komutlar: Boşluk tuşunu (ya da Konuş düğmesini) basılı tut, konuş, bırak; söyleneni yapar
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  /** Yer çözümleyici (src/lib/gazetteer.ts; sınama: npm run test:places). */
  const findPlace = (raw: string) => gazRef.current?.resolve(raw) ?? null;
  /** Yerin arayüz dilindeki adı (TR/EN ayrı). */
  const nm = (p: Place) => p.names?.[langRef.current] ?? p.name;
  const hitPlace = (h: Hit): Place => {
    const names = h.kind === 'city' && h.cc ? { tr: `${hitName(h, 'tr')}, ${countryName(h.cc, 'tr')}`, en: `${hitName(h, 'en')}, ${countryName(h.cc, 'en')}` } : { tr: hitName(h, 'tr'), en: hitName(h, 'en') };
    return { lat: h.lat, lon: h.lon, name: names[langRef.current], names, source: 'arama' };
  };
  // sesle başlayan iş sesle biter: yer bulunamazsa en yakın 2 aday sesli sorulur, cevap ("birincisi", "Kanada", "evet") burada beklenir
  const choiceRef = useRef<{ cands: Hit[]; action: 'go' | 'compare' | 'weather'; until: number } | null>(null);
  const noAck = useRef(false);       // komut anlaşıldı ama yapılamadı → "Anlaşıldı" denmez
  const strictPass = useRef(false);  // ilk geçiş: tanıma adaylarının hiçbirinde kesin yer yoksa aday önerisine geçilir
  const placeAction = (action: 'go' | 'compare' | 'weather', h: Hit) => {
    const en = langRef.current === 'en', R = radarRef.current, p = hitPlace(h);
    if (action === 'weather') { openWeather({ ...p, name: en ? h.en : h.tr }); return; }
    if (action === 'compare') {
      setPlaceB(p); setCompare(true); setCmpTurn(0);
      announce(en ? `Comparing with ${nm(p)}: one sweep here, one sweep there. Say "difference" to hear the numbers.` : `${nm(p)} ile karşılaştırılıyor: bir tur burası, bir tur orası. Sayıları duymak için "fark" de.`);
      if (!R.playing) setTimeout(() => radarRef.current.play(), 300); return;
    }
    quietPlace.current = true; setPlace(p); setPickOpen(false);
    announce(goLine(h, en ? 'en' : 'tr'));
    if (!R.playing) setTimeout(() => radarRef.current.play(), 2500); // duyurudan sonra müzik başlasın
  };
  /** Bulunamadı: sesli söyle, adayları sor (yazı penceresi AÇILMAZ). */
  const notFound = (q: string, cands: Hit[], action: 'go' | 'compare' | 'weather') => {
    const en = langRef.current === 'en'; noAck.current = true;
    if (cands.length) {
      choiceRef.current = { cands, action, until: Date.now() + 30000 };
      announce(en ? `I could not find "${q}". ${cands.map((c) => c.en).join(' or ')}? Say "first", "second" or the name.`
        : `"${q}" adlı yeri bulamadım. ${cands.map((c) => soru(c.tr)).join(', ')}? "Birincisi", "ikincisi" ya da adını söyleyin.`);
    } else announce(en ? `I could not find "${q}". Say a country, city or region, for example: Earth, go to Canada.` : `"${q}" adlı yeri bulamadım. Bir ülke, şehir ya da bölge adı söyleyin, örneğin: Dünya, Kanada'ya git.`);
  };
  const MONTH_WORDS = [['ocak', 'january'], ['subat', 'february'], ['mart', 'march'], ['nisan', 'april'], ['mayis', 'may'], ['haziran', 'june'], ['temmuz', 'july'], ['agustos', 'august'], ['eylul', 'september'], ['ekim', 'october'], ['kasim', 'november'], ['aralik', 'december']];
  const commandHelp = () => (lang === 'en'
    ? 'You can say or type: go to Sivas. Play. Stop. Temperature on. Ocean off. Sea temperature on. Precipitation on. Sea ice on. Summary. Legend. Go north. Range two thousand. July. Compare with Tokyo. Local scale. Tell the breath story. Events. Switch to Turkish. Stop listening. Help.'
    : 'Şunları söyleyebilir ya da yazabilirsin: Sivas\'a git. Çal. Dur. Sıcaklığı aç. Okyanusu kapat. Deniz sıcaklığını aç. Yağışı aç. Deniz buzunu aç. Özet. Lejant. Kuzeye git. Menzil iki bin. Temmuz. Tokyo ile karşılaştır. Yerel ölçek. Nefes hikâyesini anlat. Olaylar. İngilizceye geç. Dinlemeyi durdur. Yardım.');
  /** Söylenen cümleyi komuta çevir ve uygula. Anlaşıldıysa true. */
  const runCommand = (text: string): boolean => {
    const en = lang === 'en', R = radarRef.current;
    const t = ` ${fold(text).replace(/[.,!?’'`]/g, ' ').replace(/\s+/g, ' ').trim()} `;
    const has = (...w: string[]) => w.some((x) => t.includes(x));
    const word = (...w: string[]) => w.some((x) => t.includes(` ${x} `));
    let prC: ReturnType<typeof findPlace> | undefined;
    const pr = () => (prC === undefined ? (prC = findPlace(text)) : prC); // yer çözümü (gerekince, bir kez)
    const needPlace = () => { if (place) return true; announce(en ? 'Choose a place first. Say, for example: go to Sivas.' : 'Önce bir yer seç. Örneğin şöyle söyle: Sivas\'a git.'); return false; };

    // dil (Adım 4): "Switch to English", "English", "İngilizceye geç" / "Türkçeye geç", "Turkish", "Türkçe" — iki dilde de çalışır
    if (has('ingilizce', 'english', 'ingilizceye')) { setLang('en'); return true; }
    if (has('turkce', 'turkish', 'turkceye')) { setLang('tr'); return true; }
    if (tourAskRef.current) {
      if (word('hayir', 'gec', 'istemiyorum', 'sonra', 'no', 'skip', 'later')) { tourApi.current.answer(false); return true; }
      if (word('evet', 'olur', 'tamam', 'baslat', 'tabii', 'yes', 'sure', 'okay', 'ok', 'start')) { tourApi.current.answer(true); return true; }
    }
    if (tourOn.current) {
      if (word('dur', 'durdur', 'gec', 'yeter', 'bitir', 'stop', 'skip', 'enough', 'end')) { tourApi.current.end('cancel'); return true; }
      tourApi.current.end('cmd'); // başka bir komut: tur biter, komut uygulanır
    }
    const ch = choiceRef.current;
    if (ch && Date.now() < ch.until && gazRef.current) {
      const c = gazRef.current.choose(text, ch.cands);
      if (c === 'no') { choiceRef.current = null; announce(en ? 'Okay.' : 'Peki.'); return true; }
      if (c) { choiceRef.current = null; placeAction(ch.action, c); return true; }
    }
    if (has('turu baslat', 'tur baslat', 'rehberli tur', 'turu ac', 'turu yap', 'start the tour', 'start tour', 'guided tour', 'take the tour')) { tourApi.current.start(); return true; }
    // "ne duyuyorum": merkezde duyulan ses + değeri (alt çubuktaki özetle aynı hesap: en baskın ses dünyası)
    if (has('ne duyuyorum', 'neyi duyuyorum', 'ne caliyor', 'ne calıyor', 'what am i hearing', 'what is playing', 'whats playing', 'what do i hear') || word('acikla', 'explain')) {
      if (!needPlace()) return true;
      const here = placeLabel(active ?? place!); // "Kisangani yakını, Demokratik Kongo Cumhuriyeti"
      if (centerBest) { announce(en ? `${here}. ${centerBest.l.label}: ${fmtShort(centerBest.l, centerBest.v)}; you are hearing ${centerDesc}.` : `${here}. ${centerBest.l.label}: ${fmtShort(centerBest.l, centerBest.v)}, ${centerDesc} duyuyorsun.`); return true; }
      const l0 = layers[0], v0 = l0 && active ? l0.sample(active) : NaN;
      if (l0 && !Number.isNaN(v0)) { announce(en ? `${here}. ${l0.label}: ${fmtShort(l0, v0)}, played as ${l0.instrument} notes.` : `${here}. ${l0.label}: ${fmtShort(l0, v0)}, ${l0.instrument} notalarıyla çalıyor.`); return true; }
      announce(en ? `${here}: there is no data under the center for the open layers.` : `${here}: açık katmanlarda merkezde veri yok.`); return true;
    }
    if (word('yardim', 'help', 'komutlar', 'commands') || has('ne soyleyebilirim', 'what can i say')) { announce(commandHelp()); return true; }
    // konuşma: hız, tekrar, sus (yalnız konuşma; doğa ve müzik sürer)
    const rateTo = (d: number) => { const v = Math.max(0.8, Math.min(2, +(mixRef.current.rate + d).toFixed(1))); setMix({ ...mixRef.current, rate: v }); speech.setRate(v); announce(en ? `Speech rate ${v}.` : `Konuşma hızı ${String(v).replace('.', ',')}.`); };
    if (has('hizli konus', 'speak faster', 'talk faster', 'faster speech', 'speak quicker')) { rateTo(0.2); return true; }
    if (has('yavas konus', 'speak slower', 'talk slower', 'slower speech', 'speak more slowly')) { rateTo(-0.2); return true; }
    if (has('tekrar et', 'tekrarla', 'tekrar soyle', 'bir daha soyle', 'repeat', 'say again', 'say that again')) { announce(lastSpoken.current || (en ? 'I have not said anything yet.' : 'Henüz bir şey söylemedim.')); return true; }
    if (word('sus', 'sussana', 'susun', 'shush', 'hush') || has('stop talking', 'be quiet', 'shut up', 'konusmayi durdur', 'konusmayi kes', 'stop speaking')) { R.hush(); silentReply.current = true; return true; }
    // ev konumu (yalnız bu tarayıcıda)
    const noHome = en ? 'No home saved yet. Choose a place and say: Earth, this is my home.' : 'Henüz ev kaydedilmedi. Bir yer seçip "Dünya, burası benim evim" deyin.';
    if (has('evde', 'evimde', 'at home', 'my home', 'home weather') && has(' hava', 'weather', 'forecast')) { const h = homeRef.current; if (!h) announce(noHome); else openWeather({ ...h, name: h.name }); return true; }
    if (has('burasi benim evim', 'burasi evim', 'evimi kaydet', 'ev olarak kaydet', 'evim olsun', 'evim burasi', 'this is my home', 'save my home', 'save home', 'set home', 'my home is here')) {
      if (!needPlace()) return true;
      saveHome(place!); announce(en ? `${nm(place!)} saved as your home.` : `${nm(place!)} eviniz olarak kaydedildi.`); return true;
    }
    if (has('eve don', 'evime don', 'eve git', 'evime git', 'go home', 'take me home', 'back home')) {
      const h = homeRef.current; if (!h) { announce(noHome); return true; }
      setPlace({ ...h }); setPickOpen(false); if (!R.playing) setTimeout(() => radarRef.current.play(), 2500); return true;
    }
    if (has('dinlemeyi durdur', 'dinlemeyi kapat', 'dinlemeyi birak', 'stop listening')) {
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
    if (word('hava', 'havasi', 'havada', 'havalar') || has('hava durumu', 'weather', 'meteorolog', 'forecast')) { // "Havana" hava değildir
      const r = findPlace(text);
      if (r?.hit) { placeAction('weather', r.hit); return true; }
      if (r && r.query && r.cands.length) { if (strictPass.current) return false; notFound(r.query, r.cands, 'weather'); return true; }
      const t = place ? { ...place, name: placeLabel(place).split(',')[0] } : null;
      if (!t) { announce(en ? 'Which place? Say for example: Earth, what is the weather in Sivas?' : 'Hangi yer? Örneğin: Dünya, Sivas\'ta hava nasıl?'); return true; }
      openWeather(t); return true;
    }
    if (has('daha fazla', 'more detail', ' more ') && wxTarget) { loadWx().then((f) => announce(spokenDetail(f, wxTarget, langRef.current))).catch(() => {}); return true; }
    if (has('olay', 'event')) { if (needPlace()) openEvents(); return true; }
    if (has('karsilastir', 'kiyasla', 'compare')) {
      if (!needPlace()) return true;
      const r = findPlace(text);
      if (r?.hit) { placeAction('compare', r.hit); return true; }
      if (strictPass.current) return false;
      if (r?.query) notFound(r.query, r.cands, 'compare');
      else { noAck.current = true; announce(en ? 'Compare with which place? Say for example: Earth, compare with Tokyo.' : 'Hangi yerle? Örneğin: Dünya, Tokyo ile karşılaştır.'); }
      return true;
    }
    if (has('sadece doga', 'muzigi kapat', 'muzik kapat', 'only nature', 'music off')) { setSoundMode('nature'); return true; }
    if (has('sadece muzik', 'only music', 'music only')) { setSoundMode('music'); return true; }
    if (has('muzigi yukselt', 'muzigi artir', 'muzik yukselt', 'louder music', 'music louder', 'raise the music')) { const v = Math.min(3, +(mixRef.current.music + 0.3).toFixed(2)); setMix({ ...mixRef.current, music: v }); if (soundMode === 'nature') setSoundModeS('both'); announce(en ? `Music level ${Math.round(v * 100)} percent.` : `Müzik seviyesi yüzde ${Math.round(v * 100)}.`); return true; }
    if (has('muzigi kis', 'muzik kis', 'muzigi azalt', 'quieter music', 'music quieter', 'lower the music')) { const v = Math.max(0.2, +(mixRef.current.music - 0.3).toFixed(2)); setMix({ ...mixRef.current, music: v }); announce(en ? `Music level ${Math.round(v * 100)} percent.` : `Müzik seviyesi yüzde ${Math.round(v * 100)}.`); return true; }
    if (has('muzigi ac', 'muzik ac', 'music on')) { setSoundMode('both'); return true; }
    if (has('yerel olcek', 'local scale', 'yerel')) { setScale('local'); return true; }
    if (has('kuresel olcek', 'global scale', 'kuresel', 'sabit olcek')) { setScale('global'); return true; }
    if (has('fark', 'difference')) { if (placeB) sayDiff(); else announce(en ? 'There is no second place yet. Say: compare with Tokyo.' : 'Henüz ikinci yer yok. Şöyle söyle: Tokyo ile karşılaştır.'); return true; }
    if (has('neredeyim', 'where am i', 'burasi neresi')) { if (needPlace()) announce(en ? `You are at ${placeLabel(active ?? place!)}.` : `${placeLabel(active ?? place!)} üzerindesin.`); return true; }
    if (has(' ozet', 'summary')) { if (needPlace()) R.summary(); return true; }
    if (has('lejant', 'legend', 'enstrumanlari tanit')) { if (needPlace()) void R.runLegend(); return true; }
    if (has('anlatici', 'narrator')) { setNarrator(!has('kapat', ' off ', 'kapa ')); return true; }

    // ülke / bölge adı katman ve yön sözcüklerinden önce: "Pasifik Okyanusu'na git" okyanus katmanı, "Kuzey Kutbu'na git" kuzey yönü DEĞİL
    { const P0 = pr(); if (P0?.hit && P0.hit.kind !== 'city' && (P0.intent || P0.whole)) { placeAction('go', P0.hit); return true; } }

    // 2024 aylık NASA katmanları (önce: daha özgül ifadeler). "deniz sıcaklığı" → 2024 MERRA-2; "okyanus" → ECCO2 katmanı
    const m24id = false && has('deniz yuzeyi sicakl', 'deniz sicakl', 'sea surface temp', 'sea temperature', 'sea surface') ? 'sst_24'
      : has('yagis', 'yagmur', 'precip', ' rain') ? 'precip_24'
        : has('deniz buzu', ' buz', 'sea ice', ' ice ') ? 'seaice_24'
          : has('kukurt', 'so2', 's o 2', 'sulfur', 'sulphur') ? 'so2_24'
            : has('optik derinlik', ' aod', 'optical depth') ? 'aod_24'
              : has('albedo', 'yansitma', 'reflectiv') ? 'albedo_24'
                : has('deri sicakl', 'skin temp') ? 'ts_24'
                  : has('hava sicakl', 'air temp', 'iki metre', '2 metre') || (has('2024') && has('sicakl', 'temperature')) ? 't2m_24'
                    : has('ozon', 'ozone') ? 'o3_24'
                      : has('toprak nem', 'soil moist', 'soil wet', 'toprak islak') ? 'gwettop_24'
                      : has('yaprak', 'leaf area', ' lai ') ? 'lai_24'
                        : has('su depolama', 'yer alti suyu', 'water storage', 'groundwater', 'grace') ? 'twland_24'
                          : has('aylik karbon', 'monthly carbon') || (has('2021') && has('aylik', 'monthly') && has('karbon', 'co2', 'carbon')) ? 'co2_24' : null;
    if (m24id) {
      const want = has('kapat', 'kapa ', 'kaldir', ' off ', 'remove') ? false : has(' ac ', 'ekle', 'goster', ' on ', ' add ', 'dinle', 'listen') ? true : !m24On[m24id];
      setM24Layer(m24id, want);
      return true;
    }
    const layer: LayerId | null = has('akinti', 'current') ? 'currents' : has('yildirim iklim', 'yildirim yogunl', 'flas yogunl', 'lightning climat', 'lightning density', 'lis otd') ? 'lis' : has('orman yuksekl', 'kanopi', 'agac boyu', 'agac yuksekl', 'forest height', 'canopy', 'gedi') ? 'gedi' : has('yildirim', 'simsek', 'lightning') ? 'lightning' : has('gece isik', 'night light', 'isiklar') ? 'lights' : has('bitki ortusu', 'ndvi', 'vejetasyon', 'vegetation', 'bitki', 'orman', 'forest') ? 'ndvi' : has('okyanus', 'deniz', 'ocean', ' sea ') ? 'sst' : has('sicakl', 'temperature', ' isi ') ? 'temp' : has('aerosol', 'toz', 'duman', 'dust', 'smoke') ? 'aerosol' : null;
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
    if (dir >= 0 && !pr()?.hit) { if (needPlace()) pickPoint(destination(place!, dir, rangeKm / 4), 'harita'); return true; }

    if (word('dur', 'durdur', 'stop', 'pause', 'duraklat', 'yeter')) { R.stop(); stopStory(); return true; }
    if (word('cal', 'baslat', 'basla', 'oynat', 'play', 'start', 'devam', 'dinle', 'muzik')) { const P1 = pr(); if (P1?.hit) { placeAction('go', P1.hit); return true; } if (needPlace() && !R.playing) R.play(); return true; }

    const goWords = has(' git ', 'gidelim', 'gotur', 'yer sec', ' go to ', 'take me', ' sehir', ' ac ', ' sec ', ' open ');
    const r = findPlace(text);
    if (r?.hit && (goWords || r.intent || r.whole)) { placeAction('go', r.hit); return true; }
    if (!(goWords || r?.intent)) return false;
    if (strictPass.current) return false; // önce diğer tanıma adaylarında kesin yer aranır
    if (r?.query) notFound(r.query, r.cands, 'go');
    else { noAck.current = true; announce(en ? 'Where to? Say for example: Earth, go to Canada.' : 'Nereye? Örneğin: Dünya, Kanada\'ya git.'); }
    return true;
  };
  const cmdRef = useRef(runCommand); cmdRef.current = runCommand;
  const [cmdHistory, setCmdHistory] = useState<CmdEntry[]>([]);
  const [guideStatus, setGuideStatus] = useState<GuideStatus>({ kind: 'idle' });
  const guideInput = useRef<HTMLInputElement>(null);
  const [guideOpen, setGuideOpenS] = useState(() => store.get('guideOpen') !== '0');
  const setGuideOpen = (v: boolean) => { setGuideOpenS(v); store.set('guideOpen', v ? '1' : '0'); };
  const EXAMPLES = { tr: 'Sivas\'a git; çal; sıcaklığı aç', en: 'go to Sivas; play; temperature on' };
  /** Sesli ya da yazılı komut: aynı çözümleyici. Anlaşılırsa onay sesi + "Anlaşıldı: …" + komutun kendi duyurusu; anlaşılmazsa 3 örnek. */
  const execCommand = (alts: string[], source: 'voice' | 'text') => {
    capture.current = []; silentReply.current = false; noAck.current = false;
    let hit: string | null = null;
    try {
      strictPass.current = true;   // 1. geçiş: tüm tanıma adaylarında kesin eşleşme
      for (const a of alts) if (cmdRef.current(a)) { hit = a; break; }
      strictPass.current = false;  // 2. geçiş: ilk aday için bulunamadı / aday önerisi
      if (!hit && cmdRef.current(alts[0])) hit = alts[0];
    } finally { strictPass.current = false; }
    const msgs = capture.current ?? []; capture.current = null;
    const en = langRef.current === 'en'; // dil komutu langRef'i hemen değiştirir → onay yeni dilde
    const text = hit ?? alts[0];
    let reply: string;
    if (hit && noAck.current) { // anlaşıldı ama yapılamadı (yer bulunamadı / aday soruldu): "Anlaşıldı" denmez
      engine.unlock(); engine.confirm(false);
      reply = msgs.join(' ');
    } else if (hit) {
      engine.unlock(); engine.confirm(true);
      reply = [en ? `Understood: ${text}.` : `Anlaşıldı: ${text}.`, ...msgs].join(' ');
    } else {
      engine.unlock(); engine.confirm(false);
      reply = en ? `I did not understand: ${text}. Try for example: ${EXAMPLES.en}.` : `Anlamadım: ${text}. Örneğin şunları deneyebilirsin: ${EXAMPLES.tr}.`;
    }
    const prevSpoken = lastSpoken.current;
    if (hit && silentReply.current) silentReply.current = false; // "sus": yalnız onay sesi
    else announce(reply);
    lastSpoken.current = hit && msgs.length ? msgs.join(' ') : prevSpoken;
    setGuideStatus({ kind: hit ? 'ok' : 'fail', text: reply });
    setCmdHistory((h) => [{ text, ok: !!hit, source, reply }, ...h].slice(0, 6));
    return !!hit;
  };
  /** Sesli komut kullanılamıyorsa yazılı kutuya yönlendir. */
  const toTextBox = (why: string) => {
    const en = langRef.current === 'en';
    const msg = `${why ? why + ' ' : ''}${en ? 'Voice commands are not available right now. You can type commands.' : 'Sesli komut şu an kullanılamıyor. Yazarak komut verebilirsiniz.'}`;
    announce(msg); setGuideStatus({ kind: 'error', text: msg });
    if (!listener.supported) { setGuideOpenS(true); setTimeout(() => guideInput.current?.focus(), 80); }
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
      if (err === 'nospeech') { const m = en ? 'I did not hear anything. Hold the Space key while you speak, or type the command.' : 'Bir şey duymadım. Konuşurken Boşluk tuşunu basılı tut ya da komutu yaz.'; announce(m); setGuideStatus({ kind: 'error', text: m }); return; }
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
          // Tur sorusu açıkken "evet / hayır", tur sürerken "dur / geç" uyandırma kelimesi olmadan da çalışır (yalnız bu kısa cevaplar).
          const chs = choiceRef.current;
          if (chs && Date.now() < chs.until && gazRef.current && alts.some((x) => gazRef.current!.choose(x, chs.cands))) { execRef.current(alts, 'voice'); return; }
          if (tourAskRef.current || tourOn.current) {
            const short = alts.map((a) => ` ${fold(a).replace(/[.,!?]/g, ' ').replace(/\s+/g, ' ').trim()} `);
            const any = (...w: string[]) => short.some((x) => w.some((y) => x.includes(` ${y} `)));
            if (tourAskRef.current && any('hayir', 'gec', 'istemiyorum', 'no', 'skip')) { tourApi.current.answer(false); return; }
            if (tourAskRef.current && any('evet', 'olur', 'tamam', 'baslat', 'yes', 'sure', 'okay', 'ok')) { tourApi.current.answer(true); return; }
            if (tourOn.current && any('dur', 'durdur', 'gec', 'yeter', 'bitir', 'stop', 'skip')) { tourApi.current.end('cancel'); return; }
          }
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
  // Boşluk = BAS-KONUŞ: basınca anında dinler, bırakınca durur ve söyleneni işler (tekrar eden keydown yok sayılır).
  // Odak yazı kutusunda, düğmede, onay kutusunda, kaydırıcıda, sekmede ya da diyalogdaysa Boşluk normal işini yapar (ekran okuyucu kullanıcıları düğmelere Boşluk ile basar).
  const spaceHold = useRef(false);
  const spaceOwnedBy = (t: EventTarget | null) => { const el = t instanceof HTMLElement ? t : null; if (!el) return false; if (isFormTarget(el) || inDialog(el)) return true;
    return !!el.closest('button, a[href], summary, label, [role="button"], [role="tab"], [role="checkbox"], [role="switch"], [role="slider"], [role="radio"], [role="menuitem"], [role="option"], [role="link"]'); };

  // genel kısayollar: C yer seç · H yardım · G sesli rehber · Esc sustur · 1-4 katman · I/J/K/M gez
  const globalKeys = useRef<(e: KeyboardEvent) => void>(() => {});
  globalKeys.current = (e) => {
    if ((e.key === ' ' || e.code === 'Space') && !e.ctrlKey && !e.metaKey && !e.altKey) { // bas-konuş (tek tuş kısayolları kapalı olsa da çalışır)
      if (spaceOwnedBy(e.target)) return;
      e.preventDefault();
      if (e.repeat || spaceHold.current) return;
      spaceHold.current = true; talk(true);
      return;
    }
    // yazı alanında ya da açık diyalogda hiçbir kısayol çalışmaz (Esc'yi diyalog işler: yalnız pencereyi kapatır)
    if (!shortcutAllowed(e)) return;
    if (e.key === 'Escape') { radar.hush(); stopStory(); return; }
    const k = e.key.toLowerCase();
    if (k === 'c') { e.preventDefault(); setPickFor('A'); setPickOpen(true); }
    else if (k === 'h' || e.key === '?') { e.preventDefault(); welcomed.current = true; radar.hush(); setHelpOpen(true); if (guideRef.current) void speech.say(helpText()); else announce(helpText()); }
    else if (k === 'g') { e.preventDefault(); setGuide(!guideRef.current); }
    else if (k === 'b' && place) { e.preventDefault(); setPickFor('B'); setPickOpen(true); }
    else if (k === 'y') { e.preventDefault(); setStoriesOpen(true); }
    else if (k === 'e' && place) { e.preventDefault(); openEvents(); }
    else if (k === 'v') { e.preventDefault(); setSoundOpen(true); }
    else if (k === 'w') { e.preventDefault(); openWeather(place ? { ...place, name: placeLabel(place).split(',')[0] } : null); }
    else if (k === 'n') { e.preventDefault(); setNarrator(!live2.current.narrator); }
    else if (k === 'p') { e.preventDefault(); radar.toggle(); }
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
      if (tourOn.current) { e.preventDefault(); e.stopImmediatePropagation(); tourApi.current.end('cancel'); return; } // herhangi bir tuş turu bitirir
      if (speech.active && e.key !== ' ' && e.code !== 'Space') speech.stop(); // rehber konuşurken herhangi bir tuş konuşmayı keser (Boşluk = çal/durdur)
      if (hfStoppedByVoice.current && hfWantedRef.current && !isFormTarget(e.target) && !e.altKey) hfApi.current.start(true); // "sus" sonrası herhangi bir tuş
    };
    const up = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.code !== 'Space') return;
      if (spaceHold.current) { spaceHold.current = false; listener.finish(); } // bırakınca hemen dur ve işle
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
  useEffect(() => { if (!landRaster) return; for (const src of Object.values(c5)) src?.setLand((la, lo) => landRaster.isLand(la, lo)); setC5Land((n) => n + 1); }, [landRaster, c5]);
  const m24Idx = m24 && m24Visual && m24On[m24Visual] ? m24.meta.layers.findIndex((l) => l.id === m24Visual) : -1;
  const paintLL = useCallback((p: LatLon): [number, number, number] | null => {
    if (m24 && m24Idx >= 0) { const v = m24.visual(m24Idx, month, p, vmode); if (Number.isNaN(v)) return null; const r = m24.monthRange(m24Idx, month); return co2Color((v - r.min) / (r.max - r.min || 1)); }
    if (visual === 'co2' && co2) return co2.color(vmode === 'cells' ? co2.grid.nearest(p, month).ppm : co2.grid.bilinear(p, month), month);
    if (visual === 'temp' && temp) { const v = temp.layer.sample(tFrame, p, vmode); return Number.isNaN(v) ? null : colorFor(temp.cs, v); }
    if (visual === 'sst' && sst) { const v = sst.layer.sample(sstFrame, p, vmode); return Number.isNaN(v) ? null : colorFor(sst.cs, v); }
    if (visual === 'ndvi' && ndvi) { const v = ndvi.layer.sample(ndviFrame, p, vmode); return Number.isNaN(v) ? null : colorFor(ndvi.cs, v); }
    if (visual === 'lights' && lights) { const v = lights.layer.sample(lightsYear, p, vmode); if (Number.isNaN(v) || v < lights.max * 0.02) return null; const k = Math.min(1, v / lights.max); return [255 * Math.pow(k, 0.5), 225 * Math.pow(k, 0.7), 120 * k]; }
    if (visual === 'lightning' && lightning) { const v = lightning.value(p); if (v <= 0) return null; return [255, 230 + 25 * v, 90 + 160 * v]; }
    if ((C5_LAYERS as string[]).includes(visual)) { const src = c5[visual as C5Id]; if (!src) return null; const v = src.value(p); if (Number.isNaN(v)) return null; const t = gainFor(v, src.radarLayer('tr'), 'global'); if (visual === 'lis' && t <= 0) return null; return co2Color(t); }
    if (visual === 'aerosol' && aer) {
      let best = -1, bv = 0.04; aer.file.categories.forEach((c, i) => { const v = aer.layers[c.id].sample(0, p, vmode); if (v > bv) { bv = v; best = i; } });
      if (best < 0) return null;
      const rgb = aer.file.categories[best].rgb, k = Math.min(1, 0.35 + bv * 1.6);
      return [rgb[0] * k, rgb[1] * k, rgb[2] * k];
    }
    return null;
  }, [visual, c5, c5Land, co2, temp, sst, aer, ndvi, lights, lightning, ndviFrame, lightsYear, month, tFrame, sstFrame, m24, m24Idx, vmode]);
  // yalnız karada / yalnız denizde tanımlı katman → Natural Earth kara poligonlarıyla kırp (yumuşak görünümde; ham hücrelerde kırpma yok)
  const domain: 'land' | 'sea' | 'all' = m24 && m24Idx >= 0 ? (m24.meta.layers[m24Idx].domain ?? 'all') : visual === 'sst' || visual === 'currents' ? 'sea' : visual === 'ndvi' || visual === 'gedi' ? 'land' : 'all';
  const keep = !showCells && landRaster && domain !== 'all' ? (lat: number, lon: number) => landRaster.isLand(lat, lon) === (domain === 'land') : undefined;
  const paintVis = useCallback((p: LatLon) => (keep && !keep(p.lat, p.lon) ? null : paintLL(p)), [paintLL, keep]); // 2D harita ve radar görünümü için
  /** Görünen katmanın veri çözünürlüğü (dürüstlük etiketi). */
  const dataRes = (C5_LAYERS as string[]).includes(visual) && on[visual] ? { km: 550, cell: '5° × 5°' } : m24 && m24Idx >= 0 ? { km: 220, cell: m24.meta.grid.cell } : visual === 'co2' && on.co2 ? { km: 330, cell: '3° × 3.75°' } : (visual === 'temp' && on.temp) || (visual === 'sst' && on.sst) || (visual === 'aerosol' && on.aerosol) || (['ndvi', 'lights', 'lightning'] as LayerId[]).some((k) => visual === k && on[k]) ? { km: 110, cell: '1° × 1°' } : null;
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
    if (visual === 'ndvi' && ndvi) return { key: tk(`ndvi-${ndviFrame}`), el: cachedTex(tk(`ndvi-${ndviFrame}`)), opacity: op };
    if (visual === 'lights' && lights) return { key: tk(`lights-${lightsYear}`), el: cachedTex(tk(`lights-${lightsYear}`)), opacity: op };
    if (visual === 'lightning' && lightning) return { key: tk('lightning'), el: cachedTex(tk('lightning')), opacity: 0.9 };
    if ((C5_LAYERS as string[]).includes(visual) && c5[visual as C5Id]) return { key: tk(`c5-${visual}-${c5Land}`), el: cachedTex(tk(`c5-${visual}-${c5Land}`)), opacity: showCells ? 0.92 : 0.75 };
    if (visual === 'co2' && co2) return { key: tk(`co2-${month}`), el: cachedTex(tk(`co2-${month}`)), opacity: op };
    if (visual === 'temp' && temp) return { key: tk(`temp-${tFrame}`), el: cachedTex(tk(`temp-${tFrame}`)), opacity: op };
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view3d, visual, on.sst, on.aerosol, aerImg, co2 && month, temp && tFrame, video, paintKey]);

  // ---------- paneller
  const L = (id: LayerId) => LAYER_UI[id];
  const pills: Pill[] = [...EIC_LAYERS, ...RAW_LAYERS].map((id) => ({
    id, label: L(id).label[lang], instrument: id !== 'aerosol' && mix.inst[id] && mix.inst[id] !== id ? instrumentName(mix.inst[id], lang) + (id === 'sst' ? (lang === 'en' ? ' + waves' : ' + dalga sesi') : '') : L(id).instrument[lang], icon: L(id).icon, color: L(id).color, on: on[id], visual: visual === id && on[id],
    loading: on[id] && ((id === 'temp' && !temp) || (id === 'sst' && !sst) || (id === 'aerosol' && !aer) || (id === 'ndvi' && !ndvi) || (id === 'lights' && !lights) || (id === 'lightning' && !lightning)),
    note: id === 'co2' ? 'OCO-2 GEOS 2021' : id === 'temp' ? 'SVS 5147 · GEOS-FP' : id === 'sst' ? 'SVS 3912 · ECCO2 2007–08' : id === 'aerosol' ? 'SVS 5669 · GEOS 2025' : id === 'ndvi' ? 'SVS 5544 · göreli' : id === 'lights' ? 'SVS 5313 · 2012–2023' : 'SVS 5011 · ISS LIS 2017–23',
  }));
  const c5Pills: Pill[] = C5_LAYERS.map((id) => ({
    id, label: L(id).label[lang], instrument: L(id).instrument[lang], icon: L(id).icon, color: L(id).color, on: on[id], visual: visual === id && on[id], loading: on[id] && !c5[id],
    note: id === 'currents' ? 'OSCAR L4 V2.0 · ~550 km (5°)' : id === 'lis' ? 'LIS/OTD · ~550 km (5°)' : 'GEDI L3 V3 · ~550 km (5°)',
  }));
  const fmtShort = (l: RadarLayer, v: number) => (Number.isNaN(v) ? '—' : l.unit === '°C' ? `${Math.round(v)} °C` : l.unit === 'ppm' ? `${v.toFixed(1)} ppm` : l.fmt(v));
  const h = radar.headline;
  const headline = h ? { label: h.layer.label, center: fmtShort(h.layer, h.center), maxDir: h.maxDir, maxVal: fmtShort(h.layer, h.maxVal), when: h.layer.when } : null;
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
    { title: lang === 'tr' ? 'Sesler: buz çatırtısı' : 'Sounds: ice cracking', text: 'Gregor Quendel — "Ice Effects Sequences 15 (Breaking, Cracking)" (Freesound 422117) ve "Ice Cracking Sequence" (Freesound 424993), CC BY 4.0. İşlendi: mono, ses düzeyi eşitlendi, kırpıldı.', href: 'https://freesound.org/people/GregorQuendel/' },
    { title: lang === 'tr' ? 'Sesler: kayıtlar' : 'Sounds: recordings', text: lang === 'tr' ? 'Blackatom Productions — ses kayıtları (hangi dosyalar ve lisans: eklenecek).' : 'Blackatom Productions — sound recordings (files and license: to be added).' },
    { title: lang === 'tr' ? 'Sesler: diğer' : 'Sounds: other', text: lang === 'tr' ? 'Kamp ateşi, orman yangını, kum fırtınası, rüzgâr, dalga, orman, cırcır böceği, yağmur, fırtına, uzak gök gürültüsü, karda ayak sesi — kaynak ve lisans bilgisi eklenecek. Şehir trafiği, kalabalık ve ağustos böceği sesleri tarayıcıda sentezlenir (Web Audio).' : 'Campfire, wildfire, sandstorm, wind, waves, forest, crickets, rain, thunderstorm, distant thunder, footsteps in snow — source and license to be added. City traffic, crowd and cicadas are synthesized in the browser (Web Audio).' },
    { title: lang === 'tr' ? 'Sesler: harman katmanları (soundsv2)' : 'Sounds: blend layers (soundsv2)', text: lang === 'tr'
      ? 'Doğa kayıtlarının altına kısık, bulanıklaştırılmış doku olarak (melodi duyulmaz): Ed Pearson (wood_flutes) — "A touch of A", 2016 (Freesound 333996; ruzgar_hafif) · piermic — "Improvisation with sopranino recorder" (Freesound 324085; ruzgar_kuvvetli) · cvltiv8r — "Flute chamber, beautiful winds, deep reverb" (Freesound 814710; kis_ruzgari) · tomentum — "Emotional music for film and TV 110 BPM" (Freesound 872028; dalga_sakin) · phinster — "5:52 PM electric sax" (Freesound 757835; dalga_sert) · evanboyerman — "Emotional/sad/tragic string orchestral BGM" (Freesound 861539; volkan, fırtına kaydının bas gürlemesiyle). Lisanslar: doğrulanacak (her dosyanın Freesound sayfası).'
      : 'Blurred, quiet texture under the nature recordings (no melody audible): Ed Pearson (wood_flutes) — "A touch of A", 2016 (Freesound 333996; light wind) · piermic — "Improvisation with sopranino recorder" (Freesound 324085; strong wind) · cvltiv8r — "Flute chamber, beautiful winds, deep reverb" (Freesound 814710; winter wind) · tomentum — "Emotional music for film and TV 110 BPM" (Freesound 872028; calm waves) · phinster — "5:52 PM electric sax" (Freesound 757835; rough waves) · evanboyerman — "Emotional/sad/tragic string orchestral BGM" (Freesound 861539; volcano, with the low rumble of the thunderstorm recording). Licenses: to be verified (Freesound page of each file).' },
    { title: lang === 'tr' ? 'Kara poligonları (görsel kırpma)' : 'Land polygons (visual clipping)', text: lang === 'tr' ? 'Natural Earth 1:50m Land, kamu malı — yalnız karada / yalnız denizde tanımlı katmanların görüntüsünü kıyıdan kırpmak için; ses gerçek veri hücrelerini kullanır.' : 'Natural Earth 1:50m Land, public domain — only to clip land-only / sea-only layers at the coast in the display; sound uses the real data cells.', href: 'https://www.naturalearthdata.com/' },
    { title: lang === 'tr' ? 'Kıyı çizgileri (3B küre)' : 'Coastlines (3D globe)', text: lang === 'tr' ? 'Natural Earth 1:50m Coastline, kamu malı (naturalearthdata.com). Yalnız altlık; veri katmanlarının çözünürlüğü değişmez.' : 'Natural Earth 1:50m Coastline, public domain (naturalearthdata.com). Base map only; data layer resolution is unchanged.', href: 'https://www.naturalearthdata.com/' },
  ];

  const guidePanel = <Guide lang={lang} micSupported={listener.supported} listening={listening} status={guideStatus} history={cmdHistory} onTalk={() => talk()}
    onCommand={(t) => execCommand([t], 'text')} narrator={narrator} setNarrator={setNarrator} inputRef={guideInput}
    handsFree={hfLive} handsFreeWanted={hfWanted} setHandsFreeWanted={setHfWanted} open={guideOpen} setOpen={setGuideOpen} />;

  // ---------- yeni düzen: alt çalar çubuğu verileri
  const moodNow = radar.P && radar.computed.length ? moodOf({ P: radar.P, mode, layers: radar.computed }) : null;
  // merkezde EN BASKIN ses dünyası (aerosolde toz / duman / tuz / sülfat arasında en güçlüsü; yalnız ilk alt katman değil)
  const centerBest = (() => {
    if (!active) return null;
    let best: { l: RadarLayer; v: number; t: number; w: World } | null = null;
    for (const l of layers) { const w = WORLD_OF[l.id]; if (!w) continue; const v = l.sample(active); if (Number.isNaN(v)) continue; const t = gainFor(v, l, 'global'); if (!best || t > best.t) best = { l, v, t, w }; }
    return best;
  })();
  const centerDesc = centerBest ? describeWorld(centerBest.w, centerBest.v, centerBest.t, lang) : '';
  const placeShort = active ? placeLabel(active).split(',')[0] : '';
  const moodWord = moodNow && moodNow.energy > 0 ? (moodNow.minor ? (lang === 'en' ? 'tense' : 'gergin') : (lang === 'en' ? 'calm' : 'sakin')) : '';
  const playerSummary = active ? [placeShort, centerDesc, moodWord].filter(Boolean).join(' · ') : (lang === 'en' ? 'Search for a place above, tap the globe or say "Earth, go to Sivas".' : 'Yukarıdan bir yer ara, Dünya\'ya dokun ya da "Dünya, Sivas\'a git" de.');
  /** Görünen katmanın zamanı (alt çubuktaki önceki/sonraki ve ince zaman çubuğu). */
  const timeCtl: { i: number; n: number; label: (i: number) => string; set: (i: number) => void } | null =
    visual === 'temp' && on.temp && temp ? { i: tFrame, n: temp.frames, label: (i) => temp.dateLabel(i, lang), set: setTFrame }
      : visual === 'sst' && on.sst && sst ? { i: sstFrame, n: sst.frames, label: (i) => sst.dateLabel(i, lang), set: (f) => { setSstFrame(f); try { video.currentTime = f / sst.file.frames.fps; } catch { /* video hazır değil */ } } }
        : visual === 'ndvi' && on.ndvi && ndvi ? { i: ndviFrame, n: ndvi.frames, label: (i) => ndvi.dateLabel(i, lang), set: setNdviFrame }
          : visual === 'lights' && on.lights && lights ? { i: lightsYear, n: lights.years.length, label: (i) => String(lights.years[i]), set: setLightsYear }
            : on.co2 && co2 ? { i: month, n: 12, label: (i) => co2.monthLabel(i, lang), set: setMonth } : null;
  const stepTime = (d: number) => { if (!timeCtl) return; const i = Math.max(0, Math.min(timeCtl.n - 1, timeCtl.i + d)); timeCtl.set(i); announce(timeCtl.label(i)); };
  const WORLD_OF_LAYER: Partial<Record<LayerId, World>> = { temp: 'heat', sst: 'ocean', aerosol: 'dust', ndvi: 'forest', lights: 'city', lightning: 'thunder', currents: 'current', lis: 'thunder', gedi: 'forest' };
  const layerInfo = (id: string) => {
    if ((C5_LAYERS as string[]).includes(id)) { // kanıt kartı: koleksiyon, değişken, dönem, birim, çözünürlük, not
      const src = c5[id as C5Id], k = src?.f.kanit, rl = src?.radarLayer(lang);
      return <>{k ? <><b>{k.koleksiyon}</b> — {k.degisken}. {lang === 'en' ? 'Period' : 'Dönem'}: {k.donem}. {lang === 'en' ? 'Unit' : 'Birim'}: {k.birim} ({k.toplama}). {lang === 'en' ? 'Range' : 'Aralık'}: {rl ? `${src!.fmt(rl.min, lang === 'en')} … ${src!.fmt(rl.max, lang === 'en')}` : ''}{rl?.log ? (lang === 'en' ? ', log scale' : ', log ölçek') : ''}. <b>{lang === 'en' ? 'Resolution ~550 km (5°)' : 'Çözünürlük ~550 km (5°)'}</b>. {src!.f.note[lang]} {lang === 'en' ? 'Source package' : 'Kaynak paket'}: {k.kaynak_paket}. </> : (lang === 'en' ? 'Turn the layer on to load its details. ' : 'Ayrıntılar katman açılınca yüklenir. ')}{legendLine(WORLD_OF_LAYER[id as LayerId]!, lang)}</>;
    }
    const pill = pills.find((x) => x.id === id), w = WORLD_OF_LAYER[id as LayerId];
    const extra = id === 'lightning' ? (lang === 'tr' ? ' ISS LIS 2017–2023 toplamı (kareler tarihsiz).' : ' ISS LIS 2017–2023 total (frames undated).') : id === 'aerosol' ? (lang === 'tr' ? ' 19 Ağu 2025 20:00 UTC; yoğunluk göreli. Toz = kum fırtınası, kara karbon = yangın, deniz tuzu = serpinti, sülfat = volkan uğultusu.' : ' 19 Aug 2025 20:00 UTC; relative density. Dust = sandstorm, black carbon = fire, sea salt = spray, sulfate = volcanic rumble.') : '';
    return <>{pill?.note && <b>{pill.note}. </b>}{w ? legendLine(w, lang) : ''}{extra}</>;
  };
  const wxShown = wxTarget ?? (place ? { ...place, name: placeLabel(place).split(',')[0] } : null);
  const listenTab = (
    <>
      <WorldThemes lang={lang} active={worldTheme} onPick={applyWorldTheme} />
      <h3 className="sec-title">{lang === 'en' ? 'Sound worlds — from NASA EIC visualizations' : 'Ses dünyaları — NASA EIC görsellerinden'}</h3>
      <LayerCards lang={lang} pills={pills} onToggle={(id) => toggleLayer(id as LayerId)} onShow={(id) => { setM24Visual(null); setVisual(id as LayerId); }} info={layerInfo} />
      <h3 className="sec-title">{lang === 'en' ? 'Separate layers — NASA data, 5° (~550 km)' : 'Ayrı katmanlar — NASA verisi, 5° (~550 km)'}</h3>
      <LayerCards lang={lang} pills={c5Pills} onToggle={(id) => toggleLayer(id as LayerId)} onShow={(id) => { setM24Visual(null); setVisual(id as LayerId); }} info={layerInfo} />
      <button type="button" className="btn scan-btn" onClick={() => setScanOpen(true)}>{lang === 'tr' ? '🌳 Orman yüksekliğini dinle (GEDI küre görseli)' : '🌳 Listen to forest height (GEDI globe visual)'}</button>
      <details className="adv">
        <summary>{lang === 'en' ? 'Advanced' : 'Gelişmiş'}</summary>
        <fieldset className="fs"><legend>{tr(lang, 'range')}</legend>
          <div className="seg">{[500, 2000, 5000].map((km) => <label key={km} className={km === rangeKm ? 'on' : ''}><input type="radio" name="range" value={km} checked={km === rangeKm} onChange={() => { setRange(km); announce(lang === 'en' ? `Range ${km} kilometers.` : `Menzil ${km} kilometre.`); }} />{formatKm(km)}</label>)}</div>
        </fieldset>
        <fieldset className="fs"><legend>{lang === 'en' ? 'Note scale' : 'Nota ölçeği'}</legend>
          <div className="seg">{(['local', 'global'] as Scale[]).map((s) => <label key={s} className={s === scale ? 'on' : ''}><input type="radio" name="scale" value={s} checked={s === scale} onChange={() => setScale(s)} />{s === 'local' ? (lang === 'en' ? 'Local' : 'Yerel') : (lang === 'en' ? 'Global' : 'Küresel')}</label>)}</div>
          {radar.scaleInfo.length > 0 && <p className="small muted">{radar.scaleInfo.join(' · ')}</p>}
        </fieldset>
        <label className="lbl-inline">{tr(lang, 'speed')} <select value={radar.revSec} onChange={(e) => radar.setRevSec(+e.target.value)}><option value={12}>12 s</option><option value={8}>8 s</option><option value={5}>5 s</option></select></label>
        <label className="switch set-row"><input type="checkbox" checked={showCells} onChange={(e) => setShowCells(e.target.checked)} /> <span>{lang === 'en' ? 'Show data cells' : 'Veri hücrelerini göster'}</span></label>
        {on.temp && temp && <div className="sub-time"><label htmlFor="t-date" className="small">{lang === 'tr' ? 'Sıcaklık tarihi' : 'Temperature date'}</label><select id="t-date" value={tFrame} onChange={(e) => { const f = +e.target.value; setTFrame(f); announce(temp.dateLabel(f, lang)); }}>{Array.from({ length: temp.frames }, (_, f) => <option key={f} value={f}>{temp.dateLabel(f, lang)}</option>)}</select></div>}
        {on.sst && sst && <div className="sub-time"><label htmlFor="s-date" className="small">{lang === 'tr' ? 'Okyanus tarihi (ECCO2 modeli)' : 'Ocean date (ECCO2 model)'}</label><select id="s-date" value={sstFrame} onChange={(e) => { const f = +e.target.value; setSstFrame(f); try { video.currentTime = f / sst.file.frames.fps; } catch { /* video hazır değil */ } announce(sst.dateLabel(f, lang)); }}>{Array.from({ length: sst.frames }, (_, f) => <option key={f} value={f}>{`${sst.dateLabel(f, lang)} · ${f + 1}/${sst.frames}`}</option>)}</select></div>}
        {on.ndvi && ndvi && <div className="sub-time"><label htmlFor="n-frame" className="small">{lang === 'tr' ? 'NDVI karesi' : 'NDVI frame'}: {ndvi.dateLabel(ndviFrame, lang)}</label><input id="n-frame" type="range" min={0} max={ndvi.frames - 1} value={ndviFrame} aria-valuetext={ndvi.dateLabel(ndviFrame, lang)} onChange={(e) => setNdviFrame(+e.target.value)} /></div>}
        {on.lights && lights && <div className="sub-time"><label htmlFor="l-year" className="small">{lang === 'tr' ? 'Gece ışıkları yılı' : 'Night lights year'}: {lights.years[lightsYear]}</label><input id="l-year" type="range" min={0} max={lights.years.length - 1} value={lightsYear} aria-valuetext={String(lights.years[lightsYear])} onChange={(e) => { setLightsYear(+e.target.value); announce(String(lights.years[+e.target.value])); }} /></div>}
        {on.co2 && <label className="switch set-row"><input type="checkbox" checked={advance} onChange={(e) => setAdvance(e.target.checked)} /> <span>{tr(lang, 'advance')}</span></label>}
      </details>
    </>
  );
  const exploreTab = place ? (
    <Explore lang={lang} placeA={placeLabel(place)} placeB={placeB ? placeLabel(placeB) : null} compare={compare}
      setCompare={(v) => { setCompare(v); setCmpTurn(0); announce(v ? (lang === 'en' ? 'Listening in turns: one sweep for A, one sweep for B. Time stays fixed.' : 'Sırayla dinleme açık: bir tur A, bir tur B. Zaman sabit kalır.') : (lang === 'en' ? 'Listening in turns off.' : 'Sırayla dinleme kapalı.')); }}
      onPickB={() => { setPickFor('B'); setPickOpen(true); }} onClearB={() => { setPlaceB(null); setCompare(false); setCmpTurn(0); }} onDiff={sayDiff}
      onStories={() => setStoriesOpen(true)} onEvents={openEvents} onSound={() => setSoundOpen(true)}
      narrator={narrator} setNarrator={setNarrator} story={story} onStopStory={stopStory} showNarrator={false} onTour={() => tourApi.current.start()} />
  ) : (
    <div className="explore">
      <button type="button" className="btn primary tour-btn" onClick={() => tourApi.current.start()}>{lang === 'en' ? '🎧 Guided tour (30 s)' : '🎧 Rehberli tur (30 sn)'}</button>
      <p className="small">{lang === 'en' ? 'Or choose a place first: search above or tap the globe.' : 'Ya da önce bir yer seç: yukarıdan ara ya da Dünya\'ya dokun.'}</p>
    </div>
  );
  const weatherTab = <Weather inline open={false} music={soundMode !== 'nature'} nature={soundMode !== 'music'} onClose={() => {}} lang={lang} forecast={wx} error={wxErr} target={wxShown} announce={announce} />;
  useEffect(() => { if (panelTab === 'weather') void loadWx().catch(() => {}); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [panelTab]);

  return (
    <div className={`app${view3d ? ' is3d' : ' is2d'}${panelOpen ? ' panel-open' : ''}`}>
      {!gateDone && <StartGate lang={lang} leaving={started} reduced={reduced} earthUrl={`${BASE}media/bluemarble_2048.jpg`} onStart={welcome} onDone={() => setGateDone(true)} />}

      <AppHeader lang={lang} listening={listening} micSupported={listener.supported} onTalk={() => talk()} onHoldStart={() => talk(true)} onHoldEnd={() => listener.finish()}
        guide={guide} onGuide={() => setGuide(!guideRef.current)}
        search={<PlacePicker compact cities={cities} place={place} onPick={(p) => setPlace(p)} announce={announce} lang={lang} />}
        onWeather={() => openWeather(place ? { ...place, name: placeLabel(place).split(',')[0] } : null)} onSettings={() => setSettingsOpen(true)} onAbout={() => setAboutOpen(true)} onHelp={() => setHelpOpen(true)} />

      <main className="stage" aria-label={lang === 'en' ? 'Earth' : 'Dünya'}>
        {view3d && (
          <Globe3D source={globeSource} landCanvas={landCanvas} baseUrl={`${BASE}media/bluemarble_${isTouchDevice ? 2048 : 4096}.jpg`} center={active} rangeKm={rangeKm} angle={radar.angle} level={() => engine.level()}
            reducedMotion={reduced} onPick={(p) => pickPoint(p, 'harita')} onHover={onHover}
            onSlow={() => { if (forced !== '3d') { setView3dS(false); setSlowNote(true); } }} />
        )}
        {!audioOk && <p role="alert" className="glass alert">{lang === 'tr' ? 'Ses başlatılamadı. Sessiz modu kapat, sesi aç ve bir düğmeye tekrar dokun.' : 'Audio could not start. Turn off silent mode, raise the volume and tap a button again.'}</p>}
        {err && <p role="alert" className="glass alert">{err}</p>}
        {slowNote && <p role="status" className="glass note">{tr(lang, 'fallback')}</p>}
        {!place && <Intro lang={lang} onPick={() => { setPickFor('A'); setPickOpen(true); }} onTalk={listener.supported ? () => talk() : undefined} />}
        {place && dataRes && (
          <div className="data-res" role="group" aria-label={lang === 'en' ? 'Data resolution' : 'Veri çözünürlüğü'}>
            <span title={showCells ? '' : lang === 'en' ? 'smoothed for display; sound uses the real cells' : 'görüntüde yumuşatıldı; ses gerçek hücreleri kullanır'}>{lang === 'en' ? 'Data' : 'Veri'} ~{dataRes.km} km ({dataRes.cell})</span>
            <label className="switch small"><input type="checkbox" checked={showCells} onChange={(e) => setShowCells(e.target.checked)} /> <span>{lang === 'en' ? 'cells' : 'hücreler'}</span></label>
          </div>
        )}
        {(listening || heard) && <p role="status" className="glass note heard">{listening ? tr(lang, 'listening') : `“${heard}”`}</p>}
        {!view3d && (
          <section className={`flat${place ? '' : ' empty'}`} aria-label={lang === 'tr' ? '2D harita ve radar' : '2D map and radar'}>
            {active && <div className="flat-radar"><RadarView center={active} rangeKm={rangeKm} paint={paintVis} paintKey={paintKey} angle={radar.angle} land={land} /></div>}
            <div className="flat-map"><WorldMap paint={paintVis} paintKey={paintKey} land={land} center={active} rangeKm={rangeKm} onPick={(p) => pickPoint(p, 'harita')} onHover={onHover} /></div>
          </section>
        )}
        {radar.legend && <p className="legend-caption glass" aria-hidden="true">{radar.legend}</p>}
        {tour && (
          <div className="tour-cap glass">
            <span className="tour-prog" aria-hidden="true">{tour.i > 0 ? `${tour.i}/${tour.n}` : '…'}</span>
            <p className="tour-text" aria-hidden="true">{tour.text}</p>
            <button type="button" className="btn sm" onClick={() => tourApi.current.end('cancel')}>{lang === 'en' ? 'End tour (any key)' : 'Turu bitir (herhangi bir tuş)'}</button>
          </div>
        )}
        {tourAsk && !tour && (
          <div className="tour-ask glass" role="dialog" aria-modal="false" aria-labelledby="tour-ask-h" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); tourApi.current.answer(false); } }}>
            <h2 id="tour-ask-h">{lang === 'en' ? 'Shall I let you listen to the Earth?' : 'Sana Dünya\'yı dinleteyim mi?'}</h2>
            <p className="small">{lang === 'en' ? '30 seconds, 4 places: Sahara, Amazon, Central Africa, North Atlantic.' : '30 saniye, 4 yer: Sahra, Amazon, Orta Afrika, Kuzey Atlantik.'}</p>
            <div className="btn-row">
              <button type="button" className="btn primary" onClick={() => tourApi.current.answer(true)}>{lang === 'en' ? 'Start tour' : 'Turu başlat'}</button>
              <button type="button" className="btn" onClick={() => tourApi.current.answer(false)}>{lang === 'en' ? 'Skip' : 'Geç'}</button>
            </div>
          </div>
        )}
      </main>

      <PlayerBar lang={lang} place={active ? (compare && placeB ? (active === placeB ? 'B · ' : 'A · ') : '') + placeLabel(active) : null}
        value={centerBest ? fmtShort(centerBest.l, centerBest.v) : headline ? `${headline.center}` : null} summary={playerSummary} nowLine={radar.nowLines[0] ?? ''} liveLine={radar.liveLine}
        playing={radar.playing} canPlay={!!place} onToggle={radar.toggle} onPrev={timeCtl && timeCtl.i > 0 ? () => stepTime(-1) : null} onNext={timeCtl && timeCtl.i < timeCtl.n - 1 ? () => stepTime(1) : null}
        timeLabel={timeCtl ? timeCtl.label(timeCtl.i) : null} timePos={timeCtl ? { i: timeCtl.i, n: timeCtl.n, set: (i) => timeCtl.set(i) } : null}
        onLegend={radar.runLegend} onSummary={radar.summary} talking={radar.talking} onChangePlace={() => { setPickFor('A'); setPickOpen(true); }}
        soundMode={soundMode} setSoundMode={setSoundMode} volume={mix.master} setVolume={(v) => setMix({ ...mix, master: v })} onPanel={() => setPanelOpen(!panelOpen)} />

      <SidePanel lang={lang} tab={panelTab} setTab={setPanelTab} open={panelOpen} setOpen={setPanelOpen}
        tabs={{ listen: listenTab, weather: weatherTab, explore: exploreTab, guide: guidePanel }} />

      <Dialog open={pickOpen} onClose={() => setPickOpen(false)} title={pickFor === 'B' ? (lang === 'en' ? 'Choose the second place' : 'İkinci yeri seç') : pickFor === 'H' ? (lang === 'en' ? 'Choose your home' : 'Ev konumunu seç') : tr(lang, 'searchTitle')} lang={lang}>
        <PlacePicker cities={cities} place={pickFor === 'B' ? placeB : place} onPick={(p) => { if (pickFor === 'H') { saveHome(p); setPickOpen(false); announce(lang === 'en' ? `${nm(p)} saved as your home.` : `${nm(p)} eviniz olarak kaydedildi.`); return; } if (pickFor === 'B') { setPlaceB(p); setCompare(true); setCmpTurn(0); announce(lang === 'en' ? `Second place: ${placeLabel(p)}. The radar now plays one sweep here and one sweep there. Press Space to listen.` : `İkinci yer: ${placeLabel(p)}. Radar artık bir tur birinci yeri, bir tur ikinci yeri çalar. Dinlemek için Boşluk.`); } else setPlace(p); setPickOpen(false); }} announce={announce} autoFocus lang={lang} />
        <p className="small muted">{tr(lang, 'orTap')}</p>
      </Dialog>
      <StoriesDialog open={storiesOpen} onClose={() => setStoriesOpen(false)} lang={lang} stories={storyList} hasPlace={!!place} onRun={(id) => { setStoriesOpen(false); void runStory(id); }} />
      <EventsDialog open={eventsOpen} onClose={() => setEventsOpen(false)} lang={lang} status={events.status} events={nearEvents}
        onGo={(e) => { setEventsOpen(false); pickPoint({ lat: e.lat, lon: e.lon }, 'harita'); }} />
      <SoundDialog open={soundOpen} onClose={() => setSoundOpen(false)} lang={lang} mix={mix} setMix={setMix}
        layerNames={{ co2: LAYER_UI.co2.label[lang], temp: LAYER_UI.temp.label[lang], sst: LAYER_UI.sst.label[lang], aerosol: LAYER_UI.aerosol.label[lang] }}
        onTest={(id) => { engine.unlock(); const ids = id === 'aerosol' ? ['black_carbon', 'dust', 'sea_salt', 'sulfate'] : [id]; ids.forEach((t, i) => [0.2, 0.5, 0.8].forEach((v, j) => engine.voice(t, noteHz(v, PARTS[t as keyof typeof PARTS]), engine.now + 0.05 + i * 1.1 + j * 0.3, 0.5, 0.8, 0))); }} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} lang={lang} setLang={setLang} hc={hc} setHc={setHc} view3d={view3d} can3d={can3d} setView3d={setView3d}
        guide={guide} setGuide={setGuide} handsFree={hfWanted} setHandsFree={setHfWanted} micSupported={listener.supported} shortcuts={shortcutsOn} setShortcuts={setShortcuts}
        music={mix.music} setMusic={(v) => setMix({ ...mix, music: v })} onSoundscape={() => { setSettingsOpen(false); setSoundOpen(true); }}
        rate={mix.rate} setRate={(v) => setMix({ ...mix, rate: v })}
        home={home ? nm(home) : null} onHomeChange={() => { setSettingsOpen(false); setPickFor('H'); setPickOpen(true); }}
        onHomeDelete={() => { saveHome(null); announce(lang === 'en' ? 'Home location deleted.' : 'Ev konumu silindi.'); }} />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} lang={lang} onSpeak={() => { if (guideRef.current) void speech.say(helpText()); else announce(helpText()); }} />
      <About open={aboutOpen} onClose={() => setAboutOpen(false)} lang={lang} credits={credits} extra={<DataInventory lang={lang} />} />
      <ImageScan open={scanOpen} onClose={() => setScanOpen(false)} lang={lang} announce={announce} />

      <div className="sr" aria-live="polite" aria-atomic="true">{live}</div>
    </div>
  );
}
