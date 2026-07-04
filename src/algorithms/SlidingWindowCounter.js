/**
 * Sliding Window Counter Rate Limiter
 *
 * Keeps only two counters: current window's count and the previous window's
 * count. Estimates the sliding-window rate as:
 *
 *   previousCount × weightOfPrevious + currentCount
 *
 * where weight decays linearly as the current window progresses.
 * O(1) memory, near-exact accuracy, no boundary burst.
 *
 * @example
 *   const limiter = new SlidingWindowCounter({ windowMs: 60_000, limit: 100 });
 *   const result = limiter.consume('user:42');
 */
export class SlidingWindowCounter {
  /**
   * @param {object} options
   * @param {number} options.windowMs — Window duration in milliseconds.
   * @param {number} options.limit    — Maximum estimated requests per window.
   * @param {function} [options.clock] — Injectable clock; defaults to Date.now.
   */
  constructor({ windowMs, limit, clock = Date.now }) {
    if (windowMs <= 0) throw new RangeError('windowMs must be > 0');
    if (limit <= 0) throw new RangeError('limit must be > 0');

    this.windowMs = windowMs;
    this.limit = limit;
    this.clock = clock;

    /**
     * @type {Map<string, { prevCount: number, currCount: number, windowStart: number }>}
     */
    this._counters = new Map();
  }

  /**
   * Advance the window for `key` if necessary, rolling current → previous.
   * @param {string} key
   * @returns {{ prevCount: number, currCount: number, windowStart: number }}
   */
  _advance(key) {
    const now = this.clock();

    if (!this._counters.has(key)) {
      const windowStart = now - (now % this.windowMs); // align to window boundary
      const counter = { prevCount: 0, currCount: 0, windowStart };
      this._counters.set(key, counter);
      return counter;
    }

    const counter = this._counters.get(key);

    // How many full windows have elapsed since windowStart?
    const elapsed = now - counter.windowStart;

    if (elapsed >= 2 * this.windowMs) {
      // Two or more windows passed — both counters are stale
      counter.prevCount = 0;
      counter.currCount = 0;
      counter.windowStart = now - (now % this.windowMs);
    } else if (elapsed >= this.windowMs) {
      // Exactly one window rolled over
      counter.prevCount = counter.currCount;
      counter.currCount = 0;
      counter.windowStart += this.windowMs;
    }

    return counter;
  }

  /**
   * Compute the weighted estimate of the current sliding window count.
   * @param {{ prevCount: number, currCount: number, windowStart: number }} counter
   * @returns {number}
   */
  _estimate(counter) {
    const now = this.clock();
    const elapsedInWindow = now - counter.windowStart;
    const weight = Math.max(0, 1 - elapsedInWindow / this.windowMs);
    return counter.prevCount * weight + counter.currCount;
  }

  /**
   * Attempt to record `cost` request(s) for `key`.
   *
   * @param {string} key
   * @param {number} [cost=1]
   * @returns {{ allowed: boolean, remaining: number, limit: number, retryAfterMs: number, resetAt: number }}
   */
  consume(key, cost = 1) {
    const counter = this._advance(key);
    const now = this.clock();
    const estimated = this._estimate(counter);

    if (estimated + cost <= this.limit) {
      counter.currCount += cost;
      const newEstimate = this._estimate(counter);
      return {
        allowed: true,
        remaining: Math.max(0, Math.floor(this.limit - newEstimate)),
        limit: this.limit,
        retryAfterMs: 0,
        resetAt: counter.windowStart + this.windowMs,
      };
    }

    // Denied — estimate when enough capacity will free up
    // The weight of prevCount decreases linearly; we need:
    //   prevCount * (1 - t/windowMs) + currCount + cost <= limit
    // Solving for t (ms into current window):
    const retryAfterMs = counter.prevCount > 0
      ? Math.ceil(
          ((counter.prevCount - (this.limit - counter.currCount - cost)) / counter.prevCount) *
            this.windowMs -
            (now - counter.windowStart),
        )
      : Math.ceil(counter.windowStart + this.windowMs - now);

    return {
      allowed: false,
      remaining: Math.max(0, Math.floor(this.limit - estimated)),
      limit: this.limit,
      retryAfterMs: Math.max(0, retryAfterMs),
      resetAt: counter.windowStart + this.windowMs,
    };
  }

  /**
   * Expose both counters and the computed weight for transparency.
   * @param {string} key
   * @returns {{ prevCount: number, currCount: number, weight: number, estimated: number, limit: number, windowMs: number }}
   */
  peek(key) {
    const counter = this._advance(key);
    const now = this.clock();
    const elapsedInWindow = now - counter.windowStart;
    const weight = Math.max(0, 1 - elapsedInWindow / this.windowMs);
    const estimated = this._estimate(counter);

    return {
      prevCount: counter.prevCount,
      currCount: counter.currCount,
      weight: Math.round(weight * 1000) / 1000, // 3 decimal places
      estimated: Math.round(estimated * 100) / 100,
      limit: this.limit,
      windowMs: this.windowMs,
    };
  }

  /**
   * Remove all state for `key`.
   * @param {string} key
   */
  reset(key) {
    this._counters.delete(key);
  }
}
