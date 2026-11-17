// All sound is synthesized with WebAudio — no audio files, nothing to load. A tiny engine of
// oscillators and filtered noise gives shots, impacts, pickups and the level-up chime, plus a
// slow bass-and-pulse music bed that sits under the action. Everything is best-effort: if the
// browser refuses an AudioContext the game simply plays silent.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  /** Create the context on the first user gesture (browsers refuse it any earlier). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startMusic();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.setValueAtTime(muted ? 0 : 0.5, this.ctx.currentTime);
  }

  tone({ freq = 440, freqEnd = null, type = 'square', seconds = 0.12, volume = 0.2, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + seconds);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.02);
  }

  noise({ seconds = 0.25, volume = 0.3, freq = 900, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const frames = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(t0);
  }

  shoot() {
    this.tone({ freq: 880, freqEnd: 220, type: 'square', seconds: 0.07, volume: 0.055 });
  }

  enemyHit() {
    this.tone({ freq: 300, freqEnd: 160, type: 'sawtooth', seconds: 0.05, volume: 0.05 });
  }

  explosion(big = false) {
    this.noise({ seconds: big ? 0.5 : 0.22, volume: big ? 0.5 : 0.22, freq: big ? 500 : 800 });
    this.tone({ freq: big ? 120 : 180, freqEnd: 40, type: 'triangle', seconds: big ? 0.45 : 0.2, volume: 0.25 });
  }

  playerHurt() {
    this.tone({ freq: 200, freqEnd: 70, type: 'sawtooth', seconds: 0.18, volume: 0.22 });
    this.noise({ seconds: 0.12, volume: 0.15, freq: 1200 });
  }

  shieldBreak() {
    this.tone({ freq: 1200, freqEnd: 300, type: 'sine', seconds: 0.22, volume: 0.2 });
  }

  pickup(combo = 0) {
    const base = 620 + Math.min(combo, 12) * 40;
    this.tone({ freq: base, freqEnd: base * 1.5, type: 'sine', seconds: 0.08, volume: 0.07 });
  }

  levelUp() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((freq, i) => this.tone({ freq, type: 'triangle', seconds: 0.16, volume: 0.16, delay: i * 0.07 }));
  }

  waveHorn() {
    this.tone({ freq: 196, type: 'sawtooth', seconds: 0.3, volume: 0.14 });
    this.tone({ freq: 294, type: 'sawtooth', seconds: 0.3, volume: 0.12, delay: 0.05 });
  }

  bossAlarm() {
    for (let i = 0; i < 3; i += 1) {
      this.tone({ freq: 440, freqEnd: 440, type: 'square', seconds: 0.12, volume: 0.12, delay: i * 0.22 });
      this.tone({ freq: 349, freqEnd: 349, type: 'square', seconds: 0.12, volume: 0.12, delay: i * 0.22 + 0.11 });
    }
  }

  gameOver() {
    const notes = [392, 330, 262, 196];
    notes.forEach((freq, i) => this.tone({ freq, type: 'triangle', seconds: 0.3, volume: 0.16, delay: i * 0.16 }));
  }

  uiClick() {
    this.tone({ freq: 700, freqEnd: 900, type: 'sine', seconds: 0.06, volume: 0.1 });
  }

  /** A slow minor-key pulse: bass on the beat, a soft pluck pattern over the top. */
  startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    const bassLine = [55, 55, 65.4, 55, 55, 82.4, 73.4, 49];
    const pluckLine = [220, 0, 261.6, 0, 329.6, 0, 261.6, 196];
    this.musicTimer = window.setInterval(() => {
      if (this.muted || !this.ctx) return;
      const step = this.musicStep % 8;
      this.musicStep += 1;
      this.tone({ freq: bassLine[step], type: 'triangle', seconds: 0.34, volume: 0.11 });
      const pluck = pluckLine[step];
      if (pluck) this.tone({ freq: pluck, type: 'sine', seconds: 0.18, volume: 0.045 });
    }, 340);
  }
}
