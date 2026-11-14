// Ses dünyası örnekleri: public/sounds/raw/ (orijinaller, git'e girmez) → public/sounds/*.mp3 (mono, ~-20 LUFS, 128 kbps, ≤ 1 MB).
// Sürekli sesler: kesintisiz döngü (sonu başına yumuşak geçişle karışır). Tek seferlikler: baş/son sessizlik kırpılır.
// Gök gürültüleri dosyanın alçak frekans (<200 Hz) enerji tepelerinden otomatik kesilir; sağanak döngüsü en sakin (gök gürültüsüz) bölümden.
// Kullanım: node scripts/sounds.mjs   (npm run sounds) — ffmpeg gerekir.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const DIR = 'public/sounds', RAW = `${DIR}/raw`;
fs.mkdirSync(RAW, { recursive: true });
const OUT_NAMES = new Set(['buz_catirti_1', 'buz_catirti_2', 'ates_kucuk', 'ates_buyuk', 'toz_siddetli', 'toz_hafif', 'ruzgar_kuvvetli', 'ruzgar_hafif', 'kis_ruzgari', 'dalga_sakin', 'deniz_serpinti', 'dalga_sert', 'orman_kus', 'yaprak_hisirti', 'gece_circir', 'kar', 'yagmur_orta', 'yagmur_cisenti', 'yagmur_saganak', 'gok_yakin_1', 'gok_yakin_2', 'gok_yakin_3', 'gok_uzak_1', 'gok_uzak_2']);
for (const f of fs.readdirSync(DIR)) { const p = path.join(DIR, f); if (fs.statSync(p).isFile() && !f.endsWith('.json') && !OUT_NAMES.has(f.replace(/.mp3$/, ''))) fs.renameSync(p, path.join(RAW, f)); }
// önce tam ad ("rain." → rain.wav; lightrainthunder.wav DEĞİL), yoksa ad içinde geçen ("-forest.wav")
const src = (name) => { const all = fs.readdirSync(RAW); const f = all.find((x) => x.startsWith(name + '.')) ?? all.find((x) => x.includes(name)); if (!f) throw new Error(`ham dosya yok: ${name}`); return path.join(RAW, f); };
const dur = (f) => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim();
const ff = (args) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 }); if (r.status !== 0) throw new Error(r.stderr); };
const OUT = ['-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k'];
const NORM = 'loudnorm=I=-20:TP=-2:LRA=11';

/** Alçak bant (<200 Hz) enerji eğrisi: 0.25 sn pencereler (gök gürültüsü bulmak için). */
function lowEnergy(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-i', file, '-ac', '1', '-ar', '4000', '-af', 'lowpass=f=200', '-f', 's16le', '-'], { maxBuffer: 1 << 30 });
  const pcm = new Int16Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length >> 1), W = 1000, out = [];
  for (let i = 0; i + W <= pcm.length; i += W) { let s = 0; for (let k = i; k < i + W; k++) s += pcm[k] * pcm[k]; out.push(Math.sqrt(s / W)); }
  return out; // değer/0.25 sn
}
const peaks = (e, n, minGapSec, edgeSec, total) => {
  const idx = e.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]), pick = [];
  for (const [, i] of idx) { const t = i / 4; if (t < edgeSec || t > total - edgeSec) continue; if (pick.every((p) => Math.abs(p - t) >= minGapSec)) pick.push(t); if (pick.length === n) break; }
  return pick.sort((a, b) => a - b);
};
const quietest = (e, lenSec) => { const W = lenSec * 4; let best = 0, bv = Infinity; for (let i = 0; i + W < e.length; i += 4) { let mx = 0; for (let k = i; k < i + W; k++) mx = Math.max(mx, e[k]); if (mx < bv) { bv = mx; best = i; } } return best / 4; };

/** Kesintisiz döngü: [S, S+L+F] kesitinin son F saniyesi başına yumuşak geçişle karışır → uzunluk L. */
function loop(name, file, S, L, extra = '', F = 2) {
  const fc = `[0:a]atrim=start=${S}:duration=${L + F},asetpts=PTS-STARTPTS,aformat=channel_layouts=mono,${NORM}${extra ? ',' + extra : ''},asplit=3[a][b][c];`
    + `[a]atrim=0:${F},asetpts=PTS-STARTPTS,afade=t=in:d=${F}[h];[b]atrim=${L}:${L + F},asetpts=PTS-STARTPTS,afade=t=out:d=${F}[t];`
    + `[h][t]amix=inputs=2:normalize=0[x];[c]atrim=${F}:${L},asetpts=PTS-STARTPTS[body];[x][body]concat=n=2:v=0:a=1[out]`;
  ff(['-i', file, '-filter_complex', fc, '-map', '[out]', ...OUT, `${DIR}/${name}.mp3`]);
  return { name, kind: 'loop', from: path.basename(file), start: S, seconds: L, process: extra || 'yok' };
}
/** Tek seferlik: kesit + sessizlik kırpma + sonda yumuşak sönüm. */
function shot(name, file, S, D, extra = '') {
  const af = `atrim=start=${S}:duration=${D},asetpts=PTS-STARTPTS,aformat=channel_layouts=mono,${NORM},silenceremove=start_periods=1:start_threshold=-55dB,areverse,silenceremove=start_periods=1:start_threshold=-55dB,areverse,afade=t=out:st=${Math.max(0, D - 1.2)}:d=1.2${extra ? ',' + extra : ''}`;
  ff(['-i', file, '-af', af, ...OUT, `${DIR}/${name}.mp3`]);
  return { name, kind: 'shot', from: path.basename(file), start: +S.toFixed(2), seconds: D, process: extra || 'yok' };
}

const made = [];
// buz çatırtısı (Gregor Quendel, Freesound) — tek seferlik dizi; motor içinden kısa dilimler çalar
for (const [i, id] of [[1, '422117'], [2, '424993']]) { const f = src(id); made.push(shot(`buz_catirti_${i}`, f, 0, Math.min(15, dur(f)))); }
// ateş
made.push(loop('ates_kucuk', src('campfire'), 300, 30));
made.push(loop('ates_buyuk', src('wildfire'), 3, 30));
// toz
made.push(loop('toz_siddetli', src('sandstormmix'), 100, 40));
made.push(loop('toz_hafif', src('sandstormmix'), 100, 40, 'lowpass=f=1600,volume=-9dB'));
// rüzgâr
made.push(loop('ruzgar_kuvvetli', src('wind'), 40, 35));
made.push(loop('ruzgar_hafif', src('wind'), 5, 35, 'lowpass=f=1200,volume=-7dB'));
made.push(loop('kis_ruzgari', src('wind'), 20, 35, 'highpass=f=500,treble=g=6:f=3000,acompressor=threshold=-24dB:ratio=4:attack=5:release=80,volume=2dB'));
// dalga
made.push(loop('dalga_sakin', src('wave'), 20, 40));
made.push(loop('deniz_serpinti', src('wave'), 60, 40, 'highpass=f=2500,volume=-3dB'));
made.push(loop('dalga_sert', src('wave'), 100, 40, 'acompressor=threshold=-26dB:ratio=5:attack=3:release=60,treble=g=4:f=2500,volume=3dB'));
// orman
made.push(loop('orman_kus', src('forest'), 30, 40));
made.push(loop('yaprak_hisirti', src('forest'), 110, 40, 'lowpass=f=2200,highpass=f=200'));
// cırcır, kar
made.push(loop('gece_circir', src('crickets'), 1, 26));
made.push(loop('kar', src('snow-foot'), 2, 35));
// yağmur
made.push(loop('yagmur_orta', src('rain'), 30, 40));
made.push(loop('yagmur_cisenti', src('rain'), 30, 40, 'lowpass=f=5000,volume=-12dB'));
// sağanak + yakın gök gürültüleri (thunderstorm.wav)
{
  const f = src('thunderstorm'), T = dur(f), e = lowEnergy(f);
  const q = quietest(e, 42); made.push(loop('yagmur_saganak', f, q, 40));
  peaks(e, 3, 10, 2, T - 8).forEach((t, i) => made.push(shot(`gok_yakin_${i + 1}`, f, Math.max(0, t - 0.8), 7)));
}
// uzak gürlemeler (lightrainthunder.wav)
{ const f = src('lightrainthunder'), T = dur(f), e = lowEnergy(f); peaks(e, 2, 10, 2, T - 9).forEach((t, i) => made.push(shot(`gok_uzak_${i + 1}`, f, Math.max(0, t - 1.5), 8))); }

const list = made.map((m) => ({ ...m, kb: Math.round(fs.statSync(`${DIR}/${m.name}.mp3`).size / 1024) }));
const over = list.filter((m) => m.kb > 1024);
fs.writeFileSync(`${DIR}/sounds.json`, JSON.stringify({ format: 'mp3 mono 44.1 kHz 128 kbps, loudnorm I=-20 LUFS', synth: ['sehir_trafik', 'sehir_kalabalik', 'agustos_bocegi', 'volkan'], files: list }, null, 1));
for (const m of list) console.log(`${m.name.padEnd(18)} ${m.kind.padEnd(5)} ${String(m.kb).padStart(4)} KB ← ${m.from} @${m.start}s ${m.seconds}s ${m.process !== 'yok' ? '· ' + m.process : ''}`);
if (over.length) { console.error('1 MB üstü:', over.map((m) => m.name).join(', ')); process.exit(1); }
