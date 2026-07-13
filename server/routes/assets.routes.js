const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await getPool().query('SELECT * FROM physical_assets ORDER BY name ASC');
    res.json(rows.map(r => ({ ...r, quantity: Number(r.quantity), is_active: Number(r.is_active) })));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const [result] = await getPool().query('INSERT INTO physical_assets (name, quantity, description) VALUES (?, ?, ?)', [req.body.name, req.body.quantity, req.body.description || null]);
    res.json({ success: true, id: result.insertId });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    await getPool().query('UPDATE physical_assets SET name=?, quantity=?, description=? WHERE id=?', [req.body.name, req.body.quantity, req.body.description || null, parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const [refs] = await getPool().query('SELECT COUNT(*) as count FROM income_ledger WHERE asset_id = ?', [id]);
    if (Number(refs[0].count) > 0) { await getPool().query('UPDATE physical_assets SET is_active = 0 WHERE id = ?', [id]); }
    else { await getPool().query('DELETE FROM physical_assets WHERE id = ?', [id]); }
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
