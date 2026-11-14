// Radar zamanlayıcısı: ses saatine göre ileri bakışlı planlama (setInterval sadece uyandırır, zamanlama AudioContext'te).
import { engine } from './engine.ts';
import { bearingOf, gainFor, panFor, pitchFor, type Mode, type RadarLayer, type RadarParams } from '../lib/radar.ts';

export interface RadarFrame {
  P: RadarParams;
  mode: Mode;
  revSec: number; // bir tur süresi
  layers: { layer: RadarLayer; vals: Float32Array; local: { min: number; max: number } }[];
}

export class RadarPlayer {
  private timer: number | undefined;
  private next = 0;   // sonraki adımın ses zamanı
  private beam = 0;
  private t0 = 0;     // 0. ışının (kuzey) ses zamanı — görsel açı hesabı için
  private get: () => RadarFrame;
  playing = false;

  constructor(get: () => RadarFrame) { this.get = get; }

  start(fromBeam = 0) {
    engine.unlock();
    const F = this.get();
    const step = F.revSec / F.P.beams;
    this.beam = fromBeam;
    this.next = engine.now + 0.08;
    this.t0 = this.next - fromBeam * step;
    this.playing = true;
    this.timer = window.setInterval(() => this.tick(), 25);
    this.tick();
  }

  stop() {
    this.playing = false;
    clearInterval(this.timer);
  }

  /** Şu anki ışın açısı (derece) — görsel için. */
  angle(): number {
    const F = this.get();
    return ((((engine.now - this.t0) / F.revSec) * 360) % 360 + 360) % 360;
  }

  private tick() {
    const F = this.get();
    const step = F.revSec / F.P.beams;
    while (this.next < engine.now + 0.15) {
      this.playBeam(F, this.beam, this.next, step);
      this.beam = (this.beam + 1) % F.P.beams;
      this.next += step;
      if (this.beam === 0) this.t0 = this.next; // tur başı yeniden hizala (hız değişirse kaymasın)
    }
  }

  /** Tek ışını çal (elle yön çevirmede de kullanılır). */
  playBeam(F: RadarFrame, b: number, when: number, step: number) {
    if (b === 0) engine.northTick(when);
    const br = bearingOf(b, F.P.beams), pan = panFor(br);
    for (const { layer, vals, local } of F.layers) {
      for (let k = 0; k < F.P.rings; k++) {
        const v = vals[b * F.P.rings + k];
        const g = gainFor(v, layer, F.mode, local);
        if (g < 0.03) continue;
        engine.voice(layer.id, pitchFor(k, F.P.rings, F.mode, layer.baseHz), when, step * 1.5, g, pan);
      }
    }
  }
}
