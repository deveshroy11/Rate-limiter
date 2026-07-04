import { describe, it, expect } from 'vitest';
import { TokenBucket } from '../src/algorithms/TokenBucket.js';

describe('TokenBucket', () => {
  /** Helper: creates a bucket with a controllable clock */
  function create(opts = {}) {
    let now = 0;
    const clock = () => now;
    const tick = (ms) => { now += ms; };
    const bucket = new TokenBucket({
      capacity: opts.capacity ?? 10,
      refillRatePerSec: opts.refillRatePerSec ?? 2,
      clock,
    });
    return { bucket, tick, clock };
  }

  it('allows requests within capacity', () => {
    const { bucket } = create();
    for (let i = 0; i < 10; i++) {
      const r = bucket.consume('k');
      expect(r.allowed).toBe(true);
    }
  });

  it('rejects when bucket is empty', () => {
    const { bucket } = create({ capacity: 3 });
    bucket.consume('k');
    bucket.consume('k');
    bucket.consume('k');
    const r = bucket.consume('k');
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it('refills tokens over time', () => {
    const { bucket, tick } = create({ capacity: 5, refillRatePerSec: 5 });
    // Drain all 5
    for (let i = 0; i < 5; i++) bucket.consume('k');
    expect(bucket.consume('k').allowed).toBe(false);

    // Wait 1 second → 5 tokens refilled
    tick(1000);
    const r = bucket.consume('k');
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(4);
  });

  it('caps refill at capacity', () => {
    const { bucket, tick } = create({ capacity: 5, refillRatePerSec: 10 });
    bucket.consume('k'); // 4 tokens
    tick(10_000); // Would refill 100, but cap is 5
    const p = bucket.peek('k');
    expect(p.tokens).toBe(5);
  });

  it('calculates retryAfterMs correctly', () => {
    const { bucket } = create({ capacity: 1, refillRatePerSec: 1 });
    bucket.consume('k'); // 0 left
    const r = bucket.consume('k');
    expect(r.allowed).toBe(false);
    // Need 1 token at 1/sec → 1000ms
    expect(r.retryAfterMs).toBe(1000);
  });

  it('peek() reads level without consuming', () => {
    const { bucket } = create({ capacity: 10 });
    bucket.consume('k'); // 9 left
    const p1 = bucket.peek('k');
    const p2 = bucket.peek('k');
    expect(p1.tokens).toBe(9);
    expect(p2.tokens).toBe(9); // unchanged
  });

  it('reset() clears state for a key', () => {
    const { bucket } = create({ capacity: 5 });
    for (let i = 0; i < 5; i++) bucket.consume('k');
    expect(bucket.consume('k').allowed).toBe(false);

    bucket.reset('k');
    const r = bucket.consume('k');
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(4);
  });

  it('supports custom cost', () => {
    const { bucket } = create({ capacity: 10 });
    const r = bucket.consume('k', 7);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(3);

    const r2 = bucket.consume('k', 5);
    expect(r2.allowed).toBe(false);
  });

  it('isolates keys from each other', () => {
    const { bucket } = create({ capacity: 2 });
    bucket.consume('a');
    bucket.consume('a');
    expect(bucket.consume('a').allowed).toBe(false);
    expect(bucket.consume('b').allowed).toBe(true); // 'b' is independent
  });

  it('rejects invalid constructor args', () => {
    expect(() => new TokenBucket({ capacity: 0, refillRatePerSec: 1 })).toThrow(RangeError);
    expect(() => new TokenBucket({ capacity: 1, refillRatePerSec: -1 })).toThrow(RangeError);
  });
});
