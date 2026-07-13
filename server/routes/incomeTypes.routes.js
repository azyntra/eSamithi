const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await getPool().query('SELECT * FROM income_types ORDER BY name ASC');
    res.json(rows.map(r => ({ ...r, standard_amount: Number(r.standard_amount), is_active: Number(r.is_active) })));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, standard_amount, category_group } = req.body;
    const [result] = await getPool().query('INSERT INTO income_types (name, standard_amount, category_group) VALUES (?, ?, ?)', [name, standard_amount, category_group]);
    res.json({ success: true, id: result.insertId });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, standard_amount, category_group } = req.body;
    await getPool().query('UPDATE income_types SET name=?, standard_amount=?, category_group=? WHERE id=?', [name, standard_amount, category_group, parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);

    // Coded types drive the adaptive forms and the loan engine — never deletable
    const [typeRows] = await getPool().query('SELECT code FROM income_types WHERE id = ?', [id]);
    if (typeRows.length > 0 && typeRows[0].code) {
      throw Object.assign(new Error('This is a system income type required by the application and cannot be deleted.'), { statusCode: 400 });
    }

    const [refs] = await getPool().query('SELECT COUNT(*) as count FROM income_ledger WHERE income_type_id = ?', [id]);
    if (Number(refs[0].count) > 0) await getPool().query('UPDATE income_types SET is_active = 0 WHERE id = ?', [id]);
    else await getPool().query('DELETE FROM income_types WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
