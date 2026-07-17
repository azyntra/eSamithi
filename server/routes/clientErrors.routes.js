const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { getPool } = require('../db');

const router = express.Router();

// Crash/error reports from the mobile app. Deliberately auth-OPTIONAL: the
// errors most worth seeing happen before login. If a member token is present
// it's used to attribute the report; a bad token just means anonymous.
const { ipKeyGenerator } = rateLimit;
const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${req.tenant || ''}`,
  message: { error: 'Too many reports' }
});

function optionalMemberId(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    return decoded.typ === 'member' && decoded.member_id ? decoded.member_id : null;
  } catch {
    return null;
  }
}

router.post('/', reportLimiter, async (req, res, next) => {
  try {
    const b = req.body || {};
    const message = String(b.message || '').slice(0, 500).trim();
    if (!message) return res.status(400).json({ error: 'message required' });

    const pool = getPool(req.tenant);
    await pool.query(
      `INSERT INTO client_errors (member_id, platform, app_version, update_id, is_fatal, message, stack, context)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        optionalMemberId(req),
        String(b.platform || '').slice(0, 20) || null,
        String(b.app_version || '').slice(0, 40) || null,
        String(b.update_id || '').slice(0, 80) || null,
        b.is_fatal ? 1 : 0,
        message,
        b.stack ? String(b.stack).slice(0, 8000) : null,
        b.context ? String(b.context).slice(0, 200) : null
      ]
    );
    // Opportunistic retention: nothing older than 30 days
    await pool.query("DELETE FROM client_errors WHERE created_at < NOW() - INTERVAL 30 DAY");
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
