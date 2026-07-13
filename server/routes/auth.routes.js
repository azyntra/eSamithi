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
      'SELECT id, username, full_name, role FROM users WHERE username = ? AND password = ?',
      [username, hashedPassword]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = rows[0];
    const token = generateToken(user, req.tenant);

    res.json({ success: true, user, token });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
