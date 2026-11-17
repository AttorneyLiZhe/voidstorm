// A small deterministic random source (mulberry32). The world draws every random number from
// one of these, seeded per run, so a screenshot scene or a replay of the same seed always
// unfolds the same way, while live play seeds from the clock.

export class Random {
  constructor(seed) {
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  /** Next float in [0, 1). */
  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in [min, max). */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max], both ends included. */
  int(min, max) {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with probability `p`. */
  chance(p) {
    return this.next() < p;
  }

  /** A random element of `list`. */
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }

  /** Angle in radians, anywhere on the circle. */
  angle() {
    return this.next() * Math.PI * 2;
  }
}
