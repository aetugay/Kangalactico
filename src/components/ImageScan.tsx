// "Görüntüyü dinle": küre/3B NASA görselleri (SVS 4950 GEDI, 5196 DYAMOND) coğrafi harita DEĞİL → radarda kullanılmaz.
// Görüntü soldan sağa taranır (Caldwell 73 / SVS 13786 yöntemi): sütun = zaman, yükseklik = perde (üst ince), değer = şiddet + parlaklık.
// Ekran ızgarası 192×108; 12 yatay bant. Değerler GÖRELİ (renk skalasında güvenilir sayı yok — kaynak dosyadaki "limits").
import { useEffect, useRef, useState } from 'react';
import { engine } from '../audio/engine.ts';
import { colorFor } from '../lib/grid.ts';
import { loadScreenGrid, type ScreenGrid } from '../lib/layers.ts';
import { pentaHz } from '../lib/radar.ts';
import { Dialog } from './Shell.tsx';

type Id = '4950' | '5196';
const META: Record<Id, { tr: string; en: string; inst: string; instTr: string; instEn: string; svs: string }> = {
  '4950': { tr: 'Orman yüksekliği (GEDI)', en: 'Forest height (GEDI)', inst: 'sst', instTr: 'arp', instEn: 'harp', svs: 'SVS 4950' },
  '5196': { tr: 'Küresel CO₂ (DYAMOND modeli, Ocak–Mart 2020)', en: 'Global CO₂ (DYAMOND model, Jan–Mar 2020)', inst: 'dust', instTr: 'çelesta', instEn: 'celesta', svs: 'SVS 5196' },
};
const BANDS = 12;

export function ImageScan({ open, onClose, lang, announce }: { open: boolean; onClose: () => void; lang: 'tr' | 'en'; announce: (t: string) => void }) {
  const en = lang === 'en';
  const [id, setId] = useState<Id>('4950');
  const [grids, setGrids] = useState<Partial<Record<Id, ScreenGrid>>>({});
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [col, setCol] = useState(-1);
  const canvas = useRef<HTMLCanvasElement>(null);
  const run = useRef(0);
  const g = grids[id];

  useEffect(() => {
    if (!open || grids[id]) return;
    loadScreenGrid(import.meta.env.BASE_URL, id).then((sg) => { setGrids((o) => ({ ...o, [id]: sg })); setFrame(Math.floor(sg.frames / 2)); }).catch((e) => announce(String(e)));
  }, [open, id, grids, announce]);
  useEffect(() => () => { run.current++; }, []);
  useEffect(() => { if (!open) { run.current++; setPlaying(false); setCol(-1); } }, [open]);

  // görüntüyü çiz (kaynağın kendi renk skalasıyla) + tarama çizgisi
  useEffect(() => {
    const c = canvas.current; if (!c || !g) return;
    const ctx = c.getContext('2d')!; const img = ctx.createImageData(g.w, g.h);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const v = g.at(frame, x, y), o = (y * g.w + x) * 4;
      if (Number.isNaN(v)) { img.data[o] = 8; img.data[o + 1] = 12; img.data[o + 2] = 24; img.data[o + 3] = 255; continue; }
      const t = (v - g.cs.min) / (g.cs.max - g.cs.min || 1);
      const [r, gg, b] = colorFor(g.cs, g.cs.min + t * (g.cs.max - g.cs.min)); img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    if (col >= 0) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(col, 0, 1, g.h); }
  }, [g, frame, col]);

  /** Bir sütunun bantları: her bandın geçerli piksel ortalaması (yoksa NaN). */
  const bandsAt = (sg: ScreenGrid, f: number, x: number) => Array.from({ length: BANDS }, (_, b) => {
    const y0 = Math.floor((b * sg.h) / BANDS), y1 = Math.floor(((b + 1) * sg.h) / BANDS); let s = 0, n = 0;
    for (let y = y0; y < y1; y++) { const v = sg.at(f, x, y); if (!Number.isNaN(v)) { s += v; n++; } }
    return n >= (y1 - y0) / 2 ? s / n : NaN; // bandın yarısından azında veri → sessiz
  });

  const play = async () => {
    if (!g) return;
    if (playing) { run.current++; setPlaying(false); setCol(-1); return; }
    engine.unlock(); const my = ++run.current; setPlaying(true);
    const m = META[id], step = 8 / g.w * 4; // 4 sütunda bir adım → ~8 sn
    announce(en ? `${m.en}. Scanning the image from left to right in 8 seconds: higher on screen = higher note, stronger value = louder and brighter. This is a globe image, not a map: no geographic position, values are relative.`
      : `${m.tr}. Görüntüyü 8 saniyede soldan sağa tarıyorum: ekranda yukarısı ince nota, güçlü değer daha yüksek ve parlak ses. Bu bir küre görüntüsü, harita değil: coğrafi konum yok, değerler göreli.`);
    await new Promise((r) => setTimeout(r, 300));
    const t0 = engine.now + 0.1;
    for (let x = 0, k = 0; x < g.w; x += 4, k++) {
      const when = t0 + k * step, pan = (x / (g.w - 1)) * 2 - 1;
      bandsAt(g, frame, x).forEach((v, b) => {
        if (Number.isNaN(v)) return;
        const t = Math.max(0, Math.min(1, (v - g.cs.min) / (g.cs.max - g.cs.min || 1)));
        if (t < 0.05) return;
        engine.voice(m.inst, pentaHz(5 + (BANDS - 1 - b)), when, step * 1.6, t, pan, t);
      });
    }
    for (let x = 0; x < g.w; x += 4) { if (my !== run.current) return; setCol(x); await new Promise((r) => setTimeout(r, step * 1000)); }
    if (my === run.current) { setPlaying(false); setCol(-1); }
  };

  const m = META[id];
  return (
    <Dialog open={open} onClose={() => { run.current++; onClose(); }} title={en ? 'Listen to an image' : 'Görüntüyü dinle'} lang={lang}>
      <p className="small">{en ? 'These NASA visualizations show a 3D globe with a moving camera, so they cannot be used on the radar (no map position). Instead the image is scanned left to right.' : 'Bu NASA görselleri hareketli kameralı 3B küre; harita konumu olmadığı için radarda kullanılamaz. Bunun yerine görüntü soldan sağa taranır.'}</p>
      <fieldset className="fs">
        <legend>{en ? 'Image' : 'Görsel'}</legend>
        <div className="seg">
          {(Object.keys(META) as Id[]).map((k) => (
            <label key={k} className={k === id ? 'on' : ''}><input type="radio" name="scan-img" checked={k === id} onChange={() => { run.current++; setPlaying(false); setCol(-1); setId(k); }} />{en ? META[k].en : META[k].tr}</label>
          ))}
        </div>
      </fieldset>
      {g ? (
        <>
          <canvas ref={canvas} width={g.w} height={g.h} className="scan-canvas" aria-hidden="true" />
          <label className="small" htmlFor="scan-frame">{en ? 'Video frame' : 'Video karesi'}: {frame + 1}/{g.frames}</label>
          <input id="scan-frame" type="range" min={0} max={g.frames - 1} value={frame} aria-valuetext={`${frame + 1} / ${g.frames}`} onChange={(e) => setFrame(+e.target.value)} />
          <div className="btn-row"><button type="button" className="btn primary" onClick={play}>{playing ? (en ? 'Stop' : 'Durdur') : (en ? `Listen (${m.instEn})` : `Dinle (${m.instTr})`)}</button></div>
          <p className="small muted">{m.svs} · {g.file.credit}</p>
          <ul className="small muted">{g.file.limits.map((l) => <li key={l}>{l}</li>)}</ul>
        </>
      ) : <p className="small" role="status">{en ? 'Loading…' : 'Yükleniyor…'}</p>}
    </Dialog>
  );
}
