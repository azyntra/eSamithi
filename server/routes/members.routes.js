const express = require('express');
const { getPool } = require('../db');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
// Shared with the member app's /me routes so both statements stay identical
const { getMemberStatement } = require('../lib/memberQueries');
const { sendPushToMembers } = require('../lib/push');

const router = express.Router();
router.use(authMiddleware);

// Record a grant or removal of the mobile attendance-staff permission. The
// officer's name is stored alongside the id so the trail still reads after
// the user account is deleted.
async function logStaffEvent(runner, memberId, action, req, reason = null) {
  let byName = req.impersonation ? 'eSamithi support' : req.user.username || null;
  if (req.user.id) {
    const [[u]] = await runner.query('SELECT full_name FROM users WHERE id = ?', [req.user.id]);
    if (u && u.full_name) byName = u.full_name;
  }
  await runner.query(
    'INSERT INTO member_staff_events (member_id, action, by_user_id, by_name, reason) VALUES (?, ?, ?, ?, ?)',
    [memberId, action, req.user.id || null, byName, reason]
  );
}

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

    // A member who cannot use the app cannot be attendance staff in it;
    // re-enabling access later does not silently bring the permission back.
    if (app_enabled === 0) {
      const [revoked] = await pool.query(
        `UPDATE members SET app_staff_attendance = 0, app_staff_granted_at = NULL, app_staff_granted_by = NULL
         WHERE id = ? AND app_staff_attendance = 1`,
        [id]
      );
      if (revoked.affectedRows > 0) await logStaffEvent(pool, id, 'revoke', req, 'app_disabled');
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
      // society_id travels with every picker so staff can find a member by
      // the number on their card, not just by name or NIC
      "SELECT id, society_id, nic, full_name FROM members WHERE is_active = 1 ORDER BY full_name ASC"
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

// PUT /api/v1/members/:id/app-staff — { attendance: 0 | 1 }
// Nominate a member as attendance staff in the mobile app, or remove it.
// Administrators and Staff may do this (view-only accounts are refused for
// every write by authMiddleware); enabling/disabling app access and PIN
// resets stay admin-only above.
router.put('/:id/app-staff', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const want = req.body ? req.body.attendance : undefined;
    if (want !== 0 && want !== 1) {
      throw Object.assign(new Error('attendance must be 0 or 1'), { statusCode: 400 });
    }
    const pool = getPool();
    const [[member]] = await pool.query(
      'SELECT id, is_active, app_enabled, app_staff_attendance FROM members WHERE id = ?', [id]
    );
    if (!member) throw Object.assign(new Error('Member not found'), { statusCode: 404 });

    const active = member.is_active === null || Number(member.is_active) === 1;
    const enabled = member.app_enabled === null || Number(member.app_enabled) === 1;
    if (want === 1 && !active) {
      throw Object.assign(new Error('An inactive member cannot be attendance staff'), { statusCode: 400, code: 'MEMBER_INACTIVE' });
    }
    if (want === 1 && !enabled) {
      throw Object.assign(new Error('Enable mobile app access for this member first'), { statusCode: 400, code: 'APP_DISABLED' });
    }

    const changed = Number(member.app_staff_attendance) !== want;
    if (changed) {
      if (want === 1) {
        await pool.query(
          'UPDATE members SET app_staff_attendance = 1, app_staff_granted_at = NOW(), app_staff_granted_by = ? WHERE id = ?',
          [req.user.id || null, id]
        );
      } else {
        await pool.query(
          'UPDATE members SET app_staff_attendance = 0, app_staff_granted_at = NULL, app_staff_granted_by = NULL WHERE id = ?',
          [id]
        );
      }
      await logStaffEvent(pool, id, want === 1 ? 'grant' : 'revoke', req);
      if (want === 1) {
        // Fire-and-forget: tell the member the new screen is there
        sendPushToMembers(pool, [id], {
          title: 'eSamithi',
          body: 'ඔබට දැන් යෙදුමෙන් පැමිණීම සලකුණු කළ හැක. You can now mark attendance in the app.',
          data: { type: 'attendance_staff' }
        });
      }
    }
    res.json({ success: true, attendance: want, changed });
  } catch (err) { next(err); }
});

// GET /api/v1/members/app-staff — everyone currently nominated as attendance
// staff, with who granted it and whether they have set the app up yet
router.get('/app-staff', async (_req, res, next) => {
  try {
    const [rows] = await getPool().query(
      `SELECT m.id, m.society_id, m.full_name, m.phone,
              (m.pin_hash IS NOT NULL) AS enrolled,
              (m.app_enabled IS NULL OR m.app_enabled = 1) AS app_enabled,
              (m.is_active IS NULL OR m.is_active = 1) AS is_active,
              UNIX_TIMESTAMP(m.app_staff_granted_at) AS granted_ts,
              COALESCE(u.full_name,
                (SELECT e.by_name FROM member_staff_events e
                 WHERE e.member_id = m.id AND e.action = 'grant' ORDER BY e.id DESC LIMIT 1)) AS granted_by_name,
              UNIX_TIMESTAMP(a.last_seen_at) AS last_seen_ts
       FROM members m
       LEFT JOIN users u ON u.id = m.app_staff_granted_by
       LEFT JOIN member_app_activity a ON a.member_id = m.id
       WHERE m.app_staff_attendance = 1
       ORDER BY m.full_name ASC, m.id ASC`
    );
    const iso = (ts) => (ts === null || ts === undefined ? null : new Date(Number(ts) * 1000).toISOString());
    res.json(rows.map((r) => ({
      id: r.id, society_id: r.society_id, full_name: r.full_name, phone: r.phone,
      enrolled: Number(r.enrolled) === 1,
      app_enabled: Number(r.app_enabled) === 1,
      is_active: Number(r.is_active) === 1,
      granted_at: iso(r.granted_ts),
      granted_by_name: r.granted_by_name || null,
      last_seen_at: iso(r.last_seen_ts)
    })));
  } catch (err) { next(err); }
});

// GET /api/v1/members/qr-cards?scope=all|not_enrolled|ids&ids=1,2,3
// The minimum needed to print membership QR cards: society ID and name.
// Nothing else about a member is put on paper that can be lost.
router.get('/qr-cards', async (req, res, next) => {
  try {
    const scope = String(req.query.scope || 'all');
    const where = ['(is_active = 1 OR is_active IS NULL)'];
    const params = [];
    if (scope === 'not_enrolled') {
      where.push('pin_hash IS NULL');
    } else if (scope === 'ids') {
      const ids = String(req.query.ids || '').split(',').map((v) => parseInt(v, 10)).filter((n) => Number.isInteger(n) && n > 0).slice(0, 1000);
      if (ids.length === 0) return res.json([]);
      where.length = 0; // an explicitly chosen member prints even if inactive
      where.push('id IN (?)');
      params.push(ids);
    } else if (scope !== 'all') {
      throw Object.assign(new Error('Invalid scope'), { statusCode: 400 });
    }
    const [rows] = await getPool().query(
      `SELECT id, society_id, full_name FROM members WHERE ${where.join(' AND ')} ORDER BY society_id ASC, id ASC`,
      params
    );
    res.json(rows);
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
    let app_staff_granted_by_name = null;
    if (Number(members[0].app_staff_attendance) === 1) {
      const [[g]] = await getPool().query(
        `SELECT by_name FROM member_staff_events WHERE member_id = ? AND action = 'grant' ORDER BY id DESC LIMIT 1`, [id]
      );
      app_staff_granted_by_name = g ? g.by_name : null;
    }
    res.json({ ...members[0], dependents, app_staff_granted_by_name });
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
