const express = require('express');
const { getPool } = require('../db');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const passwords = require('../lib/passwords');
const sessions = require('../lib/staffSessions');
const staffAuth = require('../lib/staffAuth');
const officers = require('../lib/officers');

const router = express.Router();
router.use(authMiddleware);
router.use(requireAdmin);

const ROLES = officers.ROLES;

// The administrator making the change, for the officer trail
async function actorOf(req, conn) {
  const [[me]] = await conn.query('SELECT full_name, username FROM users WHERE id = ?', [req.user.id]);
  return { id: req.user.id, name: me ? (me.full_name || me.username) : req.user.username || null };
}

// SECRETARY_TAKEN carries who holds the post, so the office can confirm the
// handover by name (§3.3); the global handler only echoes error + code.
function sendError(res, next, err) {
  if (err && err.code === 'SECRETARY_TAKEN') {
    return res.status(409).json({ error: err.message, code: err.code, current: err.current || null });
  }
  return next(err);
}

const USER_FIELDS = `u.id, u.username, u.full_name, u.role,
  CASE WHEN u.is_active IS NULL THEN 1 ELSE u.is_active END AS is_active,
  u.society_position, u.member_id,
  m.full_name AS member_name, m.society_id AS member_society_id,
  CASE WHEN m.id IS NULL THEN NULL
       WHEN (m.is_active IS NULL OR m.is_active = 1) AND (m.app_enabled IS NULL OR m.app_enabled = 1) AND m.pin_hash IS NOT NULL THEN 1
       ELSE 0 END AS member_app_ready`;

// GET /api/v1/users
router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await getPool().query(
      `SELECT ${USER_FIELDS} FROM users u LEFT JOIN members m ON m.id = u.member_id ORDER BY u.id ASC`
    );
    res.json(rows.map((r) => ({ ...r, is_active: Number(r.is_active), member_app_ready: r.member_app_ready === null ? null : Number(r.member_app_ready) })));
  } catch (err) { next(err); }
});

// POST /api/v1/users — optionally with society_position and member_id
router.post('/', async (req, res, next) => {
  // Validate before taking a connection: a bad request never touches the DB
  const { username, password, full_name, role } = req.body;
  if (!username || !password || !full_name) return res.status(400).json({ error: 'username, password and full_name are required' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'role must be admin, user or viewer' });
  let changes;
  try {
    changes = officers.readChanges({ society_position: req.body.society_position, member_id: req.body.member_id });
  } catch (err) { return next(err); }

  let conn;
  let newSecretary = null;
  try {
    conn = await getPool().getConnection();
    await conn.beginTransaction();
    const [existing] = await conn.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) throw Object.assign(new Error('Username already exists'), { statusCode: 409 });
    const hashedPw = await passwords.hash(password);
    const [result] = await conn.query(
      'INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)',
      [username, hashedPw, full_name, role]
    );
    if (Object.keys(changes).length) {
      const target = { id: result.insertId, full_name, role, is_active: 1, society_position: null, member_id: null };
      const applied = await officers.applyUserChanges(conn, target, changes, {
        actor: await actorOf(req, conn),
        replaceSecretary: req.body.replace_secretary === true
      });
      newSecretary = applied.newSecretaryMemberId;
    }
    await conn.commit();
    if (newSecretary) officers.notifyNewSecretary(getPool(), req.tenant, newSecretary);
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    sendError(res, next, err);
  } finally { if (conn) conn.release(); }
});

// PATCH /api/v1/users/:id — full name, access role, active, society position
// and linked member (docs/MEETING-MINUTES-REQUIREMENTS.md §3.2–§3.3)
router.patch('/:id', async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  let changes;
  try {
    changes = officers.readChanges(req.body || {});
  } catch (err) { return next(err); }
  if (!Object.keys(changes).length) return res.status(400).json({ error: 'Nothing to update' });

  let conn;
  try {
    conn = await getPool().getConnection();
    await conn.beginTransaction();
    const [[target]] = await conn.query(
      'SELECT id, full_name, role, is_active, society_position, member_id FROM users WHERE id = ? FOR UPDATE',
      [id]
    );
    if (!target) {
      await conn.rollback();
      return res.status(404).json({ error: 'Unknown user' });
    }
    const { disabled, newSecretaryMemberId } = await officers.applyUserChanges(conn, target, changes, {
      actor: await actorOf(req, conn),
      replaceSecretary: req.body.replace_secretary === true
    });
    await conn.commit();
    if (newSecretaryMemberId) officers.notifyNewSecretary(getPool(), req.tenant, newSecretaryMemberId);
    // A disabled login must not keep a live web session
    if (disabled) await sessions.revokeUser(getPool(), id, 'disabled');

    const [[user]] = await getPool().query(
      `SELECT ${USER_FIELDS} FROM users u LEFT JOIN members m ON m.id = u.member_id WHERE u.id = ?`,
      [id]
    );
    res.json({ ...user, is_active: Number(user.is_active), member_app_ready: user.member_app_ready === null ? null : Number(user.member_app_ready) });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    sendError(res, next, err);
  } finally { if (conn) conn.release(); }
});

// GET /api/v1/users/:id/events — the officer trail for one user (§3.6)
router.get('/:id/events', async (req, res, next) => {
  try {
    const [rows] = await getPool().query(
      `SELECT e.id, e.field, e.before_value, e.after_value, e.by_name, e.created_at,
              mb.full_name AS before_member, ma.full_name AS after_member
         FROM officer_events e
         LEFT JOIN members mb ON e.field = 'member_id' AND mb.id = e.before_value
         LEFT JOIN members ma ON e.field = 'member_id' AND ma.id = e.after_value
        WHERE e.user_id = ? ORDER BY e.created_at DESC, e.id DESC LIMIT 100`,
      [parseInt(req.params.id, 10)]
    );
    res.json(rows);
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

    const [[gone]] = await getPool().query('SELECT society_position, member_id FROM users WHERE id = ?', [id]);
    await getPool().execute('DELETE FROM users WHERE id = ?', [id]);
    // Keep the trail readable: a deleted Secretary loses the post (§3.4)
    if (gone && (gone.society_position || gone.member_id)) {
      await officers.logOfficerEvent(getPool(), { userId: id, field: 'deleted', before: gone.society_position, after: null, actor: await actorOf(req, getPool()) });
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
