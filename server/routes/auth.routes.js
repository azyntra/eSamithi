const express = require('express');
const crypto = require('crypto');
const { getPool } = require('../db');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// POST /api/v1/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const hashedPassword = hashPassword(password);
    const [rows] = await getPool().execute(
      'SELECT id, username, full_name, role, is_active FROM users WHERE username = ? AND password = ?',
      [username, hashedPassword]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = rows[0];
    // A super-admin can disable a staff login from the panel (FR-4.2). Column
    // is nullable/defaulted, so pre-migration rows (is_active null) stay valid.
    if (user.is_active === 0) {
      return res.status(403).json({ error: 'This account has been disabled. Contact your administrator.' });
    }
    delete user.is_active;
    getPool().execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]).catch(() => {});
    const token = generateToken(user, req.tenant);

    res.json({ success: true, user, token });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
