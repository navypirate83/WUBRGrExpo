/* =====================================================================
   THE EXPRESS APP
   Builds the app and exports it, but never opens a port and never
   connects to the database. (server.js does both. Keeping them apart
   lets the automated tests use the app without a real server.)
   The ORDER below matters: each request passes through these steps
   from top to bottom.
   ===================================================================== */

import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { loadConfig } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requireAuth, requireAdmin } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import bindersRouter from './routes/binders.js';
import listsRouter from './routes/lists.js';
import adminRouter from './routes/admin.js';

// Read the settings (also loads the .env file)
export const config = loadConfig();

const app = express();

// Don't announce that we're an Express server
app.disable('x-powered-by');

// Behind a hosting service's proxy every visitor would look like the same
// address, so trust the first proxy (needed for the rate limits to count
// each visitor separately)
app.set('trust proxy', 1);

// A log line per request (not while the tests run)
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// Safety headers on every answer
app.use(helmet());

// CORS: which WEBSITES a browser lets read our answers. Only the exact
// addresses in CORS_ORIGINS are allowed, never "*". This is NOT a login:
// it only controls browsers, so the token checks below still do the real
// protecting. The phone app sends no Origin and isn't affected. We don't
// turn on "credentials" because the app sends its token in a header.
app.use(cors({
  origin(origin, callback) {
    // No Origin header (phone app, curl): fine. Otherwise it must match exactly.
    callback(null, !origin || config.corsOrigins.includes(origin) ? (origin ?? false) : false);
  },
}));

// Overall limit: 100 requests a minute per visitor
app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a minute and try again.' },
}));

// A stricter limit on the routes where people type passwords or send
// tokens. Each route gets its OWN counter. They go BEFORE the body is
// read, so a flood is turned away before any work is done. A request past
// the limit gets 429 and never reaches the route.
function makeAuthLimiter(limit) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please wait a minute and try again.' },
  });
}
app.post('/auth/signup', makeAuthLimiter(config.authRateLimitMax));
app.post('/auth/login', makeAuthLimiter(config.authRateLimitMax));
app.post('/auth/google', makeAuthLimiter(config.authRateLimitMax));
app.post('/auth/forgot', makeAuthLimiter(config.authRateLimitMax));
app.post('/auth/reset', makeAuthLimiter(config.authRateLimitMax));
// The app refreshes more often, so it gets twice the tries
app.post('/auth/refresh', makeAuthLimiter(config.authRateLimitMax * 2));

// The two routes that really need big bodies (a whole binder's cards, a
// .csv file) get a bigger limit. Sign-in is checked FIRST, so a stranger
// can't make us read a huge body. Once read, the normal reader below skips it.
app.put('/binders/:id/cards', requireAuth, express.json({ limit: '25mb' }));
app.put('/lists/:id/cards', requireAuth, express.json({ limit: '10mb' }));
app.post('/binders/import', requireAuth, express.json({ limit: '10mb' }));

// Everything else: JSON bodies up to 100 KB
app.use(express.json({ limit: '100kb' }));

// Simple "is it alive" routes (no sign-in needed)
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/hello', (req, res) => res.json({ message: 'Hello from the WUBRG\'r server' }));

// The real routes
app.use('/auth', authRouter);
// requireAuth is mounted ONCE for each whole router, so no route can
// forget it (a route without it would crash on a missing req.user)
app.use('/binders', requireAuth, bindersRouter);
app.use('/lists', requireAuth, listsRouter);
app.use('/admin', requireAuth, requireAdmin, adminRouter);

// Anything else: a plain 404 that never repeats the address back
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// The safety net for errors nobody caught: always last
app.use(errorHandler);

export default app;
