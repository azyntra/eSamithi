const express = require('express');
const crypto = require('crypto');
const { getPool } = require('../db');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);
router.use(requireAdmin);

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

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
    const [existing] = await getPool().execute('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) throw Object.assign(new Error('Username already exists'), { statusCode: 409 });

    const hashedPw = hashPassword(password);
    const [result] = await getPool().execute(
      'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)',
      [username, hashedPw, full_name, role]
    );
    res.json({ success: true, id: result.insertId });
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
