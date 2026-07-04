// src/index.js
// KB ENTERPRISES Backend — Express server entry point

require('dotenv').config();

const express       = require('express');
const cors          = require('cors');
const helmet        = require('helmet');
const rateLimit     = require('express-rate-limit');
const pool          = require('./db/pool');
const initDb        = require('./db/init');
const productRoutes = require('./routes/products');
const authRoutes    = require('./routes/auth');
const userRoutes    = require('./routes/users');
const orderRoutes   = require('./routes/orders');
const notifRoutes   = require('./routes/notifications');
const reportRoutes  = require('./routes/reports');

const app  = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 8080;

// ── Startup guards ────────────────────────────────────────────────────
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set in .env — server cannot start safely.');
  process.exit(1);
}
if (!process.env.DATABASE_URL && (!process.env.DB_NAME || !process.env.DB_USER || !process.env.DB_PASSWORD)) {
  console.error('FATAL: Database credentials missing in .env');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_ORIGIN) {
  console.error('FATAL: FRONTEND_ORIGIN is not set in production.');
  process.exit(1);
}

// ── Security headers ──────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────
const configuredOrigins = [
  process.env.FRONTEND_ORIGIN,
  process.env.FRONTEND_ORIGINS,
]
  .filter(Boolean)
  .flatMap(value => value.split(',').map(origin => origin.trim()).filter(Boolean));

const allowedOrigins = [
  ...configuredOrigins,
  ...(process.env.NODE_ENV !== 'production' ? [
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
  ] : []),
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
}));

// ── Rate limiting ─────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login',      authLimiter);
app.use('/api/auth/crew-login', authLimiter);
app.use('/api/auth/register',   authLimiter);

// ── Body parsing ──────────────────────────────────────────────────────
app.use(express.json({ limit: '15mb' }));

// ── Health check ──────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// ── API routes ────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/orders',        orderRoutes);
app.use('/api/notifications', notifRoutes);
app.use('/api/reports',       reportRoutes);
app.use('/api/products',      productRoutes);

// ── 404 fallback ──────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
});

// ── Global error handler ──────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.stack || err.message);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

// ── Start ─────────────────────────────────────────────────────────────
(async () => {
  await initDb();
  const server = app.listen(PORT, () => {
    console.log(`KB ENTERPRISES backend running on port ${PORT}`);
    console.log(`Health: http://localhost:${PORT}/health`);
    console.log(`API:    http://localhost:${PORT}/api`);
  });

  // Graceful shutdown — handles Render's SIGTERM
  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  });
})();
