// soundsv2 harmanları: eski doğa kaydı (public/sounds/raw) + yeni kayıt (public/soundsv2 → raw/ kopyası) → aynı rol adıyla yeni döngü.
// soundsv2'deki dosyaların HEPSİ müzik (flüt, saksafon, yaylı, film müziği); doğa sesi değil. Bu yüzden yeni kayıt doğrudan konmaz:
//   1) "doku"ya çevrilir: perde kaydırma + bant süzgeci + 5 zaman kaydırmalı kopya + yankı → melodi bulanıklaşır, sürekli bir uğultu kalır;
//   2) eski kaydın ALTINA kısık katmanlanır (doğa sesi baskın kalır) ya da (volkan) eski kaydın bas bandıyla birleşir.
// Ölçüm: spektral düzlük (gürültü ↔ ton) ve vuruş sayısı; harman doğa sesini "müziğe" çeviriyorsa (düzlük çok düşerse) REDDEDİLİR, eski kalır.
// Eski işlenmiş dosya ilk üzerine yazmadan önce public/sounds/yedek/ altına kopyalanır (geri dönüş).
// Kullanım: node scripts/sounds-v2.mjs  (npm run sounds sonrası; npm run sounds:v2)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const DIR = 'public/sounds', RAW = `${DIR}/raw`, MIX = `${RAW}/_mix`, BAK = `${DIR}/yedek`, V2 = 'public/soundsv2';
fs.mkdirSync(MIX, { recursive: true }); fs.mkdirSync(BAK, { recursive: true });
// orijinaller raw/ altına (git'e girmez); aynı içerikli kopya ("(1)") atlanır
if (fs.existsSync(V2)) for (const f of fs.readdirSync(V2)) if (!/\(\d\)/.test(f) && !fs.existsSync(`${RAW}/${f}`)) fs.copyFileSync(`${V2}/${f}`, `${RAW}/${f}`);
const src = (name) => { const f = fs.readdirSync(RAW).find((x) => x.startsWith(name + '.')) ?? fs.readdirSync(RAW).find((x) => x.includes(name)); if (!f) throw new Error(`ham dosya yok: ${name}`); return path.join(RAW, f); };
const ff = (args) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 }); if (r.status !== 0) throw new Error(r.stderr); };
const OUT = ['-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k'];
const NORM = 'loudnorm=I=-20:TP=-2:LRA=11';
const F = 2;

/** Müzik kaydını sürekli dokuya çevir (wav, len sn). */
function texture(out, file, { pitch = 1, hp = 60, lp = 4000, len = 44, start = 0 }) {
  const taps = [0, 0.9, 2.1, 3.4, 5.2];
  const fc = `[0:a]aformat=channel_layouts=mono,atrim=start=${start},asetpts=PTS-STARTPTS,asetrate=${Math.round(44100 * pitch)},aresample=44100,highpass=f=${hp},lowpass=f=${lp},lowpass=f=${lp},asplit=${taps.length}${taps.map((_, i) => `[s${i}]`).join('')};`
    + taps.map((d, i) => `[s${i}]adelay=${Math.round(d * 1000)}|${Math.round(d * 1000)}[d${i}]`).join(';') + ';'
    + `${taps.map((_, i) => `[d${i}]`).join('')}amix=inputs=${taps.length}:normalize=1,aecho=0.8:0.8:140|420|980:0.45|0.35|0.25,atrim=start=6:duration=${len},asetpts=PTS-STARTPTS,${NORM}[o]`;
  ff(['-stream_loop', '-1', '-i', file, '-t', String(len + 12), '-filter_complex', fc, '-map', '[o]', '-ar', '44100', out]);
}
/** Eski kesit (kendi işlemiyle) + doku (gain dB) → harman wav. */
function blend(out, oldFile, S, L, oldExtra, tex, gainDb) {
  const fc = `[0:a]atrim=start=${S}:duration=${L + F},asetpts=PTS-STARTPTS,aformat=channel_layouts=mono,${NORM}${oldExtra ? ',' + oldExtra : ''}[a];`
    + `[1:a]atrim=0:${L + F},asetpts=PTS-STARTPTS,aformat=channel_layouts=mono,volume=${gainDb}dB[b];[a][b]amix=inputs=2:normalize=0[o]`;
  ff(['-i', oldFile, '-i', tex, '-filter_complex', fc, '-map', '[o]', '-ar', '44100', out]);
}
/** Kesintisiz döngü (sounds.mjs ile aynı yöntem). */
function loop(outMp3, file, L, extra = '') {
  const fc = `[0:a]atrim=0:${L + F},asetpts=PTS-STARTPTS,aformat=channel_layouts=mono,${NORM}${extra ? ',' + extra : ''},asplit=3[a][b][c];`
    + `[a]atrim=0:${F},asetpts=PTS-STARTPTS,afade=t=in:d=${F}[h];[b]atrim=${L}:${L + F},asetpts=PTS-STARTPTS,afade=t=out:d=${F}[t];`
    + `[h][t]amix=inputs=2:normalize=0[x];[c]atrim=${F}:${L},asetpts=PTS-STARTPTS[body];[x][body]concat=n=2:v=0:a=1[out]`;
  ff(['-i', file, '-filter_complex', fc, '-map', '[out]', ...OUT, outMp3]);
}
/** Spektral düzlük ortancası (0 ton … 1 gürültü) + 3–6 kHz / <150 Hz bant oranı. */
function measure(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-i', file, '-ac', '1', '-ar', '22050', '-af', 'aspectralstats=win_size=2048:measure=flatness+centroid,ametadata=print:file=-', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const fl = [...r.stdout.matchAll(/flatness=([\d.]+)/g)].map((m) => +m[1]).sort((a, b) => a - b), ce = [...r.stdout.matchAll(/centroid=([\d.]+)/g)].map((m) => +m[1]).sort((a, b) => a - b);
  return { flat: +fl[fl.length >> 1].toFixed(3), centroid: Math.round(ce[ce.length >> 1]) };
}
const lufs = (file) => +(spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], { encoding: 'utf8' }).stderr.match(/I:\s+(-?[\d.]+) LUFS/g).pop().match(/-?[\d.]+/)[0]);
const backup = (name) => { const p = `${DIR}/${name}.mp3`, b = `${BAK}/${name}.mp3`; if (fs.existsSync(p) && !fs.existsSync(b)) fs.copyFileSync(p, b); };

// rol, eski kaynak + kesit + eski işlem, yeni kaynak + doku ayarı + seviye
const PLAN = [
  { role: 'kis_ruzgari', old: ['wind', 20, 'highpass=f=500,treble=g=6:f=3000,acompressor=threshold=-24dB:ratio=4:attack=5:release=80,volume=2dB'], neu: ['814710', { pitch: 0.75, hp: 400, lp: 2600 }], gain: -10, why: 'yankılı flüt → buzlu rüzgârın uğuldayan tonu (bulanık, 600 Hz–2,6 kHz); rüzgârın hışırtısı baskın' },
  { role: 'ruzgar_hafif', old: ['wind', 5, 'lowpass=f=1200,volume=-7dB'], neu: ['333996', { pitch: 0.5, hp: 150, lp: 1200 }], gain: -14, why: 'Kızılderili flütü bir oktav pes + alçak geçiren → esintinin altında yumuşak, havalı gövde' },
  { role: 'ruzgar_kuvvetli', old: ['wind', 40, ''], neu: ['324085', { pitch: 0.85, hp: 1500, lp: 5000 }], gain: -15, why: 'sopranino blok flüt yüksek geçiren + bulanık → sert rüzgârda ıslık/uğultu' },
  { role: 'volkan', old: ['thunderstorm', 60, 'lowpass=f=140,lowpass=f=140,volume=6dB'], neu: ['861539', { pitch: 0.5, hp: 25, lp: 160 }], gain: -3, why: 'yaylı orkestranın bas sesi bir oktav pes (<160 Hz) + fırtına kaydının boğuk gürlemesi → derin volkan uğultusu (şimdiye kadar sentezdi)' },
];
const L = 38, report = [];
for (const p of PLAN) {
  const [oName, S, oExtra] = p.old, [nName, opt] = p.neu;
  const tex = `${MIX}/${p.role}_tex.wav`, mix = `${MIX}/${p.role}_mix.wav`, oldOnly = `${MIX}/${p.role}_old.wav`, cand = `${MIX}/${p.role}.mp3`;
  texture(tex, src(nName), { ...opt, len: L + F + 2 });
  blend(mix, src(oName), S, L, oExtra, tex, p.gain);
  blend(oldOnly, src(oName), S, L, oExtra, tex, -120);
  loop(cand, mix, L);
  // seviye: eski dosyanın ölçülen ses yüksekliğine eşitle ("hafif" sürümlerin kasıtlı kısıklığı korunur); yeni rol (volkan) -20 LUFS
  const ref = fs.existsSync(`${BAK}/${p.role}.mp3`) ? `${BAK}/${p.role}.mp3` : null; // yedek = eski işlenmiş dosya
  if (ref) { const d = +(lufs(ref) - lufs(cand)).toFixed(1); if (Math.abs(d) > 0.5) loop(cand, mix, L, `volume=${d}dB`); }
  const a = measure(oldOnly), b = measure(cand), kb = Math.round(fs.statSync(cand).size / 1024);
  // karar: doğa sesi gürültü karakterini korumalı (düzlük en az %60'ı kalmalı); volkanda eski ses yok (yeni rol) → bas bandı yeterli
  const keep = p.role === 'volkan' ? true : b.flat >= a.flat * 0.6;
  if (keep && kb <= 1024) { backup(p.role); fs.copyFileSync(cand, `${DIR}/${p.role}.mp3`); }
  report.push({ role: p.role, old: path.basename(src(oName)), neu: path.basename(src(nName)), gainDb: p.gain, flatOld: a.flat, flatNew: b.flat, centroidOld: a.centroid, centroidNew: b.centroid, kb, used: keep && kb <= 1024, why: p.why });
  console.log(`${p.role.padEnd(16)} düzlük ${a.flat} → ${b.flat} · merkez ${a.centroid} → ${b.centroid} Hz · ${kb} KB · ${keep ? 'HARMAN KULLANILDI' : 'REDDEDİLDİ (eski kaldı)'}`);
}
// sounds.json: v2 bilgisi
const j = JSON.parse(fs.readFileSync(`${DIR}/sounds.json`, 'utf8'));
j.v2 = report; j.synth = j.synth.filter((s) => !(s === 'volkan' && report.find((r) => r.role === 'volkan' && r.used)));
fs.writeFileSync(`${DIR}/sounds.json`, JSON.stringify(j, null, 1));
