const express = require('express');
const jwt = require('jsonwebtoken');
const { getPool } = require('../db');
const { requireSuperadmin } = require('../middleware/auth');

// Broadcast announcements to the fleet (super-admin FR-7.1). Fans out to each
// target samithi's tenant API, which creates a general announcement (+ optional
// Expo push). Every send is recorded in the platform broadcasts table.
const router = express.Router();

function internalToken() {
  return jwt.sign({ typ: 'internal' }, process.env.INTERNAL_SECRET || '', { expiresIn: '60s' });
}

async function broadcastToTenant(apiUrl, slug, payload) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(`${apiUrl}/internal/broadcast`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${internalToken()}`, 'X-Samithi': slug, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    });
    const data = await res.json().catch(() => ({}));
    return res.ok
      ? { slug, ok: true, announcement_id: data.announcement_id, pushed: data.pushed || 0 }
      : { slug, ok: false, error: data.error || `HTTP ${res.status}` };
  } catch (err) {
    return { slug, ok: false, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

// POST /pa/v1/broadcasts — { title, body, push, target: 'all' | [slug,…] }
router.post('/', requireSuperadmin, async (req, res, next) => {
  try {
    const { title, body, push = false, target = 'all' } = req.body || {};
    if (!title || !String(title).trim()) return res.status(400).json({ error: 'Title is required' });

    const [all] = await getPool().query(
      `SELECT s.slug, v.api_url FROM samithis s JOIN servers v ON v.id = s.server_id WHERE s.status = 'active'`
    );
    let targets = all;
    if (Array.isArray(target)) {
      const set = new Set(target);
      targets = all.filter((t) => set.has(t.slug));
    }
    if (targets.length === 0) return res.status(400).json({ error: 'No active target samithis' });

    const payload = { title: String(title).trim(), body: body ? String(body) : null, push: Boolean(push) };
    const results = await Promise.all(targets.map((t) => broadcastToTenant(t.api_url, t.slug, payload)));

    await getPool().query(
      'INSERT INTO broadcasts (admin_id, title, body, push, targets, results) VALUES (?, ?, ?, ?, ?, ?)',
      [req.admin.id, payload.title, payload.body, payload.push ? 1 : 0,
       JSON.stringify(Array.isArray(target) ? target : 'all'), JSON.stringify(results)]
    );

    res.locals.audit = {
      action: 'broadcast', samithi: Array.isArray(target) ? target.join(',') : 'all',
      after: { title: payload.title, push: payload.push, delivered: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length }
    };
    res.json({ success: true, delivered: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results });
  } catch (err) { next(err); }
});

// GET /pa/v1/broadcasts — send history (all roles incl. auditor)
router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await getPool().query(
      `SELECT b.id, b.title, b.body, b.push, b.targets, b.results, b.created_at, a.email AS sent_by
       FROM broadcasts b LEFT JOIN super_admins a ON a.id = b.admin_id
       ORDER BY b.created_at DESC LIMIT 50`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
