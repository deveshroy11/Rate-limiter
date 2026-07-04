import { describe, it, expect } from 'vitest';
import { FixedWindow } from '../src/algorithms/FixedWindow.js';

describe('FixedWindow', () => {
  function create(opts = {}) {
    let now = 0;
    const clock = () => now;
    const tick = (ms) => { now += ms; };
    const limiter = new FixedWindow({
      windowMs: opts.windowMs ?? 10_000,
      limit: opts.limit ?? 5,
      clock,
    });
    return { limiter, tick };
  }

  it('allows requests up to the limit per window', () => {
    const { limiter } = create({ limit: 3 });
    expect(limiter.consume('k').allowed).toBe(true);
    expect(limiter.consume('k').allowed).toBe(true);
    expect(limiter.consume('k').allowed).toBe(true);
    expect(limiter.consume('k').allowed).toBe(false);
  });

  it('resets counter at window boundary', () => {
    const { limiter, tick } = create({ limit: 2, windowMs: 5000 });
    limiter.consume('k');
    limiter.consume('k');
    expect(limiter.consume('k').allowed).toBe(false);

    tick(5000); // new window
    const r = limiter.consume('k');
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(1);
  });

  it('documents boundary-burst behavior (not a bug)', () => {
    // Requests at end of window + start of next window = 2× limit in short span
    const { limiter, tick } = create({ limit: 5, windowMs: 10_000 });

    // At t=9999 (end of window), use all 5
    tick(9999);
    for (let i = 0; i < 5; i++) limiter.consume('k');

    // At t=10000 (start of next window), can use all 5 again
    tick(1);
    for (let i = 0; i < 5; i++) {
      expect(limiter.consume('k').allowed).toBe(true);
    }
    // 10 requests in 1ms — this is the known boundary-burst tradeoff
  });

  it('peek() returns count, limit, remaining, and msUntilReset', () => {
    const { limiter } = create({ limit: 5, windowMs: 10_000 });
    limiter.consume('k');
    limiter.consume('k');
    const p = limiter.peek('k');
    expect(p.count).toBe(2);
    expect(p.limit).toBe(5);
    expect(p.remaining).toBe(3);
    expect(p.msUntilReset).toBe(10_000);
  });

  it('retryAfterMs is time until window reset', () => {
    const { limiter, tick } = create({ limit: 1, windowMs: 10_000 });
    limiter.consume('k');
    tick(3000); // 3s into window
    const r = limiter.consume('k');
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBe(7000);
  });

  it('reset() clears state', () => {
    const { limiter } = create({ limit: 1 });
    limiter.consume('k');
    expect(limiter.consume('k').allowed).toBe(false);
    limiter.reset('k');
    expect(limiter.consume('k').allowed).toBe(true);
  });

  it('supports custom cost', () => {
    const { limiter } = create({ limit: 5 });
    const r = limiter.consume('k', 3);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);

    const r2 = limiter.consume('k', 3);
    expect(r2.allowed).toBe(false);
  });

  it('isolates keys', () => {
    const { limiter } = create({ limit: 1 });
    limiter.consume('a');
    expect(limiter.consume('a').allowed).toBe(false);
    expect(limiter.consume('b').allowed).toBe(true);
  });

  it('rejects invalid constructor args', () => {
    expect(() => new FixedWindow({ windowMs: -1, limit: 1 })).toThrow(RangeError);
    expect(() => new FixedWindow({ windowMs: 1000, limit: 0 })).toThrow(RangeError);
  });
});
