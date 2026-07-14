const express = require('express');
const crypto = require('crypto');
const { getPool } = require('../db');
const { migrateTenant } = require('../migrations/runner');
const { sendPushToAllMembers } = require('../lib/push');
const { internalAuth } = require('../middleware/internal');

// Staff passwords are sha256 (matches auth.routes.js / provision-tenant.js)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Platform stats pull (super-admin panel §4.3). Tenant is resolved by the
// normal X-Samithi middleware; internalAuth gates it to platform-api.
const router = express.Router();
router.use(internalAuth);

// GET /api/v1/internal/stats — one counters snapshot for this tenant
router.get('/stats', async (_req, res, next) => {
  try {
    const pool = getPool();
    const q = async (sql) => { const [[row]] = await pool.query(sql); return row; };

    const members = await q(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN is_active = 1 OR is_active IS NULL THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN pin_hash IS NOT NULL THEN 1 ELSE 0 END) AS enrolled
      FROM members`);
    const staff = await q('SELECT COUNT(*) AS n FROM users');
    const wallets = await q("SELECT IFNULL(SUM(balance),0) AS cents FROM wallets WHERE is_active = 1");
    const loans = await q(`SELECT COUNT(*) AS n, IFNULL(SUM(principal_owed + interest_owed + fines_owed),0) AS cents
      FROM loans WHERE status IN ('Active','Overdue')`);
    const fds = await q("SELECT COUNT(*) AS n, IFNULL(SUM(principal),0) AS cents FROM fixed_deposits WHERE status = 'Active'");
    const pending = await q("SELECT COUNT(*) AS n FROM member_requests WHERE status = 'Pending'");
    const lastTxn = await q(`SELECT GREATEST(
        IFNULL((SELECT MAX(date) FROM income_ledger), '1970-01-01'),
        IFNULL((SELECT MAX(date) FROM expense_ledger), '1970-01-01')
      ) AS d`);
    const migration = await q('SELECT IFNULL(MAX(id), "none") AS v FROM schema_migrations');

    res.json({
      members_total: Number(members.total),
      members_active: Number(members.active),
      members_enrolled: Number(members.enrolled),
      staff_users: Number(staff.n),
      wallets_total_cents: Number(wallets.cents),
      loans_active: Number(loans.n),
      loans_outstanding_cents: Number(loans.cents),
      fds_count: Number(fds.n),
      fds_value_cents: Number(fds.cents),
      pending_requests: Number(pending.n),
      last_txn_at: lastTxn.d && String(lastTxn.d).startsWith('1970') ? null : lastTxn.d,
      migration_version: migration.v
    });
  } catch (err) { next(err); }
});

// GET /api/v1/internal/detail — richer per-samithi drill-down for the panel
// (super-admin FR-4). Read-only; one round trip.
router.get('/detail', async (_req, res, next) => {
  try {
    const pool = getPool();

    const [[members]] = await pool.query(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN is_active = 1 OR is_active IS NULL THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS inactive,
      SUM(CASE WHEN pin_hash IS NOT NULL THEN 1 ELSE 0 END) AS enrolled,
      SUM(CASE WHEN pin_locked_until IS NOT NULL AND pin_locked_until > NOW() THEN 1 ELSE 0 END) AS locked_pins,
      SUM(CASE WHEN app_enabled = 0 THEN 1 ELSE 0 END) AS app_disabled
      FROM members`);
    const [[push]] = await pool.query('SELECT COUNT(*) AS n FROM member_push_tokens');
    const [[loans]] = await pool.query(`SELECT
      COUNT(*) AS active,
      SUM(CASE WHEN status = 'Overdue' THEN 1 ELSE 0 END) AS overdue,
      IFNULL(SUM(principal_owed + interest_owed + fines_owed),0) AS outstanding
      FROM loans WHERE status IN ('Active','Overdue')`);
    const [[fds]] = await pool.query("SELECT COUNT(*) AS n, IFNULL(SUM(principal),0) AS cents FROM fixed_deposits WHERE status = 'Active'");
    const [[pending]] = await pool.query("SELECT COUNT(*) AS n FROM member_requests WHERE status = 'Pending'");
    const [wallets] = await pool.query('SELECT id, name, balance, is_active FROM wallets ORDER BY is_active DESC, name');
    const [staff] = await pool.query('SELECT id, username, full_name, role, is_active, last_login_at FROM users ORDER BY role, username');
    const [settings] = await pool.query('SELECT `key`, `value` FROM settings ORDER BY `key`');
    const [migrations] = await pool.query('SELECT id, applied_at FROM schema_migrations ORDER BY id');
    // Members currently locked out of the mobile app (FR-4.3 — each is unlockable)
    const [lockedMembers] = await pool.query(
      `SELECT id, society_id, full_name, pin_locked_until, failed_pin_attempts
       FROM members WHERE pin_locked_until IS NOT NULL AND pin_locked_until > NOW()
       ORDER BY pin_locked_until DESC`
    );

    res.json({
      members: {
        total: Number(members.total), active: Number(members.active), inactive: Number(members.inactive),
        enrolled: Number(members.enrolled), locked_pins: Number(members.locked_pins),
        app_disabled: Number(members.app_disabled), push_tokens: Number(push.n)
      },
      loans: { active: Number(loans.active), overdue: Number(loans.overdue), outstanding_cents: Number(loans.outstanding) },
      fds: { count: Number(fds.n), value_cents: Number(fds.cents) },
      pending_requests: Number(pending.n),
      wallets: wallets.map((w) => ({ id: w.id, name: w.name, balance_cents: Number(w.balance), is_active: Number(w.is_active) })),
      staff: staff.map((u) => ({
        id: u.id, username: u.username, full_name: u.full_name, role: u.role,
        is_active: u.is_active === null ? 1 : Number(u.is_active), last_login_at: u.last_login_at
      })),
      locked_members: lockedMembers.map((m) => ({
        id: m.id, society_id: m.society_id, full_name: m.full_name,
        pin_locked_until: m.pin_locked_until, failed_pin_attempts: Number(m.failed_pin_attempts)
      })),
      settings: settings.map((s) => ({ key: s.key, value: s.value })),
      migrations: migrations.map((m) => ({ id: m.id, applied_at: m.applied_at }))
    });
  } catch (err) { next(err); }
});

// ── Write endpoints (super-admin panel Phase C, FR-4.2/4.3) ──────────────────
// Mutating tenant control operations the platform-api proxies on the operator's
// behalf. Gated by internalAuth (platform-only signed JWT). The platform audits
// each call on its side; these stay thin.

// POST /internal/users — create a staff login
router.post('/users', async (req, res, next) => {
  try {
    const { username, full_name, role, password } = req.body || {};
    if (!username || !full_name || !password) return res.status(400).json({ error: 'username, full_name and password are required' });
    if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'role must be admin or user' });
    const pool = getPool();
    const [dupe] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (dupe.length) return res.status(409).json({ error: 'Username already exists' });
    const [r] = await pool.query(
      'INSERT INTO users (username, password, full_name, role, is_active) VALUES (?, ?, ?, ?, 1)',
      [username, hashPassword(password), full_name, role]
    );
    res.json({ success: true, id: r.insertId });
  } catch (err) { next(err); }
});

// PATCH /internal/users/:id — change role and/or enable/disable
router.patch('/users/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pool = getPool();
    const [[target]] = await pool.query('SELECT id, role, is_active FROM users WHERE id = ?', [id]);
    if (!target) return res.status(404).json({ error: 'Unknown user' });
    const fields = {};
    if (req.body.role !== undefined) {
      if (!['admin', 'user'].includes(req.body.role)) return res.status(400).json({ error: 'role must be admin or user' });
      fields.role = req.body.role;
    }
    if (req.body.is_active !== undefined) fields.is_active = req.body.is_active ? 1 : 0;
    // Never leave a tenant with no active administrator
    const demotes = (fields.role && fields.role !== 'admin' && target.role === 'admin') ||
                    (fields.is_active === 0 && target.role === 'admin');
    if (demotes) {
      const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND (is_active = 1 OR is_active IS NULL) AND id <> ?", [id]);
      if (n === 0) return res.status(403).json({ error: 'Cannot remove the last active administrator' });
    }
    if (!Object.keys(fields).length) return res.status(400).json({ error: 'Nothing to update' });
    await pool.query('UPDATE users SET ? WHERE id = ?', [fields, id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /internal/users/:id/reset-password — set a supplied temporary password
router.post('/users/:id/reset-password', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ error: 'password required' });
    const [r] = await getPool().query('UPDATE users SET password = ? WHERE id = ?', [hashPassword(password), id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Unknown user' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// DELETE /internal/users/:id — remove a staff login (guards last admin)
router.delete('/users/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const pool = getPool();
    const [[target]] = await pool.query('SELECT role FROM users WHERE id = ?', [id]);
    if (!target) return res.status(404).json({ error: 'Unknown user' });
    if (target.role === 'admin') {
      const [[{ n }]] = await pool.query("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND id <> ?", [id]);
      if (n === 0) return res.status(403).json({ error: 'Cannot delete the last administrator' });
    }
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /internal/provision — build the schema on a freshly-created tenant DB
// and seed its admin (super-admin onboard wizard, FR-3.1). The platform creates
// the empty database + MySQL user and registers the tenant; this runs once the
// tenant appears in tenants.json so getPool() connects with the inline creds.
// Idempotent: migrations no-op if already applied; admin insert is guarded.
router.post('/provision', async (req, res, next) => {
  try {
    const pool = getPool(); // req.tenant resolved by tenantMiddleware
    const applied = await migrateTenant(pool, req.tenant);
    const password = req.body && req.body.admin_password;
    if (!password) return res.status(400).json({ error: 'admin_password required' });
    await pool.query(
      `INSERT INTO users (username, password, full_name, role, is_active)
       VALUES ('admin', ?, 'Administrator', 'admin', 1)
       ON DUPLICATE KEY UPDATE username = username`,
      [hashPassword(password)]
    );
    res.json({ success: true, migrations_applied: applied });
  } catch (err) { next(err); }
});

// POST /internal/broadcast — platform-originated announcement (FR-7.1). Creates
// a general announcement in this tenant and (optionally) pushes it to members.
// created_by is NULL: platform support authored it, not a tenant staff user.
router.post('/broadcast', async (req, res, next) => {
  try {
    const { title, body, push } = req.body || {};
    if (!title || !String(title).trim()) return res.status(400).json({ error: 'title required' });
    const pool = getPool();
    const [r] = await pool.query(
      `INSERT INTO announcements (type, title, body, is_active, created_by)
       VALUES ('general', ?, ?, 1, NULL)`,
      [String(title).trim(), body ? String(body) : null]
    );
    let pushed = 0;
    if (push) {
      const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM member_push_tokens');
      pushed = Number(n);
      // Fire-and-forget: never fail the broadcast on a push hiccup
      sendPushToAllMembers(pool, { title: String(title).trim(), body: body ? String(body).slice(0, 140) : '', data: { type: 'announcement' } });
    }
    res.json({ success: true, announcement_id: r.insertId, pushed });
  } catch (err) { next(err); }
});

// POST /internal/members/:id/unlock-pin — clear a mobile PIN lockout (FR-4.3)
router.post('/members/:id/unlock-pin', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [r] = await getPool().query(
      'UPDATE members SET failed_pin_attempts = 0, pin_locked_until = NULL WHERE id = ?', [id]
    );
    if (!r.affectedRows) return res.status(404).json({ error: 'Unknown member' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
