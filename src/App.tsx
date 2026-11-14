import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { engine } from './audio/engine.ts';
import { speech } from './audio/speech.ts';
import { IconBars, IconBreath, IconStrings, IconWave } from './components/icons.tsx';
import { DEFAULT_MIX, EventsDialog, Explore, instrumentName, SoundDialog, StoriesDialog, type EarthEvent, type Mix, type StoryInfo } from './components/Extras.tsx';
import { PlacePicker } from './components/PlacePicker.tsx';
import { RadarView } from './components/RadarView.tsx';
import { About, Dialog, Intro, LayerPills, NowCard, Timeline, TopBar, type Pill } from './components/Shell.tsx';
import { WorldMap } from './components/WorldMap.tsx';
import { useRadar } from './hooks/useRadar.ts';
import { tr, type Lang } from './i18n.ts';
import { bearing as bearingTo, compass8, destination, formatKm, formatLatLon, haversineKm, type LatLon } from './lib/geo.ts';
import { monthName } from './lib/co2.ts';
import { colorFor } from './lib/grid.ts';
import { LandMask, type LandFile } from './lib/land.ts';
import { loadAerosols, loadCo2, loadJson, loadSst, loadTemperature, type AerosolSource, type Co2Source, type SstSource, type TemperatureSource } from './lib/layers.ts';
import { Cities, countryName, placeLabel, rowToPlace, type CitiesFile, type Place } from './lib/places.ts';
import { noteHz, PARTS, type Mode, type RadarLayer } from './lib/radar.ts';
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
  const setLang = (l: Lang) => { setLangS(l); store.set('lang', l); speech.setLang(l); if (guideRef.current) void speech.say(l === 'en' ? 'Language: English.' : 'Dil: Türkçe.'); };
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

  // ---------- durum
  const [place, setPlace] = useState<Place | null>(null);
  const [rangeKm, setRange] = useState(2000);
  const [mode, setMode] = useState<Mode>('hikaye'); // müzikal mod varsayılan: notalar seçilen yerin çevresindeki farkı tüm aralığa yayar
  const [month, setMonth] = useState(0);
  const [advance, setAdvance] = useState(true);
  const [tFrame, setTFrame] = useState(0);
  const [sstFrame, setSstFrame] = useState(0);
  const [on, setOn] = useState<Record<LayerId, boolean>>({ co2: true, temp: false, sst: false, aerosol: false });
  const [visual, setVisual] = useState<LayerId>('co2');
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
  const announce = useCallback((t: string) => {
    if (guideRef.current && speech.supported) { void speech.say(t); return; }
    setLive(''); requestAnimationFrame(() => setLive(t));
  }, []);
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
    return L;
  }, [on, co2, temp, sst, aer, month, tFrame, sstFrame, lang, mix.inst]);

  const advanceRef = useRef(advance); advanceRef.current = advance;
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
    placeName: active ? placeLabel(active) : '', center: active, layers, rangeKm, mode, lang, announce,
    onRevolution: () => {
      if (live2.current.compare) { setCmpTurn((t) => t + 1); return; }          // karşılaştırmada zaman sabit kalır, yer değişir
      if (advanceRef.current && on.co2 && !live2.current.story) setMonth((m) => (m + 1) % 12);
      narrate();
    },
  });
  const radarRef = useRef(radar); radarRef.current = radar;

  const toggleLayer = (id: LayerId) => {
    const v = !on[id];
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
      ? `${name} selected. Carbon dioxide at the center: ${ppm} ppm, ${co2.monthLabel(month, 'en')}. Press Space to play the radar. Press L for the audio legend, H for help.`
      : `${name} seçildi. Merkezde karbondioksit ${ppm} ppm, ${co2.monthLabel(month)}. Radarı çalmak için Boşluk tuşuna bas. Sesli lejant için L, yardım için H.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, co2]);

  // ---------- sesli rehber: karşılama, yardım, düğme adlarını okuma, kısayollar
  const helpText = useCallback(() => (langRef.current === 'en'
    ? 'EarthEar help. Press C to choose a place: type a city name, pick with the down arrow, confirm with Enter. Space plays or stops the radar. Each data layer is an instrument: keys 1 to 4 turn layers on and off. 1 carbon dioxide, violin. 2 surface temperature, guitar. 3 ocean temperature, harp and waves. 4 aerosols. While the music plays, travel across the Earth with I for north, K for south, J for west and M for east. Left and right arrows turn the beam by hand. B compares with a second place, Y opens Earth stories, E lists natural events near you, V opens your soundscape settings, N turns the narrator on. Dates are chosen in the layers panel and the date bar. S reads a summary, L plays the audio legend, Escape silences speech, G turns this voice guide off if you use a screen reader. H repeats this help.'
    : 'EarthEar yardım. Yer seçmek için C tuşuna bas: şehir adını yaz, aşağı okla seç, Enter ile onayla. Boşluk radarı çalar ya da durdurur. Her veri katmanı bir enstrümandır: 1 ile 4 arası tuşlar katmanları açıp kapatır. 1 karbondioksit, keman. 2 yüzey sıcaklığı, gitar. 3 okyanus sıcaklığı, arp ve dalga sesi. 4 aerosoller. Müzik çalarken Dünya üzerinde gezmek için I kuzey, K güney, J batı, M doğu tuşlarını kullan. Sol ve sağ ok ışını elle çevirir. B ikinci bir yerle karşılaştırır, Y Dünya hikâyelerini açar, E yakındaki doğa olaylarını listeler, V ses sahneni açar, N anlatıcıyı açar. Tarihler katmanlar panelinden ve tarih çubuğundan seçilir. S özeti okur, L sesli lejantı çalar, Escape konuşmayı susturur. Ekran okuyucu kullanıyorsan G tuşu bu sesli rehberi kapatır. H bu yardımı tekrarlar.'), []);
  const welcomed = useRef(false);
  const welcome = useCallback(() => {
    if (welcomed.current) return; welcomed.current = true;
    if (!guideRef.current) return;
    void speech.say(langRef.current === 'en'
      ? 'Welcome to EarthEar. Here you listen to NASA Earth data as music. To begin, press C and type a city name. Press H for help at any time. If you use a screen reader, press G to turn this voice guide off.'
      : 'EarthEar\'a hoş geldin. Burada NASA\'nın Dünya verilerini müzik olarak dinlersin. Başlamak için C tuşuna bas ve bir şehir adı yaz. Yardım için istediğin zaman H tuşuna bas. Ekran okuyucu kullanıyorsan G tuşu bu sesli rehberi kapatır.');
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

  // genel kısayollar: C yer seç · H yardım · G sesli rehber · Esc sustur · 1-4 katman · I/J/K/M gez
  const globalKeys = useRef<(e: KeyboardEvent) => void>(() => {});
  globalKeys.current = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') { radar.hush(); stopStory(); return; }
    const el = e.target instanceof HTMLElement ? e.target : null;
    const tag = (el?.tagName ?? '').toLowerCase();
    const type = (el as HTMLInputElement | null)?.type ?? '';
    const typing = tag === 'textarea' || tag === 'select' || (tag === 'input' && !['range', 'checkbox', 'radio', 'button'].includes(type)) || !!el?.isContentEditable;
    if (typing || el?.closest('[role="dialog"]')) return;
    const k = e.key.toLowerCase();
    if (k === 'c') { e.preventDefault(); setPickFor('A'); setPickOpen(true); }
    else if (k === 'h') { e.preventDefault(); welcomed.current = true; radar.hush(); if (guideRef.current) void speech.say(helpText()); else announce(helpText()); }
    else if (k === 'g') { e.preventDefault(); setGuide(!guideRef.current); }
    else if (k === 'b' && place) { e.preventDefault(); setPickFor('B'); setPickOpen(true); }
    else if (k === 'y') { e.preventDefault(); setStoriesOpen(true); }
    else if (k === 'e' && place) { e.preventDefault(); openEvents(); }
    else if (k === 'v') { e.preventDefault(); setSoundOpen(true); }
    else if (k === 'n') { e.preventDefault(); setNarrator(!live2.current.narrator); }
    else if (['1', '2', '3', '4'].includes(k)) { e.preventDefault(); toggleLayer((['co2', 'temp', 'sst', 'aerosol'] as LayerId[])[+k - 1]); }
    else if (place && ['i', 'j', 'k', 'm'].includes(k)) {
      e.preventDefault();
      const bearing = k === 'i' ? 0 : k === 'm' ? 90 : k === 'k' ? 180 : 270;
      pickPoint(destination(place, bearing, rangeKm / 8), 'harita');
    } else if (!welcomed.current && !['enter', ' ', 'tab', 'shift'].includes(k)) welcome();
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => globalKeys.current(e);
    const first = (e: Event) => { if (!(e.target instanceof Element && e.target.closest('button, a, input, select, canvas, [role="dialog"]'))) welcome(); };
    const tab = (e: KeyboardEvent) => { if (e.key === 'Tab') welcome(); };
    document.addEventListener('keydown', key); document.addEventListener('pointerdown', first); document.addEventListener('keyup', tab);
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('pointerdown', first); document.removeEventListener('keyup', tab); };
  }, [welcome]);

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
  // boyanmış dokular saklanır: aynı ay/kare ikinci kez istenince yeniden hesaplanmaz (akıcı geçiş)
  const texCache = useRef(new Map<string, HTMLCanvasElement>());
  const cachedTex = (key: string) => {
    const m = texCache.current; let c = m.get(key);
    if (!c) { c = paintEquirect(paintLL); m.set(key, c); if (m.size > 48) m.delete(m.keys().next().value as string); }
    return c;
  };
  const globeSource: GlobeSource | null = useMemo(() => {
    if (!view3d) return null;
    if (visual === 'sst' && on.sst) return { key: 'sst-video', el: video };
    if (visual === 'aerosol' && on.aerosol) return aerImg ? { key: 'aer-img', el: aerImg } : null;
    if (visual === 'co2' && co2) return { key: `co2-${month}`, el: cachedTex(`co2-${month}`) };
    if (visual === 'temp' && temp) return { key: `temp-${tFrame}`, el: cachedTex(`temp-${tFrame}`) };
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
    { title: lang === 'tr' ? 'Şehirler' : 'Cities', text: 'GeoNames (geonames.org), CC BY 4.0' },
  ];

  return (
    <div className={`app${view3d ? ' is3d' : ' is2d'}`}>
      {view3d && (
        <Globe3D source={globeSource} landCanvas={landCanvas} center={active} rangeKm={rangeKm} angle={radar.angle} level={() => engine.level()}
          reducedMotion={reduced} onPick={(p) => pickPoint(p, 'harita')}
          onSlow={() => { if (forced !== '3d') { setView3dS(false); setSlowNote(true); } }} />
      )}

      <TopBar lang={lang} setLang={setLang} hc={hc} setHc={setHc} view3d={view3d} can3d={can3d} setView3d={setView3d} onPick={() => { setPickFor('A'); setPickOpen(true); }} onAbout={() => setAboutOpen(true)} hasPlace={!!place} guide={guide} setGuide={setGuide} />

      <main className="stage">
        {!audioOk && <p role="alert" className="glass alert">{lang === 'tr' ? 'Ses başlatılamadı. Sessiz modu kapat, sesi aç ve bir düğmeye tekrar dokun.' : 'Audio could not start. Turn off silent mode, raise the volume and tap a button again.'}</p>}
        {err && <p role="alert" className="glass alert">{err}</p>}
        {slowNote && <p role="status" className="glass note">{tr(lang, 'fallback')}</p>}

        {!place && <Intro lang={lang} onPick={() => { setPickFor('A'); setPickOpen(true); }} />}

        {!view3d && (
          <section className={`flat${place ? '' : ' empty'}`} aria-label={lang === 'tr' ? '2D harita ve radar' : '2D map and radar'}>
            {active && <div className="flat-radar"><RadarView center={active} rangeKm={rangeKm} paint={paintLL} paintKey={paintKey} angle={radar.angle} land={land} /></div>}
            <div className="flat-map"><WorldMap paint={paintLL} paintKey={paintKey} land={land} center={active} rangeKm={rangeKm} onPick={(p) => pickPoint(p, 'harita')} /></div>
          </section>
        )}

        {place && (
          <>
            <NowCard lang={lang} placeLabel={(compare && placeB ? (active === placeB ? 'B · ' : 'A · ') : '') + placeLabel(active ?? place)} playing={radar.playing} onToggle={radar.toggle} onLegend={radar.runLegend} 
              onSummary={radar.summary} headline={headline} instruments={instruments} rangeKm={rangeKm} setRange={(km) => { setRange(km); announce(lang === 'en' ? `Range ${km} kilometers.` : `Menzil ${km} kilometre.`); }}
              revSec={radar.revSec} setRevSec={radar.setRevSec} mode={mode} setMode={(m) => { setMode(m); announce(m === 'hikaye' ? (lang === 'en' ? 'Musical mode: notes spread across the differences around this place.' : 'Müzikal mod: notalar bu yerin çevresindeki farkı tüm aralığa yayar.') : (lang === 'en' ? 'Science mode: the same value is always the same note, everywhere.' : 'Bilim modu: aynı değer her yerde aynı notadır.')); }} legend={radar.legend} talking={radar.talking}>
              <Explore lang={lang} placeA={placeLabel(place)} placeB={placeB ? placeLabel(placeB) : null} compare={compare}
                setCompare={(v) => { setCompare(v); setCmpTurn(0); announce(v ? (lang === 'en' ? 'Listening in turns: one sweep for A, one sweep for B. Time stays fixed.' : 'Sırayla dinleme açık: bir tur A, bir tur B. Zaman sabit kalır.') : (lang === 'en' ? 'Listening in turns off.' : 'Sırayla dinleme kapalı.')); }}
                onPickB={() => { setPickFor('B'); setPickOpen(true); }} onClearB={() => { setPlaceB(null); setCompare(false); setCmpTurn(0); }} onDiff={sayDiff}
                onStories={() => setStoriesOpen(true)} onEvents={openEvents} onSound={() => setSoundOpen(true)}
                narrator={narrator} setNarrator={setNarrator} story={story} onStopStory={stopStory} />
            </NowCard>
            <LayerPills lang={lang} pills={pills} onToggle={(id) => toggleLayer(id as LayerId)} onShow={(id) => setVisual(id as LayerId)}>
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
            </LayerPills>
            {on.co2 && co2 && <Timeline lang={lang} month={month} setMonth={(m) => { setMonth(m); announce(lang === 'en' ? `${co2.monthLabel(m, 'en')}: ${co2.grid.bilinear(place, m).toFixed(1)} ppm at the center.` : `${co2.monthLabel(m)}: merkezde ${co2.grid.bilinear(place, m).toFixed(1)} ppm.`); }} label={co2.monthLabel(month, lang)} advance={advance} setAdvance={setAdvance} />}
          </>
        )}
      </main>

      <Dialog open={pickOpen} onClose={() => setPickOpen(false)} title={pickFor === 'B' ? (lang === 'en' ? 'Choose the second place' : 'İkinci yeri seç') : tr(lang, 'searchTitle')} lang={lang}>
        <PlacePicker cities={cities} place={pickFor === 'B' ? placeB : place} onPick={(p) => { if (pickFor === 'B') { setPlaceB(p); setCompare(true); setCmpTurn(0); announce(lang === 'en' ? `Second place: ${placeLabel(p)}. The radar now plays one sweep here and one sweep there. Press Space to listen.` : `İkinci yer: ${placeLabel(p)}. Radar artık bir tur birinci yeri, bir tur ikinci yeri çalar. Dinlemek için Boşluk.`); } else setPlace(p); setPickOpen(false); }} announce={announce} autoFocus />
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
