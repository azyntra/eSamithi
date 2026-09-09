const express = require('express');
const { getPool } = require('../db');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const passwords = require('../lib/passwords');
const sessions = require('../lib/staffSessions');
const staffAuth = require('../lib/staffAuth');

const router = express.Router();
router.use(authMiddleware);
router.use(requireAdmin);

const ROLES = ['admin', 'user', 'viewer'];

// GET /api/v1/users
router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await getPool().execute('SELECT id, username, full_name, role FROM users ORDER BY id ASC');
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/v1/users
router.post('/', async (req, res, next) => {
  try {
    const { username, password, full_name, role } = req.body;
    if (!username || !password || !full_name) return res.status(400).json({ error: 'username, password and full_name are required' });
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'role must be admin, user or viewer' });
    const [existing] = await getPool().execute('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) throw Object.assign(new Error('Username already exists'), { statusCode: 409 });

    const hashedPw = await passwords.hash(password);
    const [result] = await getPool().execute(
      'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)',
      [username, hashedPw, full_name, role]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) { next(err); }
});

// PATCH /api/v1/users/:id/password — administrator reset. The new password is
// treated as temporary (must_change_password) and every session of that user
// is revoked; the desktop's 24 h bearer tokens simply expire.
router.patch('/:id/password', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { new_password } = req.body || {};
    if (typeof new_password !== 'string' || new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    const [target] = await getPool().execute('SELECT id, username FROM users WHERE id = ?', [id]);
    if (target.length === 0) return res.status(404).json({ error: 'Unknown user' });
    await getPool().execute(
      'UPDATE users SET password = ?, password_changed_at = NOW(), must_change_password = 1, failed_attempts = 0, locked_until = NULL WHERE id = ?',
      [await passwords.hash(new_password), id]
    );
    await sessions.revokeUser(getPool(), id, 'admin');
    await staffAuth.logEvent(getPool(), { userId: id, username: target[0].username, event: 'password_reset', client: 'admin', ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// DELETE /api/v1/users/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const [adminCount] = await getPool().execute("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
    const [target] = await getPool().execute('SELECT role FROM users WHERE id = ?', [id]);

    if (target.length > 0 && target[0].role === 'admin' && adminCount[0].count <= 1) {
      throw Object.assign(new Error('Cannot delete the last administrator account'), { statusCode: 403 });
    }

    await getPool().execute('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
