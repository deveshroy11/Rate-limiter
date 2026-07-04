/**
 * @rate-limiter/core — Public API
 *
 * Re-exports all four algorithms and the Express middleware factory.
 */

// Algorithms
export { TokenBucket } from './algorithms/TokenBucket.js';
export { SlidingWindowLog } from './algorithms/SlidingWindowLog.js';
export { SlidingWindowCounter } from './algorithms/SlidingWindowCounter.js';
export { FixedWindow } from './algorithms/FixedWindow.js';

// Middleware
export { createRateLimiter } from './middleware/rateLimitMiddleware.js';
