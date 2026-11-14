// Radar zamanlayıcısı: ses saatine göre ileri bakışlı planlama (setInterval sadece uyandırır, zamanlama AudioContext'te).
// Radar bir adım sıralayıcı (step sequencer) gibi çalar: 32 ışın = 2 ölçü. Her katman bir enstrüman ve bir ritim rolüdür.
//
// KURAL (Adım 1): her nota bir veri değerinden üretilir (lib/radar.ts → beamEvents). Veri yoksa ses yok.
//  - Bilim modu: yalnızca veri notaları + kuzey işareti (yön referansı; veri değil, tek istisna).
//  - Hikâye modu: ayrıca merkez değerden türeyen zemin akoru ve deniz payına bağlı dalga sesi (ikisi de veriye bağlı).
// Adım 2: her tur LEAD adımlık bir referans bölümüyle başlar: merkezin değeri "referans" tınısıyla (karşılaştırmada A sonra B).
//  Sonra kuzey zili ve 32 ışınlık tarama. Her nota: perde + vuruş sayısı (1–3) + parlaklık, üçü de aynı değerden.
import { engine } from './engine.ts';
import { beamEvents, groupMean, noteHz, gainFor, PARTS, refEvents, registers, worldEvents, worldRefEvents, WORLD_BANDS, type FrameData, type SoundEvent } from '../lib/radar.ts';
import { WORLD_OF, worldParams, seedOf, WORLD_PART } from '../lib/worlds.ts';

export interface RadarFrame extends FrameData {
  revSec: number; // bir tur (32 ışın) süresi; referans bölümü bunun dışında
}

/** Tur başı referans bölümü (ışın adımı cinsinden). */
export const LEAD = 4;

export class RadarPlayer {
  private timer: number | undefined;
  private next = 0;   // sonraki adımın ses zamanı
  private pos = 0;    // 0..LEAD-1 referans bölümü, LEAD.. ışınlar
  private t0 = 0;     // 0. ışının (kuzey) ses zamanı — görsel açı hesabı için
  private get: () => RadarFrame | null;
  playing = false;
  /** Her tur tamamlandığında çağrılır — örn. zaman çizelgesini ilerletmek için. */
  onRevolution: (() => void) | null = null;
  /** Bir ışın adımı (ya da referans tonu) ÇALINDIĞI anda o adımın notaları — canlı gösterge için. beam = -1: referans. */
  onEvents: ((ev: SoundEvent[], beam: number) => void) | null = null;

  constructor(get: () => RadarFrame | null) { this.get = get; }

  /** fromBeam = 0: referans bölümüyle başla. Diğer: o ışından devam (hız değişimi). */
  start(fromBeam = 0) {
    const F = this.get();
    if (!F) return;
    engine.unlock();
    clearInterval(this.timer);
    const step = F.revSec / F.P.beams;
    this.pos = fromBeam === 0 ? 0 : LEAD + fromBeam;
    this.next = engine.now + 0.08;
    this.t0 = this.next + (LEAD - this.pos) * step;
    this.playing = true;
    this.timer = window.setInterval(() => this.tick(), 25);
    this.tick();
  }

  stop() {
    this.playing = false;
    clearInterval(this.timer);
    engine.wavesOff();
  }

  /** Şu anki ışın açısı (derece) — görsel için. Referans bölümünde kuzeyde bekler. */
  angle(): number {
    const F = this.get();
    if (!F) return 0;
    const f = (engine.now - this.t0) / F.revSec;
    return f < 0 || f >= 1 ? 0 : f * 360;
  }
  /** Şu anki ışın (hız değişiminde aynı yerden sürdürmek için). */
  beamNow(): number { const F = this.get(); return F ? Math.round((this.angle() / 360) * F.P.beams) % F.P.beams : 0; }

  private tick() {
    const F = this.get();
    if (!F) return;
    const step = F.revSec / F.P.beams;
    const cycle = LEAD + F.P.beams;
    // sekme arka planda kaldıysa (zamanlayıcı yavaşlar) geride kalan adımları atla; ses yığılmasın
    if (this.next < engine.now - 0.3) { this.next = engine.now + 0.05; this.t0 = this.next + (LEAD - this.pos) * step; }
    while (this.next < engine.now + 0.3) { // 0.3 sn ileri bakış: ana iş parçacığı kısa süre takılsa da ritim bozulmaz
      if (this.pos < LEAD) this.playLead(F, this.pos, this.next, step);
      else {
        if (this.pos === LEAD) this.t0 = this.next; // tur başı yeniden hizala (hız değişirse kaymasın)
        this.playBeam(F, this.pos - LEAD, this.next, step);
      }
      this.pos = (this.pos + 1) % cycle;
      this.next += step;
      if (this.pos === 0) { const cb = this.onRevolution; if (cb) setTimeout(cb, Math.max(0, (this.next - engine.now) * 1000)); }
    }
  }

  /** Referans bölümü: 1 referans → adım 0'da 3 adım boyu; 2 referans (A, B) → adım 0 ve 2'de, ikişer adım. */
  private playLead(F: RadarFrame, pos: number, when: number, step: number) {
    // ses dünyaları: merkez noktanın sesi (uzaklık 0 → en net). Karşılaştırmada A (adım 0) sonra B (adım 2).
    const wr = worldRefEvents(F);
    if (wr.length) {
      const tags = [...new Set(wr.map((e) => e.ref?.tag ?? ''))];
      const slot = tags.length > 1 ? 2 : LEAD;
      const tag = tags.length > 1 ? (pos === 0 ? tags[0] : pos === 2 ? tags[1] : null) : pos === 0 ? tags[0] : null;
      if (tag !== null) { const es = wr.filter((e) => (e.ref?.tag ?? '') === tag); for (const e of es) engine.world(e.params, when, step * slot * 0.95, 0, e.seed, engine.mix.vol[e.layerId] ?? 1); this.emit(es, -1, when); }
    }
    const refs = refEvents(F);
    if (!refs.length) return; // merkezde veri yok → referans yok (sessiz)
    const slot = refs.length > 1 ? 2 : 3;
    const i = pos / 2;
    const e = refs.length > 1 ? (pos % 2 === 0 ? refs[i] : undefined) : pos === 0 ? refs[0] : undefined;
    if (!e) return;
    engine.voice('ref', e.freq, when, step * slot * 0.85, e.gain, 0, e.bright);
    this.emit([e], -1, when);
  }

  /** Bir ışın adımını çal. Yer, katman ya da zaman değişirse bir sonraki adım yeni veriyle çalar (kesinti olmaz). */
  playBeam(F: RadarFrame, b: number, when: number, step: number) {
    const { P } = F;
    if (b === 0) {
      engine.northTick(when); // yön referansı (kuzey) — veri değil; bilinçli tek istisna
      if (F.mode === 'hikaye') this.storyBed(F, when);
    }
    const events = beamEvents(F, b);
    for (const e of events) {
      const slot = step * e.durBeams / e.hits; // ritim yoğunluğu: aynı süreye 1–3 vuruş
      for (let h = 0; h < e.hits; h++) engine.voice(e.layerId, e.freq, when + h * (step * e.durBeams) / e.hits, slot * (e.hits > 1 ? 0.8 : 1), e.gain, e.pan, e.bright);
    }
    if (F.mode === 'hikaye') {
      // dalga sesi: yalnız hikâye modunda; düzeyi bu ışının denize düşen payı (veri yoksa 0 → sessiz)
      const sea = F.layers.find((l) => l.layer.id === 'sst' && !WORLD_OF.sst); // okyanus artık ses dünyası (kendi dalgaları)
      if (sea) engine.waves(groupMean(sea.vals, P, b, 1).cover); else engine.wavesOff();
    } else engine.wavesOff();
    const wev = worldEvents(F, b);
    for (const e of wev) engine.world(e.params, when, step * e.durBeams, e.pan, e.seed, engine.mix.vol[e.layerId] ?? 1);
    this.emit([...events, ...wev], b, when);
  }

  private emit(events: SoundEvent[], b: number, when: number) {
    const cb = this.onEvents;
    if (cb) setTimeout(() => cb(events, b), Math.max(0, (when - engine.now) * 1000));
  }

  /** Hikâye modu zemin akoru: ilk katmanın MERKEZ değerinden türeyen nota + beşlisi, bir oktav pes. Merkezde veri yoksa akor yok. */
  private storyBed(F: RadarFrame, when: number) {
    const first = F.layers[0];
    if (!first) return;
    const v = first.layer.sample(F.P.center);
    if (Number.isNaN(v)) return;
    const reg = registers(F.layers.map((l) => l.layer.id))[0];
    const root = noteHz(gainFor(v, first.layer, F.scale ?? 'local', first.local), PARTS[first.layer.id], 'hikaye', Math.max(0, reg - 5));
    engine.pad([root, root * 1.5], when, F.revSec);
  }

  /** Elle yön çevirme (←/→): o yöndeki yakın → orta → uzak değerler her katmanın enstrümanıyla üç nota olarak çalar. */
  playManual(F: RadarFrame, b: number, when: number) {
    const { P } = F;
    const third = Math.max(1, Math.round(P.rings / 3));
    const bands: [number, number][] = [[0, third], [third, P.rings - third], [P.rings - third, P.rings]];
    const pan = Math.sin(((b * 360) / P.beams) * (Math.PI / 180));
    const regs = registers(F.layers.map((l) => l.layer.id));
    F.layers.forEach(({ layer, vals, local }, li) => {
      const world = WORLD_OF[layer.id];
      if (world) { // ses dünyası: yakın → orta → uzak, sırayla
        WORLD_BANDS.forEach(([r0, r1, dist], i) => {
          const { mean } = groupMean(vals, P, b, 1, Math.round(r0 * P.rings), Math.max(Math.round(r0 * P.rings) + 1, Math.round(r1 * P.rings)));
          if (Number.isNaN(mean)) return;
          const t = gainFor(mean, layer, 'global'); if (WORLD_PART[world].gate > 0 && t < WORLD_PART[world].gate) return;
          engine.world(worldParams(world, mean, t, dist), when + i * 0.45, 0.6, pan, seedOf(layer.id, 'm', b, i, Math.round(mean * 1000)), engine.mix.vol[layer.id] ?? 1);
        });
        return;
      }
      const part = PARTS[layer.id];
      bands.forEach(([k0, k1], i) => {
        const { mean } = groupMean(vals, P, b, 1, k0, k1);
        if (Number.isNaN(mean)) return; // veri yok → sessizlik
        if (part.gate > 0 && gainFor(mean, layer, 'global') < part.gate) return;
        const t = gainFor(mean, layer, F.scale ?? 'local', local);
        engine.voice(layer.id, noteHz(t, part, F.mode, regs[li]), when + i * 0.22, 0.4, t, pan, t);
      });
    });
  }
}
