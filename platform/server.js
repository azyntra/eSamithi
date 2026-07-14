// eSamithi platform-api — control plane (super-admin panel Phase A).
// Owns super-admin auth (TOTP 2FA), the samithi registry, the append-only
// audit log, and the public directory (absorbed per the panel doc §4.1).
require('dotenv').config();
const express = require('express');
const { initDb, getPool } = require('./db');
const { requireAuth, auditMiddleware } = require('./middleware/auth');
const authRoutes = require('./routes/auth.routes');
const samithisRoutes = require('./routes/samithis.routes');
const auditRoutes = require('./routes/audit.routes');

const app = express();
const PORT = process.env.PORT || 4000;

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'platform-api' }));

// ── Public directory (unauthenticated subset) ─────────────────
// GET /v1/resolve/:joinCode — same contract the standalone directory served;
// the samithis table is now the single source of truth.
app.get('/v1/resolve/:code', async (req, res, next) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9-]{2,20}$/.test(code)) return res.status(404).json({ error: 'Unknown samithi code' });
    const [[row]] = await getPool().query(
      `SELECT s.slug, s.name_en AS name, s.status, s.min_app_version, v.api_url
       FROM samithis s JOIN servers v ON v.id = s.server_id WHERE s.join_code = ?`,
      [code]
    );
    if (!row) return res.status(404).json({ error: 'Unknown samithi code' });
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      slug: row.slug,
      name: row.name,
      api_url: row.api_url,
      status: row.status,
      min_app_version: row.min_app_version || undefined
    });
  } catch (err) { next(err); }
});

// ── Platform API (authenticated) ──────────────────────────────
app.use('/pa/v1/auth', authRoutes);
app.use('/pa/v1', requireAuth, auditMiddleware);
app.use('/pa/v1/samithis', samithisRoutes);
app.use('/pa/v1/audit', auditRoutes);
app.get('/pa/v1/me', (req, res) => res.json(req.admin));

app.use((err, _req, res, _next) => {
  console.error('[platform] error:', err.message);
  res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
});

(async () => {
  try {
    await initDb();
    console.log('✓ platform DB ready');
    app.listen(PORT, '0.0.0.0', () => console.log(`✓ platform-api on :${PORT}`));
  } catch (err) {
    console.error('✗ platform-api failed to start:', err.message);
    process.exit(1);
  }
})();
