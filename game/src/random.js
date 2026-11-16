// random.js — a small deterministic random-number toolkit.
//
// Every random choice in NEONFALL flows through one of these generators
// (mulberry32), never through Math.random. Normal play seeds it from the
// clock; the screenshot poses seed it from the ?seed= parameter, so a pose
// plays out identically on every load.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed) {
    this.next = mulberry32(seed);
  }

  // Float in [min, max).
  range(min, max) {
    return min + this.next() * (max - min);
  }

  // Integer in [min, max] inclusive.
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  // True with probability p.
  chance(p) {
    return this.next() < p;
  }

  // Random element of an array.
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }

  // Random unit vector {x, y}.
  direction() {
    const angle = this.next() * Math.PI * 2;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  }
}
