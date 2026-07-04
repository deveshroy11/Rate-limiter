/**
 * Sliding Window Log Rate Limiter
 *
 * Stores a timestamp per accepted request. On each call, prunes entries
 * older than `windowMs` from the front (the log is append-sorted, so
 * pruning is O(expired) not O(n)), then checks if count + cost <= limit.
 *
 * Most precise algorithm — no boundary burst — at O(n) memory per key.
 *
 * @example
 *   const limiter = new SlidingWindowLog({ windowMs: 60_000, limit: 100 });
 *   const result = limiter.consume('user:42');
 */
export class SlidingWindowLog {
  /**
   * @param {object} options
   * @param {number} options.windowMs — Sliding window duration in milliseconds.
   * @param {number} options.limit    — Maximum requests allowed within the window.
   * @param {function} [options.clock] — Injectable clock; defaults to Date.now.
   */
  constructor({ windowMs, limit, clock = Date.now }) {
    if (windowMs <= 0) throw new RangeError('windowMs must be > 0');
    if (limit <= 0) throw new RangeError('limit must be > 0');

    this.windowMs = windowMs;
    this.limit = limit;
    this.clock = clock;

    /** @type {Map<string, number[]>} */
    this._logs = new Map();
  }

  /**
   * Retrieve the log for `key`, pruning expired entries from the front.
   * @param {string} key
   * @returns {number[]} — The live (non-expired) timestamp array.
   */
  _getAndPrune(key) {
    const now = this.clock();
    const cutoff = now - this.windowMs;

    if (!this._logs.has(key)) {
      this._logs.set(key, []);
      return this._logs.get(key);
    }

    const log = this._logs.get(key);

    // Since entries are appended in order, we can scan from the front
    let pruneIndex = 0;
    while (pruneIndex < log.length && log[pruneIndex] <= cutoff) {
      pruneIndex++;
    }
    if (pruneIndex > 0) {
      log.splice(0, pruneIndex);
    }

    return log;
  }

  /**
   * Attempt to record `cost` request(s) for `key`.
   *
   * @param {string} key
   * @param {number} [cost=1]
   * @returns {{ allowed: boolean, remaining: number, limit: number, retryAfterMs: number, resetAt: number }}
   */
  consume(key, cost = 1) {
    const log = this._getAndPrune(key);
    const now = this.clock();

    if (log.length + cost <= this.limit) {
      // Record `cost` entries
      for (let i = 0; i < cost; i++) {
        log.push(now);
      }
      return {
        allowed: true,
        remaining: this.limit - log.length,
        limit: this.limit,
        retryAfterMs: 0,
        resetAt: log.length > 0 ? log[0] + this.windowMs : now + this.windowMs,
      };
    }

    // Denied — the oldest entry determines when space opens up
    const oldestRelevant = log[0];
    const retryAfterMs = oldestRelevant != null
      ? Math.max(0, (oldestRelevant + this.windowMs) - now)
      : 0;

    return {
      allowed: false,
      remaining: Math.max(0, this.limit - log.length),
      limit: this.limit,
      retryAfterMs: Math.ceil(retryAfterMs),
      resetAt: oldestRelevant != null ? oldestRelevant + this.windowMs : now + this.windowMs,
    };
  }

  /**
   * Return the live entry list for introspection, without consuming.
   * @param {string} key
   * @returns {{ log: number[], count: number, limit: number, windowMs: number }}
   */
  peek(key) {
    const log = this._getAndPrune(key);
    return {
      log: [...log], // defensive copy
      count: log.length,
      limit: this.limit,
      windowMs: this.windowMs,
    };
  }

  /**
   * Remove all state for `key`.
   * @param {string} key
   */
  reset(key) {
    this._logs.delete(key);
  }
}
