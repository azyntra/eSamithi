const { getPool } = require('../db');
const { sendPushToMembers } = require('./push');

// Society officers (docs/MEETING-MINUTES-REQUIREMENTS.md §2–§3). A system user
// may hold a Society Position and be linked to the member account they use in
// the member app. The Secretary — the one active user with position
// 'secretary' — may prepare and publish meeting minutes from that member
// account. Like the attendance-staff permission, the check is read from the
// database on every request and never put in a token, so reassigning,
// disabling or deleting the Secretary takes effect on their next request.

const POSITIONS = ['secretary', 'president', 'treasurer'];
const ROLES = ['admin', 'user', 'viewer'];

function fail(statusCode, code, message, extra) {
  return Object.assign(new Error(message), { statusCode, code }, extra || {});
}

const ACTIVE = (alias) => `(${alias}.is_active IS NULL OR ${alias}.is_active = 1)`;

// Is this member the society's current Secretary? Their system user must be
// active, and their member record active with app access.
async function secretaryPermission(memberId, pool = getPool()) {
  const [rows] = await pool.query(
    `SELECT u.id AS user_id, u.full_name
       FROM users u JOIN members m ON m.id = u.member_id
      WHERE u.member_id = ? AND u.secretary_slot = 1
        AND ${ACTIVE('u')} AND ${ACTIVE('m')}
        AND (m.app_enabled IS NULL OR m.app_enabled = 1)`,
    [memberId]
  );
  if (rows.length === 0) return { allowed: false, code: 'NOT_SECRETARY' };
  return { allowed: true, userId: rows[0].user_id };
}

// The position of the active system user linked to this member, or null
async function officerPosition(memberId, pool = getPool()) {
  const [rows] = await pool.query(
    `SELECT u.society_position FROM users u WHERE u.member_id = ? AND ${ACTIVE('u')}`,
    [memberId]
  );
  return rows.length ? rows[0].society_position || null : null;
}

async function logOfficerEvent(conn, { userId, field, before, after, actor }) {
  const str = (v) => (v === null || v === undefined ? null : String(v).slice(0, 255));
  await conn.query(
    'INSERT INTO officer_events (user_id, field, before_value, after_value, by_user_id, by_name) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, field, str(before), str(after), actor?.id ?? null, actor?.name ?? null]
  );
}

// Normalise the officer fields of a create/update body. undefined = leave as is.
function readChanges(body) {
  const changes = {};
  if (body.full_name !== undefined) {
    const name = typeof body.full_name === 'string' ? body.full_name.trim() : '';
    if (!name) throw fail(400, 'FULL_NAME_REQUIRED', 'Full name is required');
    changes.full_name = name.slice(0, 255);
  }
  if (body.role !== undefined) {
    if (!ROLES.includes(body.role)) throw fail(400, 'INVALID_ROLE', 'role must be admin, user or viewer');
    changes.role = body.role;
  }
  if (body.is_active !== undefined) changes.is_active = body.is_active ? 1 : 0;
  if (body.society_position !== undefined) {
    const pos = body.society_position === '' || body.society_position === 'none' ? null : body.society_position;
    if (pos !== null && !POSITIONS.includes(pos)) {
      throw fail(400, 'INVALID_POSITION', 'society_position must be secretary, president, treasurer or none');
    }
    changes.society_position = pos;
  }
  if (body.member_id !== undefined) {
    if (body.member_id === null || body.member_id === '') changes.member_id = null;
    else {
      const id = Number(body.member_id);
      if (!Number.isInteger(id) || id <= 0) throw fail(400, 'UNKNOWN_MEMBER', 'member_id must be a member id or null');
      changes.member_id = id;
    }
  }
  return changes;
}

// Apply changes to one user inside the caller's transaction, enforcing the
// rules of §3.2 (V1–V6) and §3.3 (one Secretary, reassignment by consent).
// target is the user's current row. Returns { disabled } so the caller can
// revoke sessions after commit.
async function applyUserChanges(conn, target, changes, { actor, replaceSecretary = false } = {}) {
  const current = {
    full_name: target.full_name,
    role: target.role,
    is_active: target.is_active === null || target.is_active === undefined ? 1 : Number(target.is_active),
    society_position: target.society_position || null,
    member_id: target.member_id ?? null
  };
  const next = { ...current, ...changes };

  // V1 — a Secretary needs the member account they publish from
  if (next.society_position === 'secretary' && !next.member_id) {
    throw fail(400, 'SECRETARY_NEEDS_MEMBER', 'Choose the member account this Secretary uses in the eSamithi app');
  }

  // V2 — the member exists and is linked to no other user
  if (next.member_id && next.member_id !== current.member_id) {
    const [[member]] = await conn.query('SELECT id FROM members WHERE id = ?', [next.member_id]);
    if (!member) throw fail(400, 'UNKNOWN_MEMBER', 'That member does not exist');
    const [[other]] = await conn.query('SELECT id, username FROM users WHERE member_id = ? AND id <> ?', [next.member_id, target.id]);
    if (other) {
      throw fail(409, 'MEMBER_LINKED', `That member is already linked to the system user '${other.username}'`);
    }
  }

  // V6 — nobody disables their own account
  if (actor && actor.id === target.id && next.is_active === 0 && current.is_active !== 0) {
    throw fail(400, 'CANNOT_DISABLE_SELF', 'You cannot disable your own account');
  }

  // V5 — never leave the society without an active administrator
  const losesAdmin = current.role === 'admin' && current.is_active !== 0 &&
    (next.role !== 'admin' || next.is_active === 0);
  if (losesAdmin) {
    const [[{ n }]] = await conn.query(
      `SELECT COUNT(*) AS n FROM users u WHERE u.role = 'admin' AND ${ACTIVE('u')} AND u.id <> ?`,
      [target.id]
    );
    if (Number(n) === 0) throw fail(403, 'LAST_ADMIN', 'Cannot remove the last active administrator');
  }

  // V4 / §3.3 — one Secretary; taking the post from someone needs consent
  if (next.society_position === 'secretary' && current.society_position !== 'secretary') {
    const [[holder]] = await conn.query(
      `SELECT u.id, u.full_name, u.username, m.full_name AS member_name
         FROM users u LEFT JOIN members m ON m.id = u.member_id
        WHERE u.secretary_slot = 1 AND u.id <> ? FOR UPDATE`,
      [target.id]
    );
    if (holder) {
      if (!replaceSecretary) {
        throw fail(409, 'SECRETARY_TAKEN', `${holder.full_name} is the Secretary`, {
          current: { user_id: holder.id, full_name: holder.full_name, username: holder.username, member_name: holder.member_name }
        });
      }
      await conn.query('UPDATE users SET society_position = NULL WHERE id = ?', [holder.id]);
      await logOfficerEvent(conn, { userId: holder.id, field: 'society_position', before: 'secretary', after: null, actor });
    }
  }

  const fields = {};
  for (const key of Object.keys(changes)) {
    if (next[key] !== current[key]) fields[key] = next[key];
  }
  if (Object.keys(fields).length) {
    try {
      await conn.query('UPDATE users SET ? WHERE id = ?', [fields, target.id]);
    } catch (err) {
      // Lost a race with another admin's save
      if (err.code === 'ER_DUP_ENTRY' && /uq_users_secretary/.test(err.message)) {
        throw fail(409, 'SECRETARY_TAKEN', 'Another user was just made Secretary. Reload and try again.', { current: null });
      }
      if (err.code === 'ER_DUP_ENTRY' && /uq_users_member/.test(err.message)) {
        throw fail(409, 'MEMBER_LINKED', 'That member is already linked to another system user');
      }
      throw err;
    }
    for (const key of ['role', 'is_active', 'society_position', 'member_id']) {
      if (key in fields) {
        await logOfficerEvent(conn, { userId: target.id, field: key, before: current[key], after: fields[key], actor });
      }
    }
  }
  // Someone who has just become the (active) Secretary is told so in the app
  const becameSecretary = next.society_position === 'secretary' && next.is_active !== 0 && next.member_id &&
    (current.society_position !== 'secretary' || current.member_id !== next.member_id || current.is_active === 0);
  return { disabled: fields.is_active === 0, newSecretaryMemberId: becameSecretary ? next.member_id : null };
}

// "You are now the Secretary" (docs/MEETING-MINUTES-REQUIREMENTS.md §3.3 step
// 5). Sent after the change is committed; a push failure never undoes it.
// The app opens Me → Meeting minutes (Secretary) from it, switching to this
// society first when the phone has several.
async function notifyNewSecretary(pool, tenant, memberId) {
  try {
    const [[row]] = await pool.query("SELECT `value` FROM settings WHERE `key` = 'society_name'");
    const society = row && row.value ? row.value : 'eSamithi';
    await sendPushToMembers(pool, [memberId], {
      title: 'ඔබ දැන් ලේකම් · You are now the Secretary',
      body: `${society}: සභා වාර්තා සකසා ප්‍රකාශයට පත් කිරීමට මම → සමිති නිලධාරී · To prepare and publish meeting minutes: Me → Society officer`,
      data: { type: 'minutes_secretary', sam: tenant }
    });
  } catch (err) {
    console.error('[officers] secretary push skipped:', err.message);
  }
}

module.exports = {
  notifyNewSecretary,
  POSITIONS,
  ROLES,
  secretaryPermission,
  officerPosition,
  readChanges,
  applyUserChanges,
  logOfficerEvent
};
