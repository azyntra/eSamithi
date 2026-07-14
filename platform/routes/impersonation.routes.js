const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getPool } = require('../db');
const { requireSuperadmin } = require('../middleware/auth');

// Impersonation ("Enter Samithi", FR-5). The platform mints a tenant admin
// token signed with the TENANT's JWT_SECRET (shared via env), carrying
// act:'sa:<id>' + sid + a 60-min expiry. No samithi passwords ever exist.
const router = express.Router();

const TTL_MIN = 60;

// Each server keeps its own tenant JWT_SECRET (prod's predates the platform
// and must stay valid for its live tokens). Pick the signing secret by the
// target samithi's server: TENANT_JWT_SECRET_<CODE> (e.g. _PROD), falling
// back to the single-server TENANT_JWT_SECRET.
function tenantSecretFor(serverCode) {
  const envKey = `TENANT_JWT_SECRET_${String(serverCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  return process.env[envKey] || process.env.TENANT_JWT_SECRET;
}

// POST /pa/v1/samithis/:slug/impersonate → { token, api_url, slug, expires_at, sid }
router.post('/samithis/:slug/impersonate', requireSuperadmin, async (req, res, next) => {
  try {
    const pool = getPool();
    const [[s]] = await pool.query(
      `SELECT s.slug, s.status, v.api_url, v.code AS server_code FROM samithis s JOIN servers v ON v.id = s.server_id WHERE s.slug = ?`,
      [req.params.slug]
    );
    if (!s) return res.status(404).json({ error: 'Unknown samithi' });
    if (s.status !== 'active') return res.status(400).json({ error: 'Cannot enter a suspended samithi' });
    const tenantSecret = tenantSecretFor(s.server_code);
    if (!tenantSecret) return res.status(501).json({ error: `No tenant JWT secret configured for server '${s.server_code}'` });

    const sid = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + TTL_MIN * 60 * 1000);
    await pool.query(
      'INSERT INTO impersonation_sessions (sid, admin_id, samithi_slug, expires_at) VALUES (?, ?, ?, ?)',
      [sid, req.admin.id, s.slug, expiresAt]
    );

    // Signed with the tenant server's secret so existing staff endpoints accept
    // it. role:'admin' + act triggers the tenant middleware's support path.
    const token = jwt.sign(
      {
        id: 0,
        username: `eSamithi Support (${req.admin.email})`,
        role: 'admin',
        sam: s.slug,
        act: `sa:${req.admin.id}`,
        sid
      },
      tenantSecret,
      { expiresIn: `${TTL_MIN}m` }
    );

    res.locals.audit = { action: 'impersonation_start', samithi: s.slug, sid };
    res.json({ token, api_url: s.api_url, slug: s.slug, sid, expires_at: expiresAt.toISOString() });
  } catch (err) { next(err); }
});

// GET /pa/v1/impersonations — live sessions (kill-switch list, FR-5.5)
router.get('/impersonations', async (_req, res, next) => {
  try {
    const [rows] = await getPool().query(`
      SELECT i.sid, i.samithi_slug, i.created_at, i.expires_at, i.revoked_at, m.email AS admin_email
      FROM impersonation_sessions i JOIN super_admins m ON m.id = i.admin_id
      WHERE i.expires_at > NOW() AND i.revoked_at IS NULL
      ORDER BY i.created_at DESC`);
    res.json(rows);
  } catch (err) { next(err); }
});

// DELETE /pa/v1/impersonations/:sid — revoke (FR-5.5)
router.delete('/impersonations/:sid', requireSuperadmin, async (req, res, next) => {
  try {
    const pool = getPool();
    const [[row]] = await pool.query('SELECT samithi_slug FROM impersonation_sessions WHERE sid = ?', [req.params.sid]);
    if (!row) return res.status(404).json({ error: 'Unknown session' });
    await pool.query('UPDATE impersonation_sessions SET revoked_at = NOW() WHERE sid = ? AND revoked_at IS NULL', [req.params.sid]);
    res.locals.audit = { action: 'impersonation_end', samithi: row.samithi_slug, sid: req.params.sid };
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
