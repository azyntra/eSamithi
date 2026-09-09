// Web staff sessions (requirements §6.5): rotating refresh tokens stored as
// SHA-256 hashes in staff_refresh_tokens — one "family" per sign-in — and
// short access JWTs that reuse the legacy claim shape ({id, username, role,
// sam}) so middleware/auth.js needs no change. Desktop 1.3.x never touches
// any of this: it keeps POST /auth/login and its 24 h bearer token.
//
// Time comparisons are done in SQL (NOW()) on purpose — see lib/staffAuth.js.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const COOKIE_BASE = 'es_rt';
const COOKIE_PATH = '/api/v1/auth'; // the cookie only ever travels to /auth/*

function numEnv(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
const idleHours = () => numEnv('STAFF_REFRESH_HOURS', 12);
const maxHours = () => numEnv('STAFF_SESSION_MAX_HOURS', 24);
const accessTtl = () => process.env.STAFF_ACCESS_TTL || '15m';
function reuseLeewaySeconds() {
  const n = Number(process.env.STAFF_REUSE_LEEWAY_SECONDS);
  return Number.isFinite(n) && n >= 0 ? n : 5;
}
function accessTtlSeconds() {
  const m = /^(\d+)\s*([smhd]?)$/.exec(String(accessTtl()).trim());
  if (!m) return 900;
  return Number(m[1]) * { s: 1, m: 60, h: 3600, d: 86400 }[m[2] || 's'];
}

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const newToken = () => crypto.randomBytes(32).toString('hex'); // 64 hex chars
const newFamilyId = () => crypto.randomBytes(16).toString('hex'); // 32 hex chars

// ── Cookie helpers ───────────────────────────────────────────────────────────
// `__Secure-` prefix behind HTTPS (nginx sets X-Forwarded-Proto; server.js
// trusts one proxy hop), plain name on http dev/CI. Value = "<slug>.<token>"
// so a cookie presented under the wrong X-Samithi can be rejected outright.
function isSecureRequest(req) {
  if (req.secure) return true;
  return String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}
const cookieName = (req) => (isSecureRequest(req) ? `__Secure-${COOKIE_BASE}` : COOKIE_BASE);

function readCookie(req) {
  const jar = req.cookies || {};
  const raw = jar[`__Secure-${COOKIE_BASE}`] || jar[COOKIE_BASE];
  if (!raw || typeof raw !== 'string') return null;
  const i = raw.lastIndexOf('.');
  if (i <= 0) return null;
  const slug = raw.slice(0, i);
  const token = raw.slice(i + 1);
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  return { slug, token };
}

function cookieOptions(req) {
  return { httpOnly: true, secure: isSecureRequest(req), sameSite: 'strict', path: COOKIE_PATH };
}
function setCookie(res, req, slug, token) {
  res.cookie(cookieName(req), `${slug}.${token}`, { ...cookieOptions(req), maxAge: idleHours() * 3600 * 1000 });
}
function clearCookie(res, req) {
  res.clearCookie(cookieName(req), cookieOptions(req));
}

// ── Tokens ───────────────────────────────────────────────────────────────────
function signAccessToken(user, tenant, familyId) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, sam: tenant, typ: 'access', sid: familyId },
    process.env.JWT_SECRET,
    { expiresIn: accessTtl() }
  );
}

// Bearer verification for the self-service session endpoints (change
// password, revoke a session). Same tenant binding as middleware/auth.js but
// WITHOUT the viewer read-only guard — a viewer must be able to change their
// own password — and never available to support (impersonation) tokens.
function requireStaffToken(req, res, next) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  let decoded;
  try {
    decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  if (decoded.typ && decoded.typ !== 'access') return res.status(401).json({ error: 'Invalid token type' });
  if (decoded.act) return res.status(403).json({ error: 'Not available in a support session' });
  if (!decoded.id) return res.status(401).json({ error: 'Invalid token' });
  const sam = decoded.sam || process.env.DEFAULT_TENANT;
  if (req.tenant && sam !== req.tenant) return res.status(403).json({ error: 'Token does not belong to this samithi' });
  req.user = decoded;
  next();
}

// Decoded bearer token if present and valid, else null (never throws)
function verifyBearer(req) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    const sam = decoded.sam || process.env.DEFAULT_TENANT;
    if (req.tenant && sam !== req.tenant) return null;
    return decoded;
  } catch {
    return null;
  }
}

// ── Storage ──────────────────────────────────────────────────────────────────
// New family (sign-in). Returns the raw token for the cookie.
async function issue(pool, { userId, client = 'web', ip = null, userAgent = null }) {
  const token = newToken();
  const familyId = newFamilyId();
  const [r] = await pool.execute(
    `INSERT INTO staff_refresh_tokens
       (user_id, family_id, token_hash, client, ip, user_agent, expires_at, absolute_expires_at)
     VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR), DATE_ADD(NOW(), INTERVAL ? HOUR))`,
    [userId, familyId, sha256(token), String(client).slice(0, 20), ip ? String(ip).slice(0, 45) : null,
     userAgent ? String(userAgent).slice(0, 255) : null, idleHours(), maxHours()]
  );
  return { token, id: r.insertId, familyId };
}

// Successor row inside the same family: the absolute expiry is COPIED (a
// sign-in never outlives STAFF_SESSION_MAX_HOURS), the idle expiry restarts.
async function successor(pool, oldId, { ip = null, userAgent = null }) {
  const token = newToken();
  const [ins] = await pool.execute(
    `INSERT INTO staff_refresh_tokens
       (user_id, family_id, token_hash, client, ip, user_agent, expires_at, absolute_expires_at)
     SELECT user_id, family_id, ?, client, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR), absolute_expires_at
     FROM staff_refresh_tokens WHERE id = ?`,
    [sha256(token), ip ? String(ip).slice(0, 45) : null, userAgent ? String(userAgent).slice(0, 255) : null,
     idleHours(), oldId]
  );
  await pool.execute('UPDATE staff_refresh_tokens SET replaced_by = ? WHERE id = ?', [ins.insertId, oldId]);
  return { token, id: ins.insertId };
}

// Rotate the presented token. Resolves to { token, familyId, user } or
// { error: 'invalid' | 'raced' | 'reuse' | 'revoked' | 'expired' | 'disabled' | 'password', userId?, username? }.
//  - raced: the token was rotated < leeway seconds ago by a parallel request
//    (two tabs). 401 without punishment; the caller must NOT clear the cookie
//    because the jar already holds the successor.
//  - reuse: a spent token was replayed later — assume theft, revoke every
//    session of that user.
async function rotate(pool, rawToken, meta = {}) {
  const [rows] = await pool.execute(
    `SELECT t.id, t.user_id, t.family_id, t.revoked_at, t.revoke_reason, t.replaced_by,
            (t.expires_at > NOW()) AS idle_ok,
            (t.absolute_expires_at > NOW()) AS abs_ok,
            (t.revoked_at IS NOT NULL AND TIMESTAMPDIFF(SECOND, t.revoked_at, NOW()) < ?) AS just_rotated,
            (u.password_changed_at IS NOT NULL AND u.password_changed_at > t.created_at) AS pw_changed,
            u.username, u.full_name, u.role, u.is_active, u.must_change_password
     FROM staff_refresh_tokens t
     JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = ?`,
    [reuseLeewaySeconds(), sha256(rawToken)]
  );
  if (rows.length === 0) return { error: 'invalid' };
  const row = rows[0];
  const ident = { userId: row.user_id, username: row.username };

  if (row.revoked_at) {
    if (row.revoke_reason === 'rotated') {
      if (row.replaced_by && Number(row.just_rotated)) return { error: 'raced', ...ident };
      // Replay of a token that was already spent by rotation: assume theft.
      await revokeUser(pool, row.user_id, 'reuse');
      return { error: 'reuse', ...ident };
    }
    // Dead for a known reason (logout, password change, admin reset, disabled,
    // expired): plain 401 — never collateral damage to the user's other sessions.
    return { error: 'revoked', reason: row.revoke_reason, ...ident };
  }
  if (!Number(row.idle_ok) || !Number(row.abs_ok)) {
    await pool.execute("UPDATE staff_refresh_tokens SET revoked_at = NOW(), revoke_reason = 'expired' WHERE id = ? AND revoked_at IS NULL", [row.id]);
    return { error: 'expired', ...ident };
  }
  if (row.is_active === 0) {
    await revokeUser(pool, row.user_id, 'disabled');
    return { error: 'disabled', ...ident };
  }
  if (Number(row.pw_changed)) {
    await revokeUser(pool, row.user_id, 'password');
    return { error: 'password', ...ident };
  }

  // Atomic claim: whichever parallel request flips revoked_at first owns the
  // rotation; the other sees 0 affected rows and is treated as a race.
  const [claim] = await pool.execute(
    "UPDATE staff_refresh_tokens SET revoked_at = NOW(), revoke_reason = 'rotated', last_used_at = NOW() WHERE id = ? AND revoked_at IS NULL",
    [row.id]
  );
  if (!claim.affectedRows) return { error: 'raced', ...ident };

  const next = await successor(pool, row.id, meta);
  return {
    token: next.token,
    familyId: row.family_id,
    user: { id: row.user_id, username: row.username, full_name: row.full_name, role: row.role, must_change_password: row.must_change_password }
  };
}

// Same-family re-issue without the checks — used right after a password
// change so the CURRENT session survives while every other one is revoked
// (the successor's created_at is not older than password_changed_at).
async function reissueFamily(pool, familyId, meta = {}) {
  const [rows] = await pool.execute(
    'SELECT id FROM staff_refresh_tokens WHERE family_id = ? AND revoked_at IS NULL ORDER BY id DESC LIMIT 1',
    [familyId]
  );
  if (rows.length === 0) return null;
  const [claim] = await pool.execute(
    "UPDATE staff_refresh_tokens SET revoked_at = NOW(), revoke_reason = 'rotated', last_used_at = NOW() WHERE id = ? AND revoked_at IS NULL",
    [rows[0].id]
  );
  if (!claim.affectedRows) return null;
  return successor(pool, rows[0].id, meta);
}

async function revokeUser(pool, userId, reason, exceptFamilyId = null) {
  const params = [String(reason).slice(0, 30), userId];
  let sql = 'UPDATE staff_refresh_tokens SET revoked_at = NOW(), revoke_reason = ? WHERE user_id = ? AND revoked_at IS NULL';
  if (exceptFamilyId) {
    sql += ' AND family_id <> ?';
    params.push(exceptFamilyId);
  }
  const [r] = await pool.execute(sql, params);
  return r.affectedRows;
}

// Revoke the family the presented cookie belongs to. Returns the user id (or
// null when the token is unknown).
async function revokeByToken(pool, rawToken, reason) {
  const [rows] = await pool.execute('SELECT user_id, family_id FROM staff_refresh_tokens WHERE token_hash = ?', [sha256(rawToken)]);
  if (rows.length === 0) return null;
  await pool.execute(
    'UPDATE staff_refresh_tokens SET revoked_at = NOW(), revoke_reason = ? WHERE family_id = ? AND revoked_at IS NULL',
    [String(reason).slice(0, 30), rows[0].family_id]
  );
  return rows[0].user_id;
}

async function revokeFamily(pool, userId, familyId, reason) {
  const [r] = await pool.execute(
    'UPDATE staff_refresh_tokens SET revoked_at = NOW(), revoke_reason = ? WHERE user_id = ? AND family_id = ? AND revoked_at IS NULL',
    [String(reason).slice(0, 30), userId, familyId]
  );
  return r.affectedRows;
}

const SESSION_COLUMNS = `t.family_id AS id, t.client, t.ip, t.user_agent,
  (SELECT MIN(f.created_at) FROM staff_refresh_tokens f WHERE f.family_id = t.family_id) AS created_at,
  IFNULL(t.last_used_at, t.created_at) AS last_used_at, t.expires_at, t.absolute_expires_at`;

// Live sessions of a user — one active row per family at any time.
async function listSessions(pool, userId, currentFamilyId = null) {
  const [rows] = await pool.execute(
    `SELECT ${SESSION_COLUMNS}
     FROM staff_refresh_tokens t
     WHERE t.user_id = ? AND t.revoked_at IS NULL AND t.expires_at > NOW() AND t.absolute_expires_at > NOW()
     ORDER BY last_used_at DESC, t.id DESC`,
    [userId]
  );
  return rows.map((r) => ({ ...r, current: Boolean(currentFamilyId) && r.id === currentFamilyId }));
}

async function currentSession(pool, familyId) {
  const [rows] = await pool.execute(
    `SELECT ${SESSION_COLUMNS}
     FROM staff_refresh_tokens t
     WHERE t.family_id = ? AND t.revoked_at IS NULL
     ORDER BY t.id DESC LIMIT 1`,
    [familyId]
  );
  return rows[0] || null;
}

module.exports = {
  COOKIE_PATH, idleHours, maxHours, accessTtl, accessTtlSeconds, reuseLeewaySeconds,
  isSecureRequest, cookieName, readCookie, setCookie, clearCookie,
  signAccessToken, requireStaffToken, verifyBearer,
  issue, rotate, reissueFamily, revokeUser, revokeByToken, revokeFamily, listSessions, currentSession
};
