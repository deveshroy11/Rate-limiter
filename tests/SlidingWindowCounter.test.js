import { describe, it, expect } from 'vitest';
import { SlidingWindowCounter } from '../src/algorithms/SlidingWindowCounter.js';

describe('SlidingWindowCounter', () => {
  function create(opts = {}) {
    let now = 0;
    const clock = () => now;
    const tick = (ms) => { now += ms; };
    const limiter = new SlidingWindowCounter({
      windowMs: opts.windowMs ?? 10_000,
      limit: opts.limit ?? 10,
      clock,
    });
    return { limiter, tick };
  }

  it('allows requests up to the limit', () => {
    const { limiter } = create({ limit: 3 });
    expect(limiter.consume('k').allowed).toBe(true);
    expect(limiter.consume('k').allowed).toBe(true);
    expect(limiter.consume('k').allowed).toBe(true);
  });

  it('rejects after the limit', () => {
    const { limiter } = create({ limit: 2 });
    limiter.consume('k');
    limiter.consume('k');
    const r = limiter.consume('k');
    expect(r.allowed).toBe(false);
  });

  it('weighted estimate blends previous and current window', () => {
    const { limiter, tick } = create({ windowMs: 10_000, limit: 10 });
    // Fill up 8 in the first window
    for (let i = 0; i < 8; i++) limiter.consume('k');

    // Advance to 50% into the next window
    tick(15_000);
    // prev=8, weight=0.5, curr=0 → estimate=4
    const p = limiter.peek('k');
    expect(p.prevCount).toBe(8);
    expect(p.weight).toBeCloseTo(0.5, 1);
    expect(p.estimated).toBeCloseTo(4, 0);

    // Should allow more requests since estimate is 4, limit is 10
    expect(limiter.consume('k').allowed).toBe(true);
  });

  it('window rollover: current becomes previous', () => {
    const { limiter, tick } = create({ windowMs: 10_000, limit: 10 });
    for (let i = 0; i < 5; i++) limiter.consume('k');
    tick(10_000); // roll over
    const p = limiter.peek('k');
    expect(p.prevCount).toBe(5);
    expect(p.currCount).toBe(0);
  });

  it('two+ windows elapsed clears both counters', () => {
    const { limiter, tick } = create({ windowMs: 10_000, limit: 10 });
    for (let i = 0; i < 5; i++) limiter.consume('k');
    tick(25_000); // >2 windows
    const p = limiter.peek('k');
    expect(p.prevCount).toBe(0);
    expect(p.currCount).toBe(0);
  });

  it('peek() exposes counters and weight', () => {
    const { limiter } = create({ limit: 10 });
    limiter.consume('k');
    const p = limiter.peek('k');
    expect(p).toHaveProperty('prevCount');
    expect(p).toHaveProperty('currCount');
    expect(p).toHaveProperty('weight');
    expect(p).toHaveProperty('estimated');
    expect(p).toHaveProperty('limit');
    expect(p).toHaveProperty('windowMs');
  });

  it('reset() clears state', () => {
    const { limiter } = create({ limit: 2 });
    limiter.consume('k');
    limiter.consume('k');
    expect(limiter.consume('k').allowed).toBe(false);
    limiter.reset('k');
    expect(limiter.consume('k').allowed).toBe(true);
  });

  it('rejects invalid constructor args', () => {
    expect(() => new SlidingWindowCounter({ windowMs: 0, limit: 1 })).toThrow(RangeError);
    expect(() => new SlidingWindowCounter({ windowMs: 1000, limit: -1 })).toThrow(RangeError);
  });
});
