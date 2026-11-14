// Radar zamanlayıcısı: ses saatine göre ileri bakışlı planlama (setInterval sadece uyandırır, zamanlama AudioContext'te).
// Radar bir adım sıralayıcı (step sequencer) gibi çalar: 32 ışın = 2 ölçü. Her katman bir enstrüman ve bir ritim rolüdür.
import { engine } from './engine.ts';
import { bearingOf, gainFor, groupMean, noteHz, panFor, PARTS, pentaHz, type Mode, type RadarLayer, type RadarParams } from '../lib/radar.ts';

export interface RadarFrame {
  P: RadarParams;
  mode: Mode;
  revSec: number; // bir tur süresi
  layers: { layer: RadarLayer; vals: Float32Array; local: { min: number; max: number } }[];
}

// Yaylı yatağın akor yürüyüşü (her turda bir akor): Do – La – Fa – Sol. pentaHz indeksleri: C3=5, A2=4, F2≈(elle), G2=3.
const BED: number[][] = [
  [pentaHz(5), pentaHz(8)],          // C3 + G3
  [pentaHz(4), pentaHz(7)],          // A2 + E3
  [87.307, pentaHz(5)],              // F2 + C3
  [pentaHz(3), pentaHz(6)],          // G2 + D3
];

export class RadarPlayer {
  private timer: number | undefined;
  private next = 0;   // sonraki adımın ses zamanı
  private beam = 0;
  private rev = 0;    // tur sayacı (akor yürüyüşü için)
  private t0 = 0;     // 0. ışının (kuzey) ses zamanı — görsel açı hesabı için
  private get: () => RadarFrame | null;
  playing = false;
  /** Her tur tamamlandığında (kuzeye dönüşte) çağrılır — örn. zaman çizelgesini ilerletmek için. */
  onRevolution: (() => void) | null = null;

  constructor(get: () => RadarFrame | null) { this.get = get; }

  start(fromBeam = 0) {
    const F = this.get();
    if (!F) return;
    engine.unlock();
    clearInterval(this.timer);
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
    engine.wavesOff();
  }

  /** Şu anki ışın açısı (derece) — görsel için. */
  angle(): number {
    const F = this.get();
    if (!F) return 0;
    return ((((engine.now - this.t0) / F.revSec) * 360) % 360 + 360) % 360;
  }

  private tick() {
    const F = this.get();
    if (!F) return;
    const step = F.revSec / F.P.beams;
    // sekme arka planda kaldıysa (zamanlayıcı yavaşlar) geride kalan adımları atla; ses yığılmasın
    if (this.next < engine.now - 0.3) { this.next = engine.now + 0.05; this.t0 = this.next - this.beam * step; }
    while (this.next < engine.now + 0.15) {
      this.playBeam(F, this.beam, this.next, step);
      this.beam = (this.beam + 1) % F.P.beams;
      this.next += step;
      if (this.beam === 0) {
        this.rev++;
        this.t0 = this.next; // tur başı yeniden hizala (hız değişirse kaymasın)
        const cb = this.onRevolution; if (cb) setTimeout(cb, Math.max(0, (this.next - engine.now) * 1000));
      }
    }
  }

  /** Bir ışın adımını çal. Yer, katman ya da zaman değişirse bir sonraki adım yeni veriyle çalar (kesinti olmaz). */
  playBeam(F: RadarFrame, b: number, when: number, step: number) {
    const { P } = F;
    if (b === 0) {
      engine.northTick(when);
      if (F.layers.length) engine.pad(BED[this.rev % BED.length], when, F.revSec);
    }
    let sea = -1;
    for (const { layer, vals, local } of F.layers) {
      const part = PARTS[layer.id];
      if (layer.id === 'sst') sea = groupMean(vals, P, b, 1).cover;
      if ((((b - part.offset) % part.every) + part.every) % part.every !== 0) continue;
      const { mean } = groupMean(vals, P, b, part.every);
      if (Number.isNaN(mean)) continue; // veri yok → sessizlik (ör. arp karada susar)
      const t = gainFor(mean, layer, F.mode, local);
      if (t < part.gate) continue;      // aerosol yok denecek kadar az → sessizlik
      const pan = panFor(bearingOf(b + (part.every - 1) / 2, P.beams));
      engine.voice(layer.id, noteHz(t, part), when, step * part.every * 0.92, t, pan);
    }
    if (sea >= 0) engine.waves(sea); else engine.wavesOff();
  }

  /** Elle yön çevirme (←/→): o yöndeki yakın → orta → uzak değerler her katmanın enstrümanıyla üç nota olarak çalar. */
  playManual(F: RadarFrame, b: number, when: number) {
    const { P } = F;
    const third = Math.max(1, Math.round(P.rings / 3));
    const bands: [number, number][] = [[0, third], [third, P.rings - third], [P.rings - third, P.rings]];
    const pan = panFor(bearingOf(b, P.beams));
    for (const { layer, vals, local } of F.layers) {
      const part = PARTS[layer.id];
      bands.forEach(([k0, k1], i) => {
        const { mean } = groupMean(vals, P, b, 1, k0, k1);
        if (Number.isNaN(mean)) return;
        const t = gainFor(mean, layer, F.mode, local);
        if (t < part.gate) return;
        engine.voice(layer.id, noteHz(t, part), when + i * 0.22, 0.4, t, pan);
      });
    }
  }
}
