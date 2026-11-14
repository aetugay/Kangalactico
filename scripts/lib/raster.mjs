// ffmpeg tabanlı ham piksel okuma/yazma (ek npm paketi yok).
import { spawn, spawnSync } from 'node:child_process';

const FF = process.env.FFMPEG || 'ffmpeg';
const FP = process.env.FFPROBE || 'ffprobe';

export function probe(file) {
  const r = spawnSync(FP, ['-v', 'error', '-select_streams', 'v:0', '-count_packets',
    '-show_entries', 'stream=width,height,r_frame_rate,nb_read_packets', '-of', 'json', file], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  const s = JSON.parse(r.stdout).streams[0];
  const [a, b] = s.r_frame_rate.split('/').map(Number);
  return { w: s.width, h: s.height, fps: a / b, frames: +s.nb_read_packets };
}

/**
 * Tek kare oku → {w,h,data: Uint8Array RGB}. `at` = { frame } ya da { t } (saniye).
 * scale: [w,h] verilirse ffmpeg 'area' ile küçültür.
 */
export function readFrame(file, at = { frame: 0 }, scale = null) {
  const vf = [];
  if (at.frame != null) vf.push(`select=eq(n\\,${at.frame})`);
  if (scale) vf.push(`scale=${scale[0]}:${scale[1]}:flags=area`);
  const args = ['-v', 'error'];
  if (at.t != null) args.push('-ss', String(at.t));
  args.push('-i', file);
  if (vf.length) args.push('-vf', vf.join(','));
  args.push('-frames:v', '1', '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1');
  const r = spawnSync(FF, args, { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(String(r.stderr));
  const info = scale ? { w: scale[0], h: scale[1] } : imageSize(file);
  const data = new Uint8Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length);
  if (data.length !== info.w * info.h * 3) throw new Error(`beklenmeyen boyut ${data.length} (${file})`);
  return { w: info.w, h: info.h, data };
}

export function imageSize(file) {
  const r = spawnSync(FP, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const [w, h] = r.stdout.trim().split(',').map(Number);
  return { w, h };
}

/**
 * Videodan kareleri AKIŞ olarak oku (bellekte tek kare tutulur). fps örnekleme / kırpma / ölçek.
 * Her kare için cb(img, i) çağrılır (img.data bir sonraki karede yeniden kullanılır → gerekiyorsa kopyala).
 * Döner: Promise<kare sayısı>.
 */
export function readFrames(file, { fps, scale, crop, size, select }, cb) {
  const vf = [];
  if (select) vf.push(`select=${select.replace(/,/g, '\\,')}`); // ör. 'lt(n,284)' → filtre içinde virgül kaçışlı
  if (fps) vf.push(`fps=${fps}`);
  if (crop) vf.push(`crop=${crop.w}:${crop.h}:${crop.x}:${crop.y}`);
  if (scale) vf.push(`scale=${scale[0]}:${scale[1]}:flags=area`);
  const [w, h] = scale || (crop ? [crop.w, crop.h] : size || [imageSize(file).w, imageSize(file).h]);
  const FS = w * h * 3;
  const args = ['-v', 'error', '-i', file];
  if (vf.length) args.push('-vf', vf.join(','));
  if (select) args.push('-fps_mode', 'vfr');
  args.push('-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1');
  return new Promise((resolve, reject) => {
    const p = spawn(FF, args);
    const frame = new Uint8Array(FS);
    let fill = 0, n = 0, err = '';
    p.stdout.on('data', (chunk) => {
      let off = 0;
      while (off < chunk.length) {
        const take = Math.min(FS - fill, chunk.length - off);
        frame.set(chunk.subarray(off, off + take), fill);
        fill += take; off += take;
        if (fill === FS) { cb({ w, h, data: frame }, n++); fill = 0; }
      }
    });
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => (code === 0 ? resolve(n) : reject(new Error(err || `ffmpeg ${code}`))));
  });
}

/** Gri (Uint8) ya da RGB dizisini PNG olarak yaz. */
export function writePng(file, w, h, data, fmt = 'gray') {
  const r = spawnSync(FF, ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', fmt, '-s', `${w}x${h}`, '-i', 'pipe:0', file], { input: Buffer.from(data.buffer, data.byteOffset, data.length) });
  if (r.status !== 0) throw new Error(String(r.stderr));
}

export const px = (img, x, y) => {
  const i = (y * img.w + x) * 3;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
};
