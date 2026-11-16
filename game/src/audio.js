// audio.js — NEONFALL's synthesized sound: WebAudio effects and a
// procedural bass/arp music loop. No audio files; every sound is an
// oscillator or a filtered noise burst shaped by an envelope.
//
// The context is created lazily and only resumed after a user gesture
// (start click / keypress), as browsers require. In screenshot poses the
// game never unlocks audio, so poses stay silent.

const BASS_LINE = [0, 0, 7, 0, 5, 0, 3, 2]; // semitone offsets over A minor
const ARP_NOTES = [0, 3, 7, 12, 7, 3, 12, 15];
const ROOT_HZ = 55; // A1

export class SoundFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.muted = false;
    this.musicTimer = null;
    this.step = 0;
    this.throttles = new Map();
  }

  // Create/resume the context. Call from a user-gesture handler.
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.34;
      this.musicGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
  }

  // --- tiny synth helpers -------------------------------------------------

  tone({ freq, freqEnd = null, type = 'square', dur = 0.12, vol = 0.2, when = 0, music = false }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(music ? this.musicGain : this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.1, vol = 0.2, freq = 1200, when = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(t0);
  }

  // Rate-limit a named effect so a busy frame cannot stack 40 copies.
  throttled(name, ms, fn) {
    const now = performance.now();
    if (now - (this.throttles.get(name) ?? 0) < ms) return;
    this.throttles.set(name, now);
    fn();
  }

  // --- game effects --------------------------------------------------------

  shoot() {
    this.throttled('shoot', 45, () => this.tone({ freq: 880, freqEnd: 320, type: 'square', dur: 0.07, vol: 0.05 }));
  }

  lance() {
    this.throttled('lance', 80, () => this.tone({ freq: 1400, freqEnd: 200, type: 'sawtooth', dur: 0.14, vol: 0.07 }));
  }

  hit() {
    this.throttled('hit', 40, () => this.noise({ dur: 0.05, vol: 0.08, freq: 2400 }));
  }

  enemyDie() {
    this.throttled('die', 50, () => this.tone({ freq: 420, freqEnd: 60, type: 'triangle', dur: 0.16, vol: 0.12 }));
  }

  pickup(combo) {
    const step = Math.min(combo, 12);
    this.tone({ freq: 620 * Math.pow(1.059, step), type: 'sine', dur: 0.08, vol: 0.09 });
  }

  levelUp() {
    [523, 659, 784, 1047].forEach((freq, i) =>
      this.tone({ freq, type: 'triangle', dur: 0.16, vol: 0.14, when: i * 0.07 }));
  }

  hurt() {
    this.tone({ freq: 160, freqEnd: 50, type: 'sawtooth', dur: 0.22, vol: 0.22 });
    this.noise({ dur: 0.15, vol: 0.12, freq: 300 });
  }

  nova() {
    this.tone({ freq: 200, freqEnd: 900, type: 'sine', dur: 0.25, vol: 0.16 });
  }

  bossWarn() {
    [0, 0.18, 0.36].forEach((when) =>
      this.tone({ freq: 196, type: 'square', dur: 0.14, vol: 0.16, when }));
  }

  bossDie() {
    this.noise({ dur: 0.6, vol: 0.3, freq: 500 });
    [392, 523, 659, 784].forEach((freq, i) =>
      this.tone({ freq, type: 'triangle', dur: 0.3, vol: 0.16, when: i * 0.09 }));
  }

  gameOver() {
    [440, 349, 262, 196].forEach((freq, i) =>
      this.tone({ freq, type: 'triangle', dur: 0.3, vol: 0.16, when: i * 0.16 }));
  }

  // --- procedural music -----------------------------------------------------

  startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    this.step = 0;
    this.musicTimer = setInterval(() => this.scheduleStep(), 150);
  }

  stopMusic() {
    if (this.musicTimer !== null) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  scheduleStep() {
    if (!this.ctx || this.muted) return;
    const step = this.step++;
    const bar = Math.floor(step / 8) % 4;
    const root = ROOT_HZ * Math.pow(2, (bar === 3 ? -4 : 0) / 12);
    if (step % 2 === 0) {
      const semi = BASS_LINE[(step / 2) % 8];
      this.tone({ freq: root * 2 * Math.pow(2, semi / 12), type: 'triangle', dur: 0.26, vol: 0.30, music: true });
    }
    const arpSemi = ARP_NOTES[step % 8] + (bar === 2 ? 5 : 0);
    this.tone({ freq: root * 8 * Math.pow(2, arpSemi / 12), type: 'square', dur: 0.1, vol: 0.045, music: true });
    if (step % 16 === 0) this.noiseHat();
  }

  noiseHat() {
    // A soft high hat on the bar, routed quietly through the music gain.
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const length = Math.floor(this.ctx.sampleRate * 0.03);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.05, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.03);
    source.connect(filter).connect(gain).connect(this.musicGain);
    source.start(t0);
  }
}
