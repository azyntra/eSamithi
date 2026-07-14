const express = require('express');
const { getPool } = require('../db');
const { requireSuperadmin } = require('../middleware/auth');

// Fleet server registry (multi-server control plane). Lets the operator add
// the prod server (or future ones) from the console — no SQL, fully audited.
const router = express.Router();

const CODE_RE = /^[a-z0-9][a-z0-9_-]{1,29}$/;

// GET /pa/v1/servers — list, with per-server samithi counts (all roles)
router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await getPool().query(`
      SELECT v.id, v.code, v.api_url, v.role, v.health_url,
             COUNT(s.id) AS samithi_count,
             SUM(s.status = 'active') AS samithi_active
      FROM servers v LEFT JOIN samithis s ON s.server_id = v.id
      GROUP BY v.id ORDER BY (v.role = 'active') DESC, v.code`);
    res.json(rows.map((r) => ({ ...r, samithi_count: Number(r.samithi_count), samithi_active: Number(r.samithi_active || 0) })));
  } catch (err) { next(err); }
});

// POST /pa/v1/servers — register a server
router.post('/', requireSuperadmin, async (req, res, next) => {
  try {
    const { code, api_url, role = 'active', health_url } = req.body || {};
    if (!CODE_RE.test(code || '')) return res.status(400).json({ error: 'Code must be 2–30 chars: lowercase letters/digits, - or _' });
    if (!/^https?:\/\/.+/.test(api_url || '')) return res.status(400).json({ error: 'api_url must be an http(s) URL' });
    const pool = getPool();
    const [[dupe]] = await pool.query('SELECT id FROM servers WHERE code = ?', [code]);
    if (dupe) return res.status(409).json({ error: 'Server code already registered' });
    const [r] = await pool.query(
      'INSERT INTO servers (code, api_url, role, health_url) VALUES (?, ?, ?, ?)',
      [code, api_url.replace(/\/$/, ''), role, health_url || `${api_url.replace(/\/$/, '')}/health?deep=1`]
    );
    res.locals.audit = { action: 'server_register', after: { code, api_url, role } };
    res.json({ success: true, id: r.insertId });
  } catch (err) { next(err); }
});

// PATCH /pa/v1/servers/:code — edit api_url / role / health_url
router.patch('/:code', requireSuperadmin, async (req, res, next) => {
  try {
    const pool = getPool();
    const [[before]] = await pool.query('SELECT * FROM servers WHERE code = ?', [req.params.code]);
    if (!before) return res.status(404).json({ error: 'Unknown server' });
    const fields = {};
    if (req.body.api_url !== undefined) {
      if (!/^https?:\/\/.+/.test(req.body.api_url)) return res.status(400).json({ error: 'api_url must be an http(s) URL' });
      fields.api_url = String(req.body.api_url).replace(/\/$/, '');
    }
    if (req.body.role !== undefined) {
      if (!['active', 'standby'].includes(req.body.role)) return res.status(400).json({ error: 'role must be active or standby' });
      fields.role = req.body.role;
    }
    if (req.body.health_url !== undefined) fields.health_url = req.body.health_url || null;
    if (!Object.keys(fields).length) return res.status(400).json({ error: 'Nothing to update' });
    await pool.query('UPDATE servers SET ? WHERE id = ?', [fields, before.id]);
    res.locals.audit = {
      action: 'server_update',
      before: { code: before.code, api_url: before.api_url, role: before.role },
      after: { code: before.code, ...fields }
    };
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
