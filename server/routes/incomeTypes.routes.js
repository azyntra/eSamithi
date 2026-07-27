const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

const NAME_MAX = 255;

function httpError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}

// Shared by create and edit. Officers type these by hand, so a blank name or a
// duplicate would otherwise land silently in the pickers.
async function validateName(name, excludeId = null) {
  const clean = String(name ?? '').trim();
  if (!clean) throw httpError('Name is required', 400);
  if (clean.length > NAME_MAX) throw httpError(`Name must be ${NAME_MAX} characters or fewer`, 400);

  const params = [clean];
  let sql = 'SELECT id FROM income_types WHERE name = ?';
  if (excludeId !== null) { sql += ' AND id <> ?'; params.push(excludeId); }
  const [dupes] = await getPool().query(sql, params);
  if (dupes.length > 0) throw httpError('An income type with this name already exists', 400);

  return clean;
}

function validateAmount(value) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount < 0) throw httpError('Default amount must be zero or more', 400);
  return Math.round(amount);
}

router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await getPool().query('SELECT * FROM income_types ORDER BY name ASC');
    res.json(rows.map(r => ({ ...r, standard_amount: Number(r.standard_amount), is_active: Number(r.is_active) })));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const name = await validateName(req.body.name);
    const amount = validateAmount(req.body.standard_amount);
    const group = String(req.body.category_group ?? '').trim();
    if (!group) throw httpError('Category group is required', 400);

    const [result] = await getPool().query(
      'INSERT INTO income_types (name, standard_amount, category_group) VALUES (?, ?, ?)',
      [name, amount, group]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) { next(err); }
});

// Edit. Coded (system) types may be renamed — that is how a society gets
// Sinhala labels on its receipts — but `code` and `category_group` drive the
// adaptive transaction forms and the loan engine, so they stay frozen.
router.put('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const [[existing]] = await getPool().query('SELECT id, code FROM income_types WHERE id = ?', [id]);
    if (!existing) throw httpError('Income type not found', 404);

    const fields = {};
    if (req.body.name !== undefined) fields.name = await validateName(req.body.name, id);
    if (req.body.standard_amount !== undefined) fields.standard_amount = validateAmount(req.body.standard_amount);
    if (req.body.category_group !== undefined) {
      const group = String(req.body.category_group).trim();
      if (!group) throw httpError('Category group is required', 400);
      if (existing.code) {
        throw httpError('The category group of a system income type cannot be changed.', 400);
      }
      fields.category_group = group;
    }
    // Reactivating a type that was deactivated because it had history
    if (req.body.is_active !== undefined) fields.is_active = req.body.is_active ? 1 : 0;

    if (Object.keys(fields).length === 0) throw httpError('Nothing to update', 400);
    await getPool().query('UPDATE income_types SET ? WHERE id = ?', [fields, id]);
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

    // Referenced by history → deactivate so past receipts keep their category
    // name; never used → remove outright.
    const [refs] = await getPool().query('SELECT COUNT(*) as count FROM income_ledger WHERE income_type_id = ?', [id]);
    const deactivated = Number(refs[0].count) > 0;
    if (deactivated) await getPool().query('UPDATE income_types SET is_active = 0 WHERE id = ?', [id]);
    else await getPool().query('DELETE FROM income_types WHERE id = ?', [id]);
    res.json({ success: true, deactivated });
  } catch (err) { next(err); }
});

module.exports = router;
