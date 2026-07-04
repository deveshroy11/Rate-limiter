/**
 * Express Rate-Limit Middleware Factory
 *
 * Wraps any algorithm instance into Express middleware that sets
 * standard rate-limit headers and returns 429 when requests are denied.
 *
 * @example
 *   import { TokenBucket } from '../algorithms/TokenBucket.js';
 *   import { createRateLimiter } from './rateLimitMiddleware.js';
 *
 *   const limiter = createRateLimiter(new TokenBucket({ capacity: 100, refillRatePerSec: 10 }));
 *   app.use('/api', limiter);
 */

/**
 * @param {object} algorithm    — Any object implementing consume(key, cost).
 * @param {object} [options]
 * @param {function} [options.keyExtractor] — (req) => string; defaults to req.ip.
 * @param {number}   [options.cost]         — Fixed cost per request; defaults to 1.
 * @param {string}   [options.message]      — Custom 429 message.
 * @returns {function} Express middleware
 */
export function createRateLimiter(algorithm, options = {}) {
  const {
    keyExtractor = (req) => req.ip,
    cost = 1,
    message = 'Too many requests, please try again later.',
  } = options;

  return (req, res, next) => {
    const key = keyExtractor(req);
    const result = algorithm.consume(key, cost);

    // Set standard rate-limit headers
    res.set('X-RateLimit-Limit', String(result.limit));
    res.set('X-RateLimit-Remaining', String(result.remaining));
    res.set('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

    if (!result.allowed) {
      res.set('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
      return res.status(429).json({
        error: message,
        retryAfterMs: result.retryAfterMs,
      });
    }

    // Attach result to request for downstream handlers
    req.rateLimit = result;
    next();
  };
}
