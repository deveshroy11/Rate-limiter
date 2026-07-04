/**
 * Fixed Window Rate Limiter
 *
 * One counter per key:windowStart pair, resets at each window boundary.
 * Cheapest algorithm; has a known boundary-burst tradeoff (documented
 * in tests, not treated as a bug).
 *
 * @example
 *   const limiter = new FixedWindow({ windowMs: 60_000, limit: 100 });
 *   const result = limiter.consume('user:42');
 */
export class FixedWindow {
  /**
   * @param {object} options
   * @param {number} options.windowMs — Window duration in milliseconds.
   * @param {number} options.limit    — Maximum requests allowed per window.
   * @param {function} [options.clock] — Injectable clock; defaults to Date.now.
   */
  constructor({ windowMs, limit, clock = Date.now }) {
    if (windowMs <= 0) throw new RangeError('windowMs must be > 0');
    if (limit <= 0) throw new RangeError('limit must be > 0');

    this.windowMs = windowMs;
    this.limit = limit;
    this.clock = clock;

    /**
     * @type {Map<string, { count: number, windowStart: number }>}
     */
    this._windows = new Map();
  }

  /**
   * Get the current window for `key`, resetting if the window has elapsed.
   * @param {string} key
   * @returns {{ count: number, windowStart: number }}
   */
  _getWindow(key) {
    const now = this.clock();
    const windowStart = now - (now % this.windowMs);

    if (!this._windows.has(key)) {
      const win = { count: 0, windowStart };
      this._windows.set(key, win);
      return win;
    }

    const win = this._windows.get(key);

    if (now - win.windowStart >= this.windowMs) {
      // Window has elapsed — reset
      win.count = 0;
      win.windowStart = windowStart;
    }

    return win;
  }

  /**
   * Attempt to record `cost` request(s) for `key`.
   *
   * @param {string} key
   * @param {number} [cost=1]
   * @returns {{ allowed: boolean, remaining: number, limit: number, retryAfterMs: number, resetAt: number }}
   */
  consume(key, cost = 1) {
    const win = this._getWindow(key);
    const now = this.clock();
    const resetAt = win.windowStart + this.windowMs;

    if (win.count + cost <= this.limit) {
      win.count += cost;
      return {
        allowed: true,
        remaining: this.limit - win.count,
        limit: this.limit,
        retryAfterMs: 0,
        resetAt,
      };
    }

    return {
      allowed: false,
      remaining: Math.max(0, this.limit - win.count),
      limit: this.limit,
      retryAfterMs: Math.max(0, Math.ceil(resetAt - now)),
      resetAt,
    };
  }

  /**
   * Return current count, limit, and time until reset.
   * @param {string} key
   * @returns {{ count: number, limit: number, remaining: number, msUntilReset: number }}
   */
  peek(key) {
    const win = this._getWindow(key);
    const now = this.clock();
    return {
      count: win.count,
      limit: this.limit,
      remaining: Math.max(0, this.limit - win.count),
      msUntilReset: Math.max(0, Math.ceil(win.windowStart + this.windowMs - now)),
    };
  }

  /**
   * Remove all state for `key`.
   * @param {string} key
   */
  reset(key) {
    this._windows.delete(key);
  }
}
