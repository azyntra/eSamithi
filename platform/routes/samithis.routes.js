const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getPool } = require('../db');
const { requireSuperadmin } = require('../middleware/auth');
const { syncTenantsFile } = require('../lib/sync');

const router = express.Router();

function newJoinCode(slug) {
  return `${slug.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase()}-${crypto.randomInt(1000, 10000)}`;
}

// Live read from a tenant's internal surface (signed like the collector)
async function tenantDetail(apiUrl, slug) {
  const token = jwt.sign({ typ: 'internal' }, process.env.INTERNAL_SECRET || '', { expiresIn: '30s' });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`${apiUrl}/internal/detail`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Samithi': slug },
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

module.exports = router;
