# 🚦 Rate Limiter

A production-quality Node.js rate-limiting library with **four pluggable algorithms**, Express middleware, and an interactive visual dashboard.

## Algorithms

| Algorithm | Memory | Precision | Boundary Burst |
|---|---|---|---|
| **Token Bucket** | O(1)/key | Exact | No |
| **Sliding Window Log** | O(n)/key | Exact | No |
| **Sliding Window Counter** | O(1)/key | Near-exact | No |
| **Fixed Window** | O(1)/key | Exact | Yes (documented) |

## Quick Start

```bash
npm install
npm test          # run test suite
npm run dev       # start dashboard → http://localhost:3000
```

## Usage

```js
import { TokenBucket, SlidingWindowLog, SlidingWindowCounter, FixedWindow } from './src/index.js';

// Token Bucket
const bucket = new TokenBucket({ capacity: 100, refillRatePerSec: 10 });
const result = bucket.consume('user:42');
// → { allowed: true, remaining: 99, limit: 100, retryAfterMs: 0, resetAt: ... }

// Sliding Window Log
const swl = new SlidingWindowLog({ windowMs: 60_000, limit: 100 });
swl.consume('user:42');

// Sliding Window Counter
const swc = new SlidingWindowCounter({ windowMs: 60_000, limit: 100 });
swc.consume('user:42');

// Fixed Window
const fw = new FixedWindow({ windowMs: 60_000, limit: 100 });
fw.consume('user:42');
```

## Shared Interface

All algorithms implement:

```js
consume(key, cost = 1)  → { allowed, remaining, limit, retryAfterMs, resetAt }
peek(key)               → algorithm-specific introspection
reset(key)              → void
```

## Express Middleware

```js
import express from 'express';
import { TokenBucket } from './src/index.js';
import { createRateLimiter } from './src/middleware/rateLimitMiddleware.js';

const app = express();
const limiter = createRateLimiter(
  new TokenBucket({ capacity: 100, refillRatePerSec: 10 }),
  { keyExtractor: (req) => req.ip }
);

app.use('/api', limiter);
```

Sets headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`.

## License

MIT
