// Lightweight synthesized audio (no sound files to download — good for Android).
import type { Settings } from './types';

class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  windGain: GainNode | null = null;
  windFilter: BiquadFilterNode | null = null;
  rubGain: GainNode | null = null;
  noise: AudioBuffer | null = null;
  volume = 0.7;
  sfx = true;
  windOn = true;
  started = false;

  configure(s: Partial<Settings>) {
    if (typeof s.volume === 'number') this.volume = s.volume;
    if (typeof s.sfx === 'boolean') this.sfx = s.sfx;
    if (typeof s.windSound === 'boolean') this.windOn = s.windSound;
    if (this.master) this.master.gain.value = this.volume;
    if (!this.windOn) this.setWind(0);
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();
    } catch {
      return;
    }
    const c = this.ctx!;
    this.master = c.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(c.destination);
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02; // brown-ish noise
      d[i] = last * 3.5;
    }
  }

  private startLoops() {
    if (this.started || !this.ctx || !this.noise || !this.master) return;
    this.started = true;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    this.windFilter = c.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 500;
    this.windGain = c.createGain();
    this.windGain.gain.value = 0;
    src.connect(this.windFilter).connect(this.windGain).connect(this.master);
    src.start();

    const src2 = c.createBufferSource();
    src2.buffer = this.noise;
    src2.loop = true;
    src2.playbackRate.value = 3;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 3;
    this.rubGain = c.createGain();
    this.rubGain.gain.value = 0;
    src2.connect(bp).connect(this.rubGain).connect(this.master);
    src2.start();
  }

  /** 0..1 wind intensity */
  setWind(level: number) {
    if (!this.ctx) return;
    this.startLoops();
    if (!this.windGain || !this.windFilter) return;
    const t = this.ctx.currentTime;
    const v = this.windOn ? Math.max(0, Math.min(1, level)) : 0;
    this.windGain.gain.setTargetAtTime(v * 0.35, t, 0.3);
    this.windFilter.frequency.setTargetAtTime(300 + v * 900, t, 0.3);
  }

  /** string rubbing sound while strings are crossed */
  setRub(on: boolean) {
    if (!this.ctx) return;
    this.startLoops();
    if (!this.rubGain) return;
    this.rubGain.gain.setTargetAtTime(on && this.sfx ? 0.25 : 0, this.ctx.currentTime, 0.05);
  }

  stopLoops() {
    this.setWind(0);
    this.setRub(false);
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, delay = 0, slideTo?: number) {
    if (!this.ctx || !this.master || !this.sfx) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private burst(dur: number, freq: number, vol = 0.4, delay = 0, type: BiquadFilterType = 'highpass') {
    if (!this.ctx || !this.master || !this.noise || !this.sfx) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = 4;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  click() {
    this.tone(660, 0.06, 'triangle', 0.12);
  }
  beep() {
    this.tone(520, 0.18, 'square', 0.12);
  }
  start() {
    this.tone(784, 0.14, 'square', 0.15);
    this.tone(1046, 0.5, 'square', 0.15, 0.14);
    this.burst(0.5, 800, 0.15, 0.1, 'bandpass');
  }
  twang() {
    this.tone(180, 0.25, 'triangle', 0.15, 0, 120);
  }
  snap() {
    this.burst(0.18, 2500, 0.6);
    this.tone(1400, 0.35, 'sawtooth', 0.12, 0.02, 200);
  }
  gust() {
    if (!this.ctx || !this.master || !this.noise || !this.sfx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(250, t);
    f.frequency.exponentialRampToValueAtTime(1600, t + 0.8);
    f.frequency.exponentialRampToValueAtTime(300, t + 1.6);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + 1.8);
  }
  win() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.2, i * 0.12));
    this.tone(1318, 0.8, 'triangle', 0.16, 0.5);
  }
  lose() {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.4, 'sine', 0.2, i * 0.18));
  }
  coin() {
    this.tone(988, 0.08, 'square', 0.1);
    this.tone(1319, 0.25, 'square', 0.1, 0.08);
  }
}

export const audio = new AudioEngine();
