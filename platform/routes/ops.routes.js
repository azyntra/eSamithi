const express = require('express');
const { getPool } = require('../db');
const { requireSuperadmin } = require('../middleware/auth');

// Operations & monitoring (super-admin FR-8) plus the platform-wide controls
// that ride the directory response: maintenance banner (FR-7.2) and the global
// min-app-version kill switch (FR-8.5).
const router = express.Router();

// Live server health: hit each registered server's deep health URL and report
// API reachability, per-tenant DB status, and the deployed API version.
async function pingServer(server) {
  const url = server.health_url || `${server.api_url}/health?deep=1`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const data = await res.json().catch(() => ({}));
    return {
      code: server.code, role: server.role, api_url: server.api_url,
      up: res.ok || res.status === 503, // 503 = degraded but process alive
      status: data.status || (res.ok ? 'ok' : 'error'),
      api_version: data.api_version || null,
      tenants: data.tenants || {}
    };
  } catch (err) {
    return { code: server.code, role: server.role, api_url: server.api_url, up: false, status: 'unreachable', error: err.message, tenants: {} };
  } finally {
    clearTimeout(timer);
  }
}

// GET /pa/v1/ops/health — server + per-tenant health grid, release versions
router.get('/health', async (_req, res, next) => {
  try {
    const [servers] = await getPool().query('SELECT id, code, api_url, role, health_url FROM servers ORDER BY (role="active") DESC, code');
    const health = await Promise.all(servers.map(pingServer));
    // Backup heartbeat (nightly job may write this key; absent = unknown)
    const [[bk]] = await getPool().query("SELECT `value` FROM platform_settings WHERE `key` = 'last_backup_at'");
    res.json({ servers: health, last_backup_at: bk ? bk.value : null, checked_at: new Date().toISOString() });
  } catch (err) { next(err); }
});

const SETTING_KEYS = ['maintenance_active', 'maintenance_message', 'global_min_app_version'];

// GET /pa/v1/ops/settings — platform-wide controls
router.get('/settings', async (_req, res, next) => {
  try {
    const [rows] = await getPool().query('SELECT `key`, `value` FROM platform_settings WHERE `key` IN (?)', [SETTING_KEYS]);
    const out = {};
    for (const r of rows) out[r.key] = r.value;
    res.json({
      maintenance_active: out.maintenance_active === '1',
      maintenance_message: out.maintenance_message || '',
      global_min_app_version: out.global_min_app_version || ''
    });
  } catch (err) { next(err); }
});

// PUT /pa/v1/ops/settings — update platform-wide controls (superadmin, audited)
router.put('/settings', requireSuperadmin, async (req, res, next) => {
  try {
    const pool = getPool();
    const updates = {};
    if (req.body.maintenance_active !== undefined) updates.maintenance_active = req.body.maintenance_active ? '1' : '0';
    if (req.body.maintenance_message !== undefined) updates.maintenance_message = String(req.body.maintenance_message || '').slice(0, 500);
    if (req.body.global_min_app_version !== undefined) {
      const v = String(req.body.global_min_app_version || '').trim();
      if (v && !/^\d+\.\d+\.\d+$/.test(v)) return res.status(400).json({ error: 'Version must be like 1.2.0' });
      updates.global_min_app_version = v;
    }
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update' });
    for (const [k, v] of Object.entries(updates)) {
      await pool.query('INSERT INTO platform_settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)', [k, v]);
    }
    res.locals.audit = { action: 'ops_settings_update', after: updates };
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
