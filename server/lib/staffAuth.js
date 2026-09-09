// Staff sign-in bookkeeping shared by POST /auth/login (desktop — response
// contract frozen) and POST /auth/session (web). Failed-attempt counters and
// the lockout live on `users` (migration 014); the forensic trail lives in
// staff_auth_events (015). Every helper degrades gracefully: a tenant whose
// 014/015 have not applied yet can still sign in from the desktop.
const passwords = require('./passwords');

function intEnv(name, fallback) {
  const n = parseInt(process.env[name] || '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
const maxFails = () => intEnv('STAFF_LOCKOUT_MAX_FAILS', 10);
const lockMinutes = () => intEnv('STAFF_LOCKOUT_MINUTES', 15);

// STAFF_LOCKOUT_SCOPE — web (default): only the web/shell sign-in is locked
// out and the frozen desktop keeps its pre-014 behaviour; all: every client;
// off: never enforced. Failures are always COUNTED regardless of scope; the
// scope only decides whether the lock is enforced for the client at hand.
function lockoutEnforced(client) {
  const scope = String(process.env.STAFF_LOCKOUT_SCOPE || 'web').toLowerCase();
  if (scope === 'all') return true;
  if (scope === 'off' || scope === 'none') return false;
  return client === 'web' || client === 'shell';
}

// Time comparisons happen in SQL on purpose: the API and MySQL containers may
// not share a session time zone, so JS Date maths on TIMESTAMP columns is not
// trustworthy.
const FULL_COLUMNS = `id, username, full_name, role, is_active, password,
  failed_attempts, locked_until, password_changed_at, must_change_password,
  (locked_until IS NOT NULL AND locked_until > NOW()) AS locked,
  GREATEST(0, IFNULL(TIMESTAMPDIFF(SECOND, NOW(), locked_until), 0)) AS lock_seconds_left`;
const LEGACY_COLUMNS = 'id, username, full_name, role, is_active, password';

async function findForLogin(pool, username) {
  try {
    const [rows] = await pool.execute(`SELECT ${FULL_COLUMNS} FROM users WHERE username = ?`, [username]);
    return rows[0] || null;
  } catch (err) {
    // Pre-014 tenant (migration not applied yet): fall back to the legacy
    // column set so the desktop login never breaks.
    if (!err || err.code !== 'ER_BAD_FIELD_ERROR') throw err;
    const [rows] = await pool.execute(`SELECT ${LEGACY_COLUMNS} FROM users WHERE username = ?`, [username]);
    if (!rows[0]) return null;
    return {
      ...rows[0],
      failed_attempts: 0, locked_until: null, password_changed_at: null, must_change_password: 0,
      locked: 0, lock_seconds_left: 0, legacyColumns: true
    };
  }
}

// Wrong password: bump the counter; lock after maxFails() consecutive misses.
async function recordFailure(pool, user, meta) {
  if (!user || user.legacyColumns) return { locked: false };
  const attempts = Number(user.failed_attempts || 0) + 1;
  if (attempts >= maxFails()) {
    await pool.execute(
      'UPDATE users SET failed_attempts = 0, locked_until = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?',
      [lockMinutes(), user.id]
    );
    await logEvent(pool, { userId: user.id, username: user.username, event: 'locked', ...meta });
    return { locked: true, seconds: lockMinutes() * 60 };
  }
  await pool.execute('UPDATE users SET failed_attempts = ? WHERE id = ?', [attempts, user.id]);
  return { locked: false, attemptsLeft: maxFails() - attempts };
}

// Correct password: reset counters, stamp last_login_at and — once Deploy B's
// PASSWORD_REHASH=on — silently upgrade a legacy hash to bcrypt. Never allowed
// to fail the sign-in itself.
async function recordSuccess(pool, user, plain) {
  const sets = ['last_login_at = NOW()'];
  const params = [];
  if (!user.legacyColumns) sets.push('failed_attempts = 0', 'locked_until = NULL');
  if (passwords.needsRehash(user.password)) {
    sets.push('password = ?');
    params.push(await passwords.hash(plain));
  }
  params.push(user.id);
  try {
    await pool.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
  } catch (err) {
    console.error('[staff-auth] post-login bookkeeping failed:', err.message);
  }
}

// Forensic trail (015). Best-effort: the trail must never break sign-in.
async function logEvent(pool, { userId = null, username = null, event, client = null, ip = null, userAgent = null }) {
  try {
    await pool.execute(
      'INSERT INTO staff_auth_events (user_id, username, event, client, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
      [
        userId ?? null,
        username ? String(username).slice(0, 100) : null,
        String(event).slice(0, 30),
        client ? String(client).slice(0, 20) : null,
        ip ? String(ip).slice(0, 45) : null,
        userAgent ? String(userAgent).slice(0, 255) : null
      ]
    );
    // Light housekeeping instead of a cron: keep six months of events
    if (Math.random() < 0.01) {
      await pool.execute('DELETE FROM staff_auth_events WHERE created_at < DATE_SUB(NOW(), INTERVAL 180 DAY)');
    }
  } catch { /* ignore */ }
}

module.exports = { findForLogin, recordFailure, recordSuccess, logEvent, lockoutEnforced, maxFails, lockMinutes };
