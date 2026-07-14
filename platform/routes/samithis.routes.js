const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getPool } = require('../db');
const { requireSuperadmin } = require('../middleware/auth');
const { syncTenantsFile } = require('../lib/sync');
const { provisionSamithi, ProvisionError } = require('../lib/provision');

const router = express.Router();

function newJoinCode(slug) {
  return `${slug.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase()}-${crypto.randomInt(1000, 10000)}`;
}

function internalToken() {
  return jwt.sign({ typ: 'internal' }, process.env.INTERNAL_SECRET || '', { expiresIn: '30s' });
}

// Live read from a tenant's internal surface (signed like the collector)
async function tenantDetail(apiUrl, slug) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`${apiUrl}/internal/detail`, {
      headers: { Authorization: `Bearer ${internalToken()}`, 'X-Samithi': slug },
      signal: ctrl.signal
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Signed write proxy into a tenant's internal control surface (FR-4.2/4.3).
// Returns { status, data }; the caller maps errors to the operator response.
async function tenantWrite(apiUrl, slug, method, path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`${apiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${internalToken()}`,
        'X-Samithi': slug,
        'Content-Type': 'application/json'
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch {
    return { status: 502, data: { error: 'Samithi API unreachable' } };
  } finally {
    clearTimeout(timer);
  }
}

// Look up an active tenant's api_url (staff/PIN admin only touches live tenants)
async function activeTenant(slug) {
  const [[s]] = await getPool().query(
    `SELECT s.slug, s.status, v.api_url FROM samithis s JOIN servers v ON v.id = s.server_id WHERE s.slug = ?`,
    [slug]
  );
  return s;
}

// GET /pa/v1/samithis/:slug — registry row + cached snapshot + live detail
router.get('/:slug', async (req, res, next) => {
  try {
    const pool = getPool();
    const [[s]] = await pool.query(`
      SELECT s.id, s.slug, s.join_code, s.name_en, s.name_si, s.db_name, s.status,
             s.min_app_version, s.onboarded_at, s.suspended_at, v.code AS server_code, v.api_url
      FROM samithis s JOIN servers v ON v.id = s.server_id WHERE s.slug = ?`, [req.params.slug]);
    if (!s) return res.status(404).json({ error: 'Unknown samithi' });
    const [[snapshot]] = await pool.query('SELECT * FROM tenant_stats_current WHERE samithi_slug = ?', [req.params.slug]);
    const detail = s.status === 'active' ? await tenantDetail(s.api_url, s.slug) : null;
    res.json({ samithi: s, snapshot: snapshot || null, detail, reachable: detail !== null });
  } catch (err) { next(err); }
});

// GET /pa/v1/samithis — registry (all roles incl. auditor)
router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await getPool().query(`
      SELECT s.id, s.slug, s.join_code, s.name_en, s.name_si, s.db_name, s.status,
             s.min_app_version, s.onboarded_at, s.suspended_at, v.code AS server_code, v.api_url
      FROM samithis s JOIN servers v ON v.id = s.server_id
      ORDER BY s.slug`);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /pa/v1/samithis — onboard a new samithi (FR-3.1). Creates the tenant
// database + MySQL user, registers it, runs migrations, seeds the admin, and
// publishes to tenants.json — reachable from the apps with no SSH/restart.
router.post('/', requireSuperadmin, async (req, res, next) => {
  try {
    const { slug, name_en, name_si, min_app_version, server_code } = req.body || {};
    const result = await provisionSamithi({ slug, name_en, name_si, min_app_version, server_code });
    res.locals.audit = {
      action: 'samithi_onboard', samithi: result.slug,
      after: { slug: result.slug, name_en: result.name_en, join_code: result.join_code, db_name: result.db_name }
    };
    res.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof ProvisionError) {
      res.locals.audit = { action: 'samithi_onboard_failed', samithi: req.body?.slug || null, after: { error: err.message } };
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

// PATCH /pa/v1/samithis/:slug — suspend / reactivate / regenerate_code, or
// edit profile fields (FR-3.2, FR-3.3). Superadmin only; fully audited.
router.patch('/:slug', requireSuperadmin, async (req, res, next) => {
  try {
    const pool = getPool();
    const [[before]] = await pool.query('SELECT * FROM samithis WHERE slug = ?', [req.params.slug]);
    if (!before) return res.status(404).json({ error: 'Unknown samithi' });

    const action = req.body.action;
    if (action === 'suspend') {
      await pool.query("UPDATE samithis SET status = 'suspended', suspended_at = NOW() WHERE id = ?", [before.id]);
    } else if (action === 'reactivate') {
      await pool.query("UPDATE samithis SET status = 'active', suspended_at = NULL WHERE id = ?", [before.id]);
    } else if (action === 'regenerate_code') {
      // Old code stops resolving immediately (FR-3.2 acceptance)
      await pool.query('UPDATE samithis SET join_code = ? WHERE id = ?', [newJoinCode(before.slug), before.id]);
    } else {
      const fields = {};
      for (const f of ['name_en', 'name_si', 'min_app_version']) {
        if (req.body[f] !== undefined) fields[f] = req.body[f] || null;
      }
      if (Object.keys(fields).length === 0) return res.status(400).json({ error: 'Nothing to update' });
      await pool.query('UPDATE samithis SET ? WHERE id = ?', [fields, before.id]);
    }

    const [[after]] = await pool.query('SELECT * FROM samithis WHERE id = ?', [before.id]);
    await syncTenantsFile();
    res.locals.audit = {
      action: `samithi_${action || 'edit'}`,
      samithi: before.slug,
      before: { status: before.status, join_code: before.join_code, name_en: before.name_en, min_app_version: before.min_app_version },
      after: { status: after.status, join_code: after.join_code, name_en: after.name_en, min_app_version: after.min_app_version }
    };
    res.json({ success: true, samithi: after });
  } catch (err) { next(err); }
});

// ── Staff-user management (FR-4.2) & PIN unlock (FR-4.3) ─────────────────────
// All superadmin-only and audited (auditMiddleware writes a row from
// res.locals.audit). The platform never stores tenant passwords — a reset
// generates a one-time temporary password, hands it to the tenant to hash, and
// returns the plaintext to the operator exactly once.

function tempPassword() {
  return crypto.randomBytes(6).toString('base64url'); // ~8 chars, url-safe
}

// POST /pa/v1/samithis/:slug/users — create a staff login
router.post('/:slug/users', requireSuperadmin, async (req, res, next) => {
  try {
    const s = await activeTenant(req.params.slug);
    if (!s) return res.status(404).json({ error: 'Unknown samithi' });
    if (s.status !== 'active') return res.status(409).json({ error: 'Samithi is not active' });
    const { username, full_name, role } = req.body || {};
    const password = tempPassword();
    const r = await tenantWrite(s.api_url, s.slug, 'POST', '/internal/users', { username, full_name, role, password });
    res.locals.audit = { action: 'staff_user_create', samithi: s.slug, after: { username, full_name, role } };
    if (r.status >= 400) return res.status(r.status).json(r.data);
    res.json({ success: true, id: r.data.id, temp_password: password });
  } catch (err) { next(err); }
});

// PATCH /pa/v1/samithis/:slug/users/:id — change role / enable / disable
router.patch('/:slug/users/:id', requireSuperadmin, async (req, res, next) => {
  try {
    const s = await activeTenant(req.params.slug);
    if (!s) return res.status(404).json({ error: 'Unknown samithi' });
    if (s.status !== 'active') return res.status(409).json({ error: 'Samithi is not active' });
    const body = {};
    if (req.body.role !== undefined) body.role = req.body.role;
    if (req.body.is_active !== undefined) body.is_active = req.body.is_active;
    const r = await tenantWrite(s.api_url, s.slug, 'PATCH', `/internal/users/${req.params.id}`, body);
    res.locals.audit = { action: 'staff_user_update', samithi: s.slug, after: { user_id: req.params.id, ...body } };
    if (r.status >= 400) return res.status(r.status).json(r.data);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /pa/v1/samithis/:slug/users/:id/reset-password — temp password shown once
router.post('/:slug/users/:id/reset-password', requireSuperadmin, async (req, res, next) => {
  try {
    const s = await activeTenant(req.params.slug);
    if (!s) return res.status(404).json({ error: 'Unknown samithi' });
    if (s.status !== 'active') return res.status(409).json({ error: 'Samithi is not active' });
    const password = tempPassword();
    const r = await tenantWrite(s.api_url, s.slug, 'POST', `/internal/users/${req.params.id}/reset-password`, { password });
    res.locals.audit = { action: 'staff_user_reset_password', samithi: s.slug, after: { user_id: req.params.id } };
    if (r.status >= 400) return res.status(r.status).json(r.data);
    res.json({ success: true, temp_password: password });
  } catch (err) { next(err); }
});

// DELETE /pa/v1/samithis/:slug/users/:id — remove a staff login
router.delete('/:slug/users/:id', requireSuperadmin, async (req, res, next) => {
  try {
    const s = await activeTenant(req.params.slug);
    if (!s) return res.status(404).json({ error: 'Unknown samithi' });
    if (s.status !== 'active') return res.status(409).json({ error: 'Samithi is not active' });
    const r = await tenantWrite(s.api_url, s.slug, 'DELETE', `/internal/users/${req.params.id}`);
    res.locals.audit = { action: 'staff_user_delete', samithi: s.slug, after: { user_id: req.params.id } };
    if (r.status >= 400) return res.status(r.status).json(r.data);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /pa/v1/samithis/:slug/members/:id/unlock-pin — clear a mobile lockout
router.post('/:slug/members/:id/unlock-pin', requireSuperadmin, async (req, res, next) => {
  try {
    const s = await activeTenant(req.params.slug);
    if (!s) return res.status(404).json({ error: 'Unknown samithi' });
    if (s.status !== 'active') return res.status(409).json({ error: 'Samithi is not active' });
    const r = await tenantWrite(s.api_url, s.slug, 'POST', `/internal/members/${req.params.id}/unlock-pin`);
    res.locals.audit = { action: 'member_pin_unlock', samithi: s.slug, after: { member_id: req.params.id } };
    if (r.status >= 400) return res.status(r.status).json(r.data);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
