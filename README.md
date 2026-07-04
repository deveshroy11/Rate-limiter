# Rate Limiter

A production-quality rate limiting library for Node.js featuring four interchangeable algorithms, Express middleware, comprehensive tests, and an interactive dashboard for visualizing rate-limiting behavior.

---

## Features

- Four interchangeable rate-limiting algorithms
- Consistent API across all implementations
- Express.js middleware
- Standard rate-limit response headers
- Interactive visualization dashboard
- Comprehensive test suite
- Zero external dependencies for the core algorithms

---

## Implemented Algorithms

| Algorithm | Memory per Key | Precision | Burst at Window Boundary |
| ---------- | -------------- | --------- | ------------------------ |
| **Token Bucket** | O(1) | Exact | No |
| **Sliding Window Log** | O(n) | Exact | No |
| **Sliding Window Counter** | O(1) | Near Exact | No |
| **Fixed Window** | O(1) | Exact | Yes |

### Algorithm Summary

- **Token Bucket** – Smooth rate limiting with configurable refill rate. Ideal for APIs requiring burst tolerance.
- **Sliding Window Log** – Stores request timestamps to provide exact rate limiting.
- **Sliding Window Counter** – Uses weighted counters for near-exact limiting while maintaining constant memory.
- **Fixed Window** – Fastest implementation with constant memory, though susceptible to boundary bursts.

---

## Project Structure

```text
.
├── demo/          # Interactive dashboard
├── src/           # Library source code
├── tests/         # Unit tests
├── package.json
└── README.md
```

---

## Installation

Clone the repository and install dependencies:

```bash
npm install
```

---

## Running the Project

Run the test suite:

```bash
npm test
```

Start the interactive dashboard:

```bash
npm run dev
```

The dashboard will be available at:

```
http://localhost:3000
```

---

## Usage

```javascript
import {
  TokenBucket,
  SlidingWindowLog,
  SlidingWindowCounter,
  FixedWindow
} from "./src/index.js";
```

### Token Bucket

```javascript
const limiter = new TokenBucket({
  capacity: 100,
  refillRatePerSec: 10
});

const result = limiter.consume("user:42");
```

### Sliding Window Log

```javascript
const limiter = new SlidingWindowLog({
  windowMs: 60000,
  limit: 100
});

limiter.consume("user:42");
```

### Sliding Window Counter

```javascript
const limiter = new SlidingWindowCounter({
  windowMs: 60000,
  limit: 100
});

limiter.consume("user:42");
```

### Fixed Window

```javascript
const limiter = new FixedWindow({
  windowMs: 60000,
  limit: 100
});

limiter.consume("user:42");
```

---

## Common API

All algorithms expose the same interface.

### Consume

```javascript
consume(key, cost = 1)
```

Returns:

```javascript
{
  allowed: true,
  remaining: 99,
  limit: 100,
  retryAfterMs: 0,
  resetAt: Date
}
```

### Peek

Inspect the current state without consuming tokens.

```javascript
peek(key)
```

### Reset

Clear all state associated with a key.

```javascript
reset(key)
```

---

## Express Integration

```javascript
import express from "express";
import { TokenBucket } from "./src/index.js";
import { createRateLimiter } from "./src/middleware/rateLimitMiddleware.js";

const app = express();

const limiter = createRateLimiter(
  new TokenBucket({
    capacity: 100,
    refillRatePerSec: 10
  }),
  {
    keyExtractor: (req) => req.ip
  }
);

app.use("/api", limiter);
```

The middleware automatically sets the following response headers:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After`

Requests exceeding the configured limit receive an HTTP **429 Too Many Requests** response.

---

## Performance Characteristics

| Algorithm | Time Complexity | Memory |
| ---------- | --------------- | ------ |
| Token Bucket | O(1) | O(1) |
| Sliding Window Log | O(k) | O(k) |
| Sliding Window Counter | O(1) | O(1) |
| Fixed Window | O(1) | O(1) |

*k = number of requests currently within the active window.*

---

## Use Cases

- REST API rate limiting
- Authentication endpoints
- Login protection
- Public API quotas
- Per-user throttling
- Per-IP request limiting
- Internal service protection

---

## License

MIT License
