// Radar zamanlayıcısı: ses saatine göre ileri bakışlı planlama (setInterval sadece uyandırır, zamanlama AudioContext'te).
// Radar bir adım sıralayıcı (step sequencer) gibi çalar: 32 ışın = 2 ölçü. Her katman bir enstrüman ve bir ritim rolüdür.
//
// KURAL (Adım 1): her nota bir veri değerinden üretilir (lib/radar.ts → beamEvents). Veri yoksa ses yok.
//  - Bilim modu: yalnızca veri notaları + kuzey işareti (yön referansı; veri değil, tek istisna).
//  - Hikâye modu: ayrıca merkez değerden türeyen zemin akoru ve deniz payına bağlı dalga sesi (ikisi de veriye bağlı).
import { engine } from './engine.ts';
import { beamEvents, groupMean, noteHz, gainFor, PARTS, type FrameData, type SoundEvent } from '../lib/radar.ts';

export interface RadarFrame extends FrameData {
  revSec: number; // bir tur süresi
}

export class RadarPlayer {
  private timer: number | undefined;
  private next = 0;   // sonraki adımın ses zamanı
  private beam = 0;
  private t0 = 0;     // 0. ışının (kuzey) ses zamanı — görsel açı hesabı için
  private get: () => RadarFrame | null;
  playing = false;
  /** Her tur tamamlandığında (kuzeye dönüşte) çağrılır — örn. zaman çizelgesini ilerletmek için. */
  onRevolution: (() => void) | null = null;
  /** Bir ışın adımı ÇALINDIĞI anda (ses saatine hizalı) o adımın notaları — canlı gösterge için. */
  onEvents: ((ev: SoundEvent[], beam: number) => void) | null = null;

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
    while (this.next < engine.now + 0.3) { // 0.3 sn ileri bakış: ana iş parçacığı kısa süre takılsa da ritim bozulmaz
      this.playBeam(F, this.beam, this.next, step);
      this.beam = (this.beam + 1) % F.P.beams;
      this.next += step;
      if (this.beam === 0) {
        this.t0 = this.next; // tur başı yeniden hizala (hız değişirse kaymasın)
        const cb = this.onRevolution; if (cb) setTimeout(cb, Math.max(0, (this.next - engine.now) * 1000));
      }
    }
  }

  /** Bir ışın adımını çal. Yer, katman ya da zaman değişirse bir sonraki adım yeni veriyle çalar (kesinti olmaz). */
  playBeam(F: RadarFrame, b: number, when: number, step: number) {
    const { P } = F;
    if (b === 0) {
      engine.northTick(when); // yön referansı (kuzey) — veri değil; bilinçli tek istisna
      if (F.mode === 'hikaye') this.storyBed(F, when);
    }
    const events = beamEvents(F, b);
    for (const e of events) engine.voice(e.layerId, e.freq, when, step * e.durBeams, e.gain, e.pan);
    if (F.mode === 'hikaye') {
      // dalga sesi: yalnız hikâye modunda; düzeyi bu ışının denize düşen payı (veri yoksa 0 → sessiz)
      const sea = F.layers.find((l) => l.layer.id === 'sst');
      if (sea) engine.waves(groupMean(sea.vals, P, b, 1).cover); else engine.wavesOff();
    } else engine.wavesOff();
    const cb = this.onEvents;
    if (cb) setTimeout(() => cb(events, b), Math.max(0, (when - engine.now) * 1000));
  }

  /** Hikâye modu zemin akoru: ilk katmanın MERKEZ değerinden türeyen nota + beşlisi. Merkezde veri yoksa akor yok. */
  private storyBed(F: RadarFrame, when: number) {
    const first = F.layers[0];
    if (!first) return;
    const v = first.layer.sample(F.P.center);
    if (Number.isNaN(v)) return;
    const part = PARTS[first.layer.id];
    const root = noteHz(gainFor(v, first.layer, F.mode, first.local), { ...part, start: Math.max(0, part.start - 10) });
    engine.pad([root, root * 1.5], when, F.revSec);
  }

  /** Elle yön çevirme (←/→): o yöndeki yakın → orta → uzak değerler her katmanın enstrümanıyla üç nota olarak çalar. */
  playManual(F: RadarFrame, b: number, when: number) {
    const { P } = F;
    const third = Math.max(1, Math.round(P.rings / 3));
    const bands: [number, number][] = [[0, third], [third, P.rings - third], [P.rings - third, P.rings]];
    const pan = Math.sin(((b * 360) / P.beams) * (Math.PI / 180));
    for (const { layer, vals, local } of F.layers) {
      const part = PARTS[layer.id];
      bands.forEach(([k0, k1], i) => {
        const { mean } = groupMean(vals, P, b, 1, k0, k1);
        if (Number.isNaN(mean)) return; // veri yok → sessizlik
        const t = gainFor(mean, layer, F.mode, local);
        if (t < part.gate) return;
        engine.voice(layer.id, noteHz(t, part), when + i * 0.22, 0.4, t, pan);
      });
    }
  }
}
