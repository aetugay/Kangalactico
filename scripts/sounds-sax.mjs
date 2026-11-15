// Okyanus müzik katmanı: saksafon cümleleri (raw/757835 phinster "5:52 PM electric sax", Freesound; lisans doğrulanacak).
// Kayıttan sessizlikle ayrılmış 2–6 sn'lik cümleler kesilir → public/sounds/okyanus_sax_N.mp3 (mono, ~-20 LUFS, 128 kbps, yumuşak giriş/çıkış).
// Her cümlenin ortanca perdesi (otokorelasyon) sounds.json'a yazılır: motor cümleyi müzik katmanının köküne (Do majör / La minör) kaydırır.
// Ayrıca: okyanus zemini saf dalga kaydına döner (yedek/ içindeki ilk sürüm); saksafon bas harmanlı v2 sürümleri yedek/ altına *_v2 olarak taşınır.
// Kullanım: node scripts/sounds-sax.mjs   (npm run sounds sonrası)
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const DIR = 'public/sounds', RAW = `${DIR}/raw`, BAK = `${DIR}/yedek`;
// sax.m4a = Freesound 757835 (phinster, "5:52 PM electric sax") ile bayt bayt aynı (md5 f5243359…)
const SRC = `${RAW}/${fs.readdirSync(RAW).find((f) => f === 'sax.m4a') ?? fs.readdirSync(RAW).find((f) => f.startsWith('757835'))}`;
if (SRC.endsWith('undefined')) throw new Error('saksafon kaydı yok: public/sounds/raw/sax.m4a');
const ff = (args) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 }); if (r.status !== 0) throw new Error(r.stderr); return r; };
const pcm = (file, sr = 8000, extra = []) => { const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:a:0', '-ac', '1', '-ar', String(sr), ...extra, '-f', 's16le', '-'], { maxBuffer: 1 << 28 }); return new Int16Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length >> 1); };

// 1) cümleler: 100 ms RMS; eşik üstü bölgeler, 350 ms'den kısa boşluklar birleştirilir
const a = pcm(SRC), W = 800, rms = [];
for (let i = 0; i + W <= a.length; i += W) { let s = 0; for (let k = i; k < i + W; k++) s += a[k] * a[k]; rms.push(20 * Math.log10(Math.sqrt(s / W) / 32768 + 1e-9)); }
const sorted = [...rms].sort((x, y) => x - y), thr = Math.max(sorted[Math.floor(sorted.length * 0.5)] + 6, -38);
let segs = [], st = -1, gap = 0;
rms.forEach((v, i) => { if (v > thr) { if (st < 0) st = i; gap = 0; } else if (st >= 0 && ++gap > 3) { segs.push([st, i - gap + 1]); st = -1; gap = 0; } });
if (st >= 0) segs.push([st, rms.length]);
segs = segs.map(([s, e]) => [s / 10, e / 10]).filter(([s, e]) => e - s >= 2 && e - s <= 7);
const loud = (s, e) => { const r = rms.slice(Math.round(s * 10), Math.round(e * 10)); return r.reduce((x, y) => x + y, 0) / r.length; };
segs.sort((p, q) => loud(q[0], q[1]) - loud(p[0], p[1]));
segs = segs.slice(0, 5).sort((p, q) => p[0] - q[0]);

// 2) perde: 2 kHz PCM, 50 ms çerçeve, 120–900 Hz otokorelasyon; güvenilir çerçevelerin ortancası
function pitch(file) {
  const x = pcm(file, 4000), N = 200, out = [];
  for (let i = 0; i + N * 2 <= x.length; i += N) {
    let e = 0; for (let k = 0; k < N; k++) e += x[i + k] * x[i + k]; if (e / N < 2e5) continue;
    let best = 0, bl = 0; for (let lag = Math.floor(4000 / 900); lag <= Math.floor(4000 / 120); lag++) { let c = 0; for (let k = 0; k < N; k++) c += x[i + k] * x[i + k + lag]; c /= e; if (c > best) { best = c; bl = lag; } }
    if (best > 0.6) out.push(4000 / bl);
  }
  out.sort((p, q) => p - q); return out.length ? Math.round(out[out.length >> 1]) : null;
}
const made = [];
segs.forEach(([s, e], i) => {
  const d = e - s + 0.3, name = `okyanus_sax_${i + 1}`;
  ff(['-i', SRC, '-map', '0:a:0', '-af', `atrim=start=${Math.max(0, s - 0.1)}:duration=${d},asetpts=PTS-STARTPTS,aformat=channel_layouts=mono,highpass=f=90,loudnorm=I=-20:TP=-2:LRA=11,afade=t=in:d=0.12,afade=t=out:st=${Math.max(0, d - 0.6)}:d=0.6`, '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k', `${DIR}/${name}.mp3`]);
  made.push({ name, from: SRC.split('/').pop(), start: +s.toFixed(1), seconds: +d.toFixed(1), pitchHz: pitch(`${DIR}/${name}.mp3`), kb: Math.round(fs.statSync(`${DIR}/${name}.mp3`).size / 1024) });
});
// 3) okyanus zemini: saf dalga (ilk sürüm yedekte) ← v2 harmanları yedeğe
fs.mkdirSync(BAK, { recursive: true });
for (const r of ['dalga_sakin', 'dalga_sert']) {
  if (!fs.existsSync(`${BAK}/${r}_v2.mp3`)) fs.copyFileSync(`${DIR}/${r}.mp3`, `${BAK}/${r}_v2.mp3`); // saksafon bas harmanlı sürüm (geri dönüş)
  if (fs.existsSync(`${BAK}/${r}.mp3`)) fs.copyFileSync(`${BAK}/${r}.mp3`, `${DIR}/${r}.mp3`);    // saf dalga (wave.wav, kesintisiz döngü)
}
const j = JSON.parse(fs.readFileSync(`${DIR}/sounds.json`, 'utf8'));
j.sax = made; j.v2 = (j.v2 ?? []).map((v) => (/^dalga_/.test(v.role) ? { ...v, used: false, why: v.why + ' — 2026-11-15: saf dalga zemine dönüldü; saksafon artık ayrı melodik katman (okyanus_sax_N)' } : v));
fs.writeFileSync(`${DIR}/sounds.json`, JSON.stringify(j, null, 1));
for (const m of made) console.log(`${m.name}  ${m.start}s +${m.seconds}s  perde ${m.pitchHz ?? '?'} Hz  ${m.kb} KB`);
