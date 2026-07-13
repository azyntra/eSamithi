const express = require('express');
const { getPool } = require('../db');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
// Shared with the member app's /me routes so both statements stay identical
const { getMemberStatement } = require('../lib/memberQueries');

const router = express.Router();
router.use(authMiddleware);

// PUT /api/v1/members/:id/app-access — staff controls for the member mobile
// app: enable/disable access and/or reset the member's PIN. Admin only.
router.put('/:id/app-access', requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const { app_enabled, reset_pin } = req.body;
    const pool = getPool();

    const [rows] = await pool.query('SELECT id FROM members WHERE id = ?', [id]);
    if (rows.length === 0) throw Object.assign(new Error('Member not found'), { statusCode: 404 });

    if (app_enabled === 0 || app_enabled === 1) {
      await pool.query('UPDATE members SET app_enabled = ? WHERE id = ?', [app_enabled, id]);
    }

    if (reset_pin === true) {
      // Wipe the PIN so the member re-enrolls with NIC + DOB, and kill every
      // existing app session — a reset must always force a fresh login.
      await pool.query(
        `UPDATE members SET pin_hash = NULL, pin_set_at = NULL,
         failed_pin_attempts = 0, pin_locked_until = NULL WHERE id = ?`,
        [id]
      );
    }

    // Disabling access or resetting the PIN both invalidate open sessions
    if (reset_pin === true || app_enabled === 0) {
      await pool.query(
        'UPDATE member_refresh_tokens SET revoked_at = NOW() WHERE member_id = ? AND revoked_at IS NULL',
        [id]
      );
    }

    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/v1/members?search=&page=&limit=
router.get('/', async (req, res, next) => {
  try {
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params = [];

    if (search.trim()) {
      whereClause = 'WHERE full_name LIKE ? OR nic LIKE ? OR society_id LIKE ?';
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern);
    }

    const [countRows] = await getPool().query(`SELECT COUNT(*) as total FROM members ${whereClause}`, params);
    const total = Number(countRows[0].total);

    const [members] = await getPool().query(
      `SELECT * FROM members ${whereClause} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    res.json({ members, total });
  } catch (err) { next(err); }
});

// GET /api/v1/members/slim
router.get('/slim', async (_req, res, next) => {
  try {
    const [rows] = await getPool().query(
      "SELECT id, nic, full_name FROM members WHERE is_active = 1 ORDER BY full_name ASC"
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/v1/members/check-unique?field=&value=&excludeId=
router.get('/check-unique', async (req, res, next) => {
  try {
    const { field, value, excludeId } = req.query;
    const validFields = ['society_id', 'nic'];
    if (!validFields.includes(field)) throw Object.assign(new Error(`Invalid field: ${field}`), { statusCode: 400 });

    // If value is empty, skip uniqueness check — always unique
    if (!value || !value.trim()) {
      return res.json(true);
    }

    let query = `SELECT COUNT(*) as count FROM members WHERE ${field} = ?`;
    const params = [value];
    if (excludeId) {
      query += ' AND id != ?';
      params.push(parseInt(excludeId));
    }

    const [rows] = await getPool().query(query, params);
    res.json(Number(rows[0].count) === 0);
  } catch (err) { next(err); }
});

// GET /api/v1/members/:id/statement — the member's financial history
router.get('/:id/statement', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    res.json(await getMemberStatement(getPool(), id));
  } catch (err) { next(err); }
});

// GET /api/v1/members/:id
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const [members] = await getPool().query('SELECT * FROM members WHERE id = ?', [id]);
    if (members.length === 0) throw Object.assign(new Error('Member not found'), { statusCode: 404 });

    const [dependents] = await getPool().query('SELECT * FROM dependents WHERE member_id = ?', [id]);
    res.json({ ...members[0], dependents });
  } catch (err) { next(err); }
});

// POST /api/v1/members
router.post('/', async (req, res, next) => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const d = req.body;

    const [result] = await conn.query(
      `INSERT INTO members (society_id, nic, full_name, date_of_birth, gender, marital_status, occupation, address, phone, date_of_joining, father_name, mother_name, father_in_law_name, mother_in_law_name, bank_name, bank_account_holder_name, bank_account_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        d.society_id || null, d.nic || null, d.full_name || null,
        d.date_of_birth || null, d.gender || null, d.marital_status || null,
        d.occupation || null, d.address || null, d.phone || null,
        d.date_of_joining || null,
        d.father_name || null, d.mother_name || null,
        d.father_in_law_name || null, d.mother_in_law_name || null,
        d.bank_name || null, d.bank_account_holder_name || null,
        d.bank_account_number || null
      ]
    );
    const memberId = result.insertId;

    if (d.dependents && d.dependents.length > 0) {
      for (const dep of d.dependents) {
        const hasData = (dep.name && dep.name.trim()) || (dep.relationship && dep.relationship.trim()) ||
          dep.date_of_birth || (dep.nic && dep.nic.trim());
        if (hasData) {
          await conn.query(
            'INSERT INTO dependents (member_id, name, relationship, date_of_birth, nic, age) VALUES (?, ?, ?, ?, ?, ?)',
            [
              memberId,
              dep.name ? dep.name.trim() : null,
              dep.relationship ? dep.relationship.trim() : null,
              dep.date_of_birth || null,
              dep.nic ? dep.nic.trim() : null,
              dep.age ? parseInt(dep.age) : null
            ]
          );
        }
      }
    }

    await conn.commit();
    res.json({ success: true, id: memberId });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// PUT /api/v1/members/:id
router.put('/:id', async (req, res, next) => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const id = parseInt(req.params.id);
    const d = req.body;

    await conn.query(
      `UPDATE members SET society_id=?, nic=?, full_name=?, date_of_birth=?, gender=?, marital_status=?, occupation=?, address=?, phone=?, date_of_joining=?, father_name=?, mother_name=?, father_in_law_name=?, mother_in_law_name=?, bank_name=?, bank_account_holder_name=?, bank_account_number=? WHERE id=?`,
      [
        d.society_id || null, d.nic || null, d.full_name || null,
        d.date_of_birth || null, d.gender || null, d.marital_status || null,
        d.occupation || null, d.address || null, d.phone || null,
        d.date_of_joining || null,
        d.father_name || null, d.mother_name || null,
        d.father_in_law_name || null, d.mother_in_law_name || null,
        d.bank_name || null, d.bank_account_holder_name || null,
        d.bank_account_number || null,
        id
      ]
    );

    await conn.query('DELETE FROM dependents WHERE member_id = ?', [id]);
    if (d.dependents && d.dependents.length > 0) {
      for (const dep of d.dependents) {
        const hasData = (dep.name && dep.name.trim()) || (dep.relationship && dep.relationship.trim()) ||
          dep.date_of_birth || (dep.nic && dep.nic.trim());
        if (hasData) {
          await conn.query(
            'INSERT INTO dependents (member_id, name, relationship, date_of_birth, nic, age) VALUES (?, ?, ?, ?, ?, ?)',
            [
              id,
              dep.name ? dep.name.trim() : null,
              dep.relationship ? dep.relationship.trim() : null,
              dep.date_of_birth || null,
              dep.nic ? dep.nic.trim() : null,
              dep.age ? parseInt(dep.age) : null
            ]
          );
        }
      }
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// DELETE /api/v1/members/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const pool = getPool();

    const [incomeRef] = await pool.query("SELECT COUNT(*) as count FROM income_ledger WHERE member_id = ?", [id]);
    const [expenseRef] = await pool.query("SELECT COUNT(*) as count FROM expense_ledger WHERE member_id = ?", [id]);
    const [loanRef] = await pool.query("SELECT COUNT(*) as count FROM loans WHERE member_id = ?", [id]);

    if (Number(incomeRef[0].count) > 0 || Number(expenseRef[0].count) > 0 || Number(loanRef[0].count) > 0) {
      throw Object.assign(new Error('Cannot delete a member who has financial transactions linked to them. Please void or delete their transactions first.'), { statusCode: 400 });
    }

    await pool.query('DELETE FROM dependents WHERE member_id = ?', [id]);
    await pool.query('DELETE FROM members WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
