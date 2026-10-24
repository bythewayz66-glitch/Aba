export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.ambient = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.startAmbience();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.08);
  }

  startAmbience() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.012 * white) / 1.012;
      data[i] = last * 2.6;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.value = 0.028;
    noise.connect(filter).connect(gain).connect(this.master);
    noise.start();
    this.ambient = { noise, gain, filter };

    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 55;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.018;
    drone.connect(droneGain).connect(this.master);
    drone.start();
  }

  tone(freq, dur, type = 'sine', vol = 0.12, slide = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  noiseBurst(dur = 0.14, vol = 0.1, cutoff = 1200) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const size = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
  }

  bow() {
    this.tone(680, 0.16, 'triangle', 0.08, -420);
    this.noiseBurst(0.08, 0.04, 2200);
  }

  sword() {
    this.noiseBurst(0.1, 0.09, 900);
    this.tone(150, 0.12, 'sawtooth', 0.06, -70);
  }

  hit() {
    this.noiseBurst(0.08, 0.08, 500);
    this.tone(95, 0.1, 'square', 0.05, -40);
  }

  coin() {
    this.tone(880, 0.07, 'triangle', 0.07);
    setTimeout(() => this.tone(1320, 0.09, 'triangle', 0.06), 55);
  }

  quest() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => setTimeout(() => this.tone(n, 0.32, 'triangle', 0.07), i * 110));
  }

  level() {
    const notes = [392, 523, 659, 784, 1046, 1318];
    notes.forEach((n, i) => setTimeout(() => this.tone(n, 0.4, 'sine', 0.06), i * 90));
  }

  mount() {
    this.tone(260, 0.18, 'sawtooth', 0.05, 220);
    setTimeout(() => this.tone(520, 0.2, 'triangle', 0.04, 160), 80);
  }

  hurt() {
    this.tone(180, 0.2, 'sawtooth', 0.07, -90);
    this.noiseBurst(0.12, 0.06, 340);
  }

  ability() {
    this.tone(320, 0.3, 'sine', 0.07, 500);
    this.noiseBurst(0.2, 0.04, 1800);
  }

  boss() {
    this.tone(70, 0.8, 'sawtooth', 0.01, 20);
    this.noiseBurst(0.5, 0.06, 180);
  }

  death() {
    this.tone(220, 0.7, 'triangle', 0.08, -160);
  }
}
