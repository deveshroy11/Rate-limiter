import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  TokenBucket,
  SlidingWindowLog,
  SlidingWindowCounter,
  FixedWindow,
} from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());

// ── Algorithm instances ────────────────────────────────────────────
const algorithms = {
  'token-bucket': new TokenBucket({ capacity: 10, refillRatePerSec: 2 }),
  'sliding-window-log': new SlidingWindowLog({ windowMs: 60_000, limit: 10 }),
  'sliding-window-counter': new SlidingWindowCounter({ windowMs: 60_000, limit: 10 }),
  'fixed-window': new FixedWindow({ windowMs: 60_000, limit: 10 }),
};

// ── Static files ───────────────────────────────────────────────────
app.use(express.static(join(__dirname, 'public')));

// ── API routes ─────────────────────────────────────────────────────

/** POST /api/:algorithm/consume?key=...&cost=... */
app.post('/api/:algorithm/consume', (req, res) => {
  const algo = algorithms[req.params.algorithm];
  if (!algo) return res.status(404).json({ error: `Unknown algorithm: ${req.params.algorithm}` });

  const key = req.query.key || 'default';
  const cost = parseInt(req.query.cost, 10) || 1;
  const result = algo.consume(key, cost);
  res.json(result);
});

/** GET /api/:algorithm/peek?key=... */
app.get('/api/:algorithm/peek', (req, res) => {
  const algo = algorithms[req.params.algorithm];
  if (!algo) return res.status(404).json({ error: `Unknown algorithm: ${req.params.algorithm}` });

  const key = req.query.key || 'default';
  const result = algo.peek(key);
  res.json(result);
});

/** POST /api/:algorithm/reset?key=... */
app.post('/api/:algorithm/reset', (req, res) => {
  const algo = algorithms[req.params.algorithm];
  if (!algo) return res.status(404).json({ error: `Unknown algorithm: ${req.params.algorithm}` });

  const key = req.query.key || 'default';
  algo.reset(key);
  res.json({ success: true, message: `State for key "${key}" has been reset.` });
});

/** GET /api/algorithms — list available algorithms */
app.get('/api/algorithms', (_req, res) => {
  res.json(Object.keys(algorithms));
});

// ── Start ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  🚦 Rate Limiter Dashboard`);
  console.log(`  ─────────────────────────`);
  console.log(`  → http://localhost:${PORT}\n`);
});
