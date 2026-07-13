const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await getPool().query('SELECT * FROM settings');
    const settings = rows.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});
    res.json(settings);
  } catch (err) { next(err); }
});

router.put('/', async (req, res, next) => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    for (const [key, value] of Object.entries(req.body)) {
      // migration_completed is managed only by the system developer/administrator
      // (directly in the database) — never through the application.
      if (key === 'migration_completed') continue;
      if (typeof value === 'string') {
        await conn.query('UPDATE settings SET value = ? WHERE `key` = ?', [value, key]);
      }
    }
    await conn.commit();
    res.json({ success: true });
  } catch (err) { await conn.rollback(); next(err); } finally { conn.release(); }
});

module.exports = router;
