/**
 * Token Bucket Rate Limiter
 *
 * Tokens refill continuously at `refillRatePerSec` up to `capacity`.
 * Each request costs `cost` tokens (default 1); allowed if the bucket
 * has enough tokens. Supports clock injection for deterministic testing.
 *
 * @example
 *   const bucket = new TokenBucket({ capacity: 10, refillRatePerSec: 2 });
 *   const result = bucket.consume('user:42');
 *   // { allowed: true, remaining: 9, limit: 10, retryAfterMs: 0, resetAt: ... }
 */
export class TokenBucket {
  /**
   * @param {object} options
   * @param {number} options.capacity        — Maximum tokens the bucket can hold.
   * @param {number} options.refillRatePerSec — Tokens added per second.
   * @param {function} [options.clock]        — Injectable clock; defaults to Date.now.
   */
  constructor({ capacity, refillRatePerSec, clock = Date.now }) {
    if (capacity <= 0) throw new RangeError('capacity must be > 0');
    if (refillRatePerSec <= 0) throw new RangeError('refillRatePerSec must be > 0');

    this.capacity = capacity;
    this.refillRatePerSec = refillRatePerSec;
    this.clock = clock;

    /** @type {Map<string, { tokens: number, lastRefill: number }>} */
    this._buckets = new Map();
  }

  /**
   * Lazily initialise or retrieve a bucket, refilling tokens based on
   * elapsed time since the last access.
   * @param {string} key
   * @returns {{ tokens: number, lastRefill: number }}
   */
  _getOrCreate(key) {
    const now = this.clock();

    if (!this._buckets.has(key)) {
      const bucket = { tokens: this.capacity, lastRefill: now };
      this._buckets.set(key, bucket);
      return bucket;
    }

    const bucket = this._buckets.get(key);
    const elapsedSec = (now - bucket.lastRefill) / 1000;

    if (elapsedSec > 0) {
      bucket.tokens = Math.min(
        this.capacity,
        bucket.tokens + elapsedSec * this.refillRatePerSec,
      );
      bucket.lastRefill = now;
    }

    return bucket;
  }

  /**
   * Attempt to consume `cost` tokens from the bucket identified by `key`.
   *
   * @param {string} key  — Unique identifier (e.g. IP address, user ID).
   * @param {number} [cost=1] — Number of tokens this request costs.
   * @returns {{ allowed: boolean, remaining: number, limit: number, retryAfterMs: number, resetAt: number }}
   */
  consume(key, cost = 1) {
    const bucket = this._getOrCreate(key);
    const now = this.clock();

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        limit: this.capacity,
        retryAfterMs: 0,
        resetAt: now + Math.ceil(((this.capacity - bucket.tokens) / this.refillRatePerSec) * 1000),
      };
    }

    // Not enough tokens — calculate exact wait time
    const deficit = cost - bucket.tokens;
    const retryAfterMs = Math.ceil((deficit / this.refillRatePerSec) * 1000);

    return {
      allowed: false,
      remaining: Math.floor(bucket.tokens),
      limit: this.capacity,
      retryAfterMs,
      resetAt: now + Math.ceil((this.capacity / this.refillRatePerSec) * 1000),
    };
  }

  /**
   * Read the current token level without consuming any tokens.
   * @param {string} key
   * @returns {{ tokens: number, capacity: number, refillRatePerSec: number }}
   */
  peek(key) {
    const bucket = this._getOrCreate(key);
    return {
      tokens: Math.floor(bucket.tokens),
      capacity: this.capacity,
      refillRatePerSec: this.refillRatePerSec,
    };
  }

  /**
   * Remove all state for `key`, as if it were never seen.
   * @param {string} key
   */
  reset(key) {
    this._buckets.delete(key);
  }
}
