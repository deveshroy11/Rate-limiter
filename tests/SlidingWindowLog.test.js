import { describe, it, expect } from 'vitest';
import { SlidingWindowLog } from '../src/algorithms/SlidingWindowLog.js';

describe('SlidingWindowLog', () => {
  function create(opts = {}) {
    let now = 10_000; // start at a nonzero time
    const clock = () => now;
    const tick = (ms) => { now += ms; };
    const limiter = new SlidingWindowLog({
      windowMs: opts.windowMs ?? 10_000,
      limit: opts.limit ?? 5,
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

  it('rejects after the limit is reached', () => {
    const { limiter } = create({ limit: 2 });
    limiter.consume('k');
    limiter.consume('k');
    const r = limiter.consume('k');
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it('entries expire after windowMs', () => {
    const { limiter, tick } = create({ windowMs: 5000, limit: 2 });
    limiter.consume('k');
    limiter.consume('k');
    expect(limiter.consume('k').allowed).toBe(false);

    // Advance past the window
    tick(5001);
    const r = limiter.consume('k');
    expect(r.allowed).toBe(true);
  });

  it('peek() returns the live log without consuming', () => {
    const { limiter } = create({ limit: 5 });
    limiter.consume('k');
    limiter.consume('k');
    const p1 = limiter.peek('k');
    expect(p1.count).toBe(2);
    expect(p1.log).toHaveLength(2);

    const p2 = limiter.peek('k');
    expect(p2.count).toBe(2); // unchanged
  });

  it('pruning removes only expired entries', () => {
    const { limiter, tick } = create({ windowMs: 10_000, limit: 5 });
    limiter.consume('k'); // t=10000
    tick(3000);
    limiter.consume('k'); // t=13000
    tick(3000);
    limiter.consume('k'); // t=16000

    // At t=16000, window covers [6000, 16000]. All 3 entries are inside.
    expect(limiter.peek('k').count).toBe(3);

    // Advance to t=20001 → window covers [10001, 20001]
    // Entry at t=10000 is now expired (10000 <= cutoff=10001)
    tick(4001);
    expect(limiter.peek('k').count).toBe(2);
  });

  it('supports custom cost', () => {
    const { limiter } = create({ limit: 5 });
    const r = limiter.consume('k', 3);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);

    const r2 = limiter.consume('k', 3);
    expect(r2.allowed).toBe(false);
  });

  it('reset() clears state', () => {
    const { limiter } = create({ limit: 2 });
    limiter.consume('k');
    limiter.consume('k');
    expect(limiter.consume('k').allowed).toBe(false);

    limiter.reset('k');
    expect(limiter.consume('k').allowed).toBe(true);
  });

  it('retryAfterMs is based on oldest entry expiry', () => {
    const { limiter } = create({ windowMs: 10_000, limit: 1 });
    limiter.consume('k'); // at t=10000
    const r = limiter.consume('k');
    expect(r.allowed).toBe(false);
    // Oldest entry at 10000 expires at 20000; now=10000 → retry in 10000ms
    expect(r.retryAfterMs).toBe(10_000);
  });

  it('rejects invalid constructor args', () => {
    expect(() => new SlidingWindowLog({ windowMs: 0, limit: 1 })).toThrow(RangeError);
    expect(() => new SlidingWindowLog({ windowMs: 1000, limit: 0 })).toThrow(RangeError);
  });
});
