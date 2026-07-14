const express = require('express');
const { getPool } = require('../db');

const router = express.Router();

// GET /pa/v1/audit?samithi=&actor=&action=&from=&to=&limit=
// Read-only, filterable (FR-9.2). There is deliberately no write/update/
// delete surface for this table anywhere in the API.
router.get('/', async (req, res, next) => {
  try {
    const where = [];
    const params = [];
    if (req.query.samithi) { where.push('a.samithi_slug = ?'); params.push(req.query.samithi); }
    if (req.query.actor) { where.push('a.admin_id = ?'); params.push(parseInt(req.query.actor)); }
    if (req.query.action) { where.push('a.action LIKE ?'); params.push(`%${req.query.action}%`); }
    if (req.query.from) { where.push('a.created_at >= ?'); params.push(req.query.from); }
    if (req.query.to) { where.push('a.created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(req.query.to); }
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 100));

    const [rows] = await getPool().query(
      `SELECT a.id, a.admin_id, m.email AS admin_email, a.role, a.action, a.samithi_slug, a.sid,
              a.payload_before, a.payload_after, a.ip, a.created_at
       FROM audit_log a LEFT JOIN super_admins m ON m.id = a.admin_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY a.id DESC LIMIT ${limit}`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
