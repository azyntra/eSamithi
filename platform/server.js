// eSamithi platform-api — control plane (super-admin panel Phase A).
// Owns super-admin auth (TOTP 2FA), the samithi registry, the append-only
// audit log, and the public directory (absorbed per the panel doc §4.1).
require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const { initDb, getPool } = require('./db');
const { requireAuth, auditMiddleware } = require('./middleware/auth');
const { startCollector } = require('./lib/collector');
const authRoutes = require('./routes/auth.routes');
const samithisRoutes = require('./routes/samithis.routes');
const auditRoutes = require('./routes/audit.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const impersonationRoutes = require('./routes/impersonation.routes');
const reportsRoutes = require('./routes/reports.routes');
const broadcastsRoutes = require('./routes/broadcasts.routes');
const opsRoutes = require('./routes/ops.routes');

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
// Return the stricter (higher) of two semver strings; tolerates blanks.
function maxVersion(a, b) {
  if (!a) return b || null;
  if (!b) return a || null;
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return a;
    if ((pa[i] || 0) < (pb[i] || 0)) return b;
  }
  return a;
}

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

    // Platform-wide controls (FR-7.2 maintenance banner, FR-8.5 global min app
    // version). The effective minimum is the stricter of the samithi's own and
    // the global floor; clients already gate on min_app_version.
    const [settings] = await getPool().query(
      "SELECT `key`, `value` FROM platform_settings WHERE `key` IN ('maintenance_active','maintenance_message','global_min_app_version')"
    );
    const ps = {};
    for (const s of settings) ps[s.key] = s.value;
    const minApp = maxVersion(row.min_app_version, ps.global_min_app_version);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      slug: row.slug,
      name: row.name,
      api_url: row.api_url,
      status: row.status,
      min_app_version: minApp || undefined,
      maintenance: ps.maintenance_active === '1' && ps.maintenance_message
        ? { message: ps.maintenance_message }
        : undefined
    });
  } catch (err) { next(err); }
});

// ── Internal (tenant API → platform): impersonation revocation check ──
// Signed with the shared INTERNAL_SECRET; never reachable by clients.
app.get('/internal/impersonation/:sid', async (req, res) => {
  try {
    const header = req.headers.authorization || '';
    const decoded = jwt.verify(header.replace('Bearer ', ''), process.env.INTERNAL_SECRET || '');
    if (decoded.typ !== 'internal') throw new Error('bad typ');
  } catch {
    return res.status(401).json({ error: 'internal auth' });
  }
  const [[row]] = await getPool().query(
    'SELECT 1 AS ok FROM impersonation_sessions WHERE sid = ? AND revoked_at IS NULL AND expires_at > NOW()',
    [req.params.sid]
  );
  res.json({ active: Boolean(row) });
});

// ── Platform API (authenticated) ──────────────────────────────
app.use('/pa/v1/auth', authRoutes);
app.use('/pa/v1', requireAuth, auditMiddleware);
app.use('/pa/v1/samithis', samithisRoutes);
app.use('/pa/v1/dashboard', dashboardRoutes);
app.use('/pa/v1/reports', reportsRoutes);
app.use('/pa/v1/broadcasts', broadcastsRoutes);
app.use('/pa/v1/ops', opsRoutes);
app.use('/pa/v1', impersonationRoutes);
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
    startCollector();
    app.listen(PORT, '0.0.0.0', () => console.log(`✓ platform-api on :${PORT}`));
  } catch (err) {
    console.error('✗ platform-api failed to start:', err.message);
    process.exit(1);
  }
})();
