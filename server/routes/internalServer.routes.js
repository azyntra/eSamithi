const express = require('express');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { internalAuth } = require('../middleware/internal');

// Server-scoped internal surface (multi-server platform). These operate on
// THIS server as a whole — not one tenant — so they mount BEFORE the tenant
// middleware (no X-Samithi needed). Gated by internalAuth: only platform-api
// holds the shared INTERNAL_SECRET.
//
// This is what lets ONE control plane (the console on the platform server)
// provision databases and publish registry updates on EVERY server in the
// fleet without SSH.
const router = express.Router();
router.use(internalAuth);

// POST /api/v1/internal/server/provision-db — create an empty tenant database
// plus its dedicated MySQL user on this server. The platform generates the
// credentials; this host just executes. Refuses to touch a DB that has tables.
router.post('/provision-db', async (req, res, next) => {
  let root;
  try {
    const { db_name, db_user, db_password } = req.body || {};
    if (!/^[a-z0-9_]{3,64}$/.test(db_name || '')) return res.status(400).json({ error: 'Invalid db_name' });
    if (!/^[a-z0-9_]{3,32}$/.test(db_user || '')) return res.status(400).json({ error: 'Invalid db_user' });
    if (!db_password || String(db_password).length < 12) return res.status(400).json({ error: 'db_password too short' });
    if (!process.env.MYSQL_ROOT_PASSWORD) {
      return res.status(501).json({ error: 'Provisioning not configured on this server (MYSQL_ROOT_PASSWORD unset)' });
    }

    root = await mysql.createConnection({
      host: process.env.DB_HOST || 'mysql',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: 'root',
      password: process.env.MYSQL_ROOT_PASSWORD,
      charset: 'utf8mb4'
    });

    const [[{ n }]] = await root.query(
      'SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?', [db_name]
    );
    if (n > 0) return res.status(409).json({ error: `Database ${db_name} already has ${n} tables — refusing to provision over it` });

    await root.query(`CREATE DATABASE IF NOT EXISTS \`${db_name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await root.query(`CREATE USER IF NOT EXISTS '${db_user}'@'%' IDENTIFIED BY ?`, [db_password]);
    // Re-assert the password so the value the platform stores is authoritative
    // even when a previous half-finished onboard created the user
    await root.query(`ALTER USER '${db_user}'@'%' IDENTIFIED BY ?`, [db_password]);
    await root.query(`GRANT ALL PRIVILEGES ON \`${db_name}\`.* TO '${db_user}'@'%'`);
    await root.query('FLUSH PRIVILEGES');

    res.json({ success: true });
  } catch (err) {
    next(err);
  } finally {
    if (root) await root.end().catch(() => {});
  }
});

// PUT /api/v1/internal/server/registry — replace this server's tenants.json.
// The platform sends only the tenants that live on THIS server. In-place write
// on purpose: the file is bind-mounted into the container, so the inode must
// survive (tmp+rename would detach the mount). getTenants() re-reads within
// 30 s; a slug miss forces an immediate reload (middleware/tenant.js).
router.put('/registry', async (req, res, next) => {
  try {
    const tenants = req.body && req.body.tenants;
    if (!tenants || typeof tenants !== 'object' || Array.isArray(tenants)) {
      return res.status(400).json({ error: 'tenants object required' });
    }
    for (const [slug, t] of Object.entries(tenants)) {
      if (!/^[a-z0-9][a-z0-9_-]{1,19}$/.test(slug) || !t || typeof t.db !== 'string' || typeof t.status !== 'string') {
        return res.status(400).json({ error: `Invalid tenant entry: ${slug}` });
      }
    }
    const file = process.env.TENANTS_FILE || path.join(__dirname, '..', 'tenants.json');
    fs.writeFileSync(file, JSON.stringify(tenants, null, 2) + '\n');
    res.json({ success: true, count: Object.keys(tenants).length });
  } catch (err) { next(err); }
});

module.exports = router;
