const express = require('express');
const { getPool, getTenants } = require('../db');
const { generateToken, authMiddleware } = require('../middleware/auth');
const passwords = require('../lib/passwords');
const staffAuth = require('../lib/staffAuth');
const sessions = require('../lib/staffSessions');
const { staffLoginLimiter, refreshLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// Response texts of POST /auth/login are part of the frozen desktop contract.
const INVALID = { error: 'Invalid username or password' };
const DISABLED = { error: 'This account has been disabled. Contact your administrator.' };

// Constant-cost decoy so an unknown username costs the same as a wrong
// password (no account enumeration by timing).
const DECOY_HASH = passwords.sha256('esamithi-decoy');

function clientOf(req, fallback) {
  return /eSamithiShell\//.test(String(req.headers['user-agent'] || '')) ? 'shell' : fallback;
}
function meta(req, client) {
  return { client, ip: req.ip, userAgent: req.headers['user-agent'] };
}
// Exactly the shape (and key order) the desktop has always received
function publicUser(u) {
  return { id: u.id, username: u.username, full_name: u.full_name, role: u.role };
}
function lockedBody(seconds) {
  const minutes = Math.max(1, Math.ceil(Number(seconds || 0) / 60));
  return {
    error: `Too many failed sign-in attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    code: 'LOCKED',
    retry_after_seconds: Number(seconds || 0)
  };
}

// Shared credential check for /login (desktop) and /session (web).
// Resolves to { user } on success, else { status, body }.
async function authenticate(pool, req, client) {
  const { username, password } = req.body || {};
  if (!username || !password) return { status: 400, body: { error: 'Username and password required' } };

  const m = meta(req, client);
  const user = await staffAuth.findForLogin(pool, String(username));
  if (user && Number(user.locked) && staffAuth.lockoutEnforced(client)) {
    return { status: 423, body: lockedBody(user.lock_seconds_left) };
  }

  const ok = user ? await passwords.verify(password, user.password) : await passwords.verify(password, DECOY_HASH) && false;
  if (!ok) {
    if (user) {
      const failure = await staffAuth.recordFailure(pool, user, m);
      if (failure.locked && staffAuth.lockoutEnforced(client)) {
        return { status: 423, body: lockedBody(failure.seconds) };
      }
    }
    await staffAuth.logEvent(pool, { userId: user ? user.id : null, username: String(username), event: 'login_fail', ...m });
    return { status: 401, body: INVALID };
  }
  // A super-admin can disable a staff login from the console (FR-4.2). Column
  // is nullable/defaulted, so pre-migration rows (is_active null) stay valid.
  if (user.is_active === 0) return { status: 403, body: DISABLED };

  await staffAuth.recordSuccess(pool, user, String(password));
  await staffAuth.logEvent(pool, { userId: user.id, username: user.username, event: 'login_ok', ...m });
  return { user };
}

// Defence in depth for the cookie endpoints: a custom header forces a CORS
// pre-flight for any cross-origin attempt, and Fetch Metadata rejects the
// rest. Same-origin browsers and the Electron shell always pass.
function sameOriginGuard(req, res) {
  if (String(req.headers['x-requested-with'] || '') !== 'eSamithi') {
    res.status(403).json({ error: 'Missing request header' });
    return false;
  }
  if (String(req.headers['sec-fetch-site'] || '').toLowerCase() === 'cross-site') {
    res.status(403).json({ error: 'Cross-site request rejected' });
    return false;
  }
  return true;
}

// ── POST /api/v1/auth/login — desktop 1.3.x (contract frozen) ────────────────
router.post('/login', staffLoginLimiter, async (req, res, next) => {
  try {
    const result = await authenticate(getPool(), req, 'desktop');
    if (!result.user) return res.status(result.status).json(result.body);
    const user = publicUser(result.user);
    res.json({ success: true, user, token: generateToken(user, req.tenant) });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/auth/session — web / shell sign-in ─────────────────────────
router.post('/session', staffLoginLimiter, async (req, res, next) => {
  try {
    const pool = getPool();
    const client = clientOf(req, 'web');
    const result = await authenticate(pool, req, client);
    if (!result.user) return res.status(result.status).json(result.body);

    const issued = await sessions.issue(pool, { userId: result.user.id, ...meta(req, client) });
    sessions.setCookie(res, req, req.tenant, issued.token);
    res.json({
      success: true,
      user: { ...publicUser(result.user), must_change_password: Number(result.user.must_change_password) === 1 },
      access_token: sessions.signAccessToken(result.user, req.tenant, issued.familyId),
      expires_in: sessions.accessTtlSeconds()
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/auth/refresh — rotate the cookie, mint a new access token ──
router.post('/refresh', refreshLimiter, async (req, res, next) => {
  try {
    if (!sameOriginGuard(req, res)) return;
    const cookie = sessions.readCookie(req);
    if (!cookie) return res.status(401).json({ error: 'No session', code: 'NO_SESSION' });
    if (cookie.slug !== req.tenant) {
      sessions.clearCookie(res, req);
      return res.status(401).json({ error: 'Session belongs to another samithi', code: 'WRONG_SAMITHI' });
    }

    const pool = getPool();
    const client = clientOf(req, 'web');
    const r = await sessions.rotate(pool, cookie.token, meta(req, client));
    if (r.error) {
      if (r.error === 'raced') {
        // A parallel tab just rotated; its response already set the successor
        // cookie, so do NOT clear anything here.
        return res.status(401).json({ error: 'Session refreshed elsewhere', code: 'RACED' });
      }
      sessions.clearCookie(res, req);
      if (r.error === 'reuse') {
        await staffAuth.logEvent(pool, { userId: r.userId, username: r.username, event: 'refresh_reuse', ...meta(req, client) });
      }
      return res.status(401).json({ error: 'Session expired. Please sign in again.', code: r.error.toUpperCase() });
    }

    sessions.setCookie(res, req, req.tenant, r.token);
    res.json({ access_token: sessions.signAccessToken(r.user, req.tenant, r.familyId), expires_in: sessions.accessTtlSeconds() });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/auth/logout[?all=1] ────────────────────────────────────────
router.post('/logout', async (req, res, next) => {
  try {
    if (!sameOriginGuard(req, res)) return;
    const pool = getPool();
    const all = req.query.all === '1' || req.query.all === 'true';
    const cookie = sessions.readCookie(req);
    let userId = null;
    if (cookie && cookie.slug === req.tenant) {
      userId = await sessions.revokeByToken(pool, cookie.token, all ? 'logout_all' : 'logout');
    }
    if (all) {
      if (!userId) {
        const bearer = sessions.verifyBearer(req);
        if (bearer && bearer.id && !bearer.act) userId = bearer.id;
      }
      if (userId) await sessions.revokeUser(pool, userId, 'logout_all');
    }
    sessions.clearCookie(res, req);
    if (userId) await staffAuth.logEvent(pool, { userId, event: all ? 'logout_all' : 'logout', ...meta(req, clientOf(req, 'web')) });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/auth/me — fresh identity + tenant + session facts ───────────
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT id, username, full_name, role, is_active, must_change_password, last_login_at FROM users WHERE id = ?',
      [req.user.id]
    );
    let user = rows[0];
    if (!user && req.impersonation) {
      // Support tokens carry a synthetic identity that has no users row
      user = { id: req.user.id, username: req.user.username, full_name: req.user.full_name || 'eSamithi support', role: req.user.role, must_change_password: 0 };
    }
    if (!user) return res.status(401).json({ error: 'Account no longer exists' });
    if (user.is_active === 0) return res.status(403).json({ error: DISABLED.error });

    const tenant = getTenants()[req.tenant] || {};
    const session = req.user.sid && !req.impersonation ? await sessions.currentSession(pool, req.user.sid) : null;
    res.json({
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      must_change_password: Number(user.must_change_password) === 1,
      last_login_at: user.last_login_at || null,
      samithi: { slug: req.tenant, name: tenant.name || null },
      session,
      support: req.impersonation
        ? { actor: req.impersonation.actor, sid: req.impersonation.sid, expires_at: req.user.exp ? new Date(req.user.exp * 1000).toISOString() : null }
        : null
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/auth/sessions — my live sessions (shared office PCs) ────────
router.get('/sessions', authMiddleware, async (req, res, next) => {
  try {
    if (req.impersonation) return res.json([]);
    res.json(await sessions.listSessions(getPool(), req.user.id, req.user.sid || null));
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/v1/auth/sessions/:id — revoke one of my sessions ────────────
router.delete('/sessions/:id', sessions.requireStaffToken, async (req, res, next) => {
  try {
    const familyId = String(req.params.id || '');
    if (!/^[0-9a-f]{32}$/.test(familyId)) return res.status(400).json({ error: 'Invalid session id' });
    const n = await sessions.revokeFamily(getPool(), req.user.id, familyId, 'logout');
    if (!n) return res.status(404).json({ error: 'Session not found' });
    if (familyId === req.user.sid) sessions.clearCookie(res, req);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/auth/change-password — self-service ────────────────────────
function passwordProblem(candidate, username) {
  if (typeof candidate !== 'string' || candidate.length < 8) return 'New password must be at least 8 characters';
  if (candidate.length > 128) return 'New password is too long';
  if (username && candidate.toLowerCase() === String(username).toLowerCase()) return 'New password must differ from the username';
  return null;
}

router.post('/change-password', sessions.requireStaffToken, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password) return res.status(400).json({ error: 'Current and new password are required' });

    const pool = getPool();
    const [rows] = await pool.execute('SELECT id, username, password, is_active FROM users WHERE id = ?', [req.user.id]);
    const user = rows[0];
    if (!user || user.is_active === 0) return res.status(403).json({ error: DISABLED.error });
    if (!(await passwords.verify(current_password, user.password))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    const problem = passwordProblem(new_password, user.username);
    if (problem) return res.status(400).json({ error: problem });
    if (String(new_password) === String(current_password)) return res.status(400).json({ error: 'New password must differ from the current one' });

    await pool.execute(
      'UPDATE users SET password = ?, password_changed_at = NOW(), must_change_password = 0 WHERE id = ?',
      [await passwords.hash(new_password), user.id]
    );
    // Every other session dies; this one is re-issued so the user stays in.
    await sessions.revokeUser(pool, user.id, 'password', req.user.sid || null);
    const cookie = sessions.readCookie(req);
    if (req.user.sid && cookie && cookie.slug === req.tenant) {
      const next_ = await sessions.reissueFamily(pool, req.user.sid, meta(req, clientOf(req, 'web')));
      if (next_) sessions.setCookie(res, req, req.tenant, next_.token);
    }
    await staffAuth.logEvent(pool, { userId: user.id, username: user.username, event: 'password_change', ...meta(req, clientOf(req, 'web')) });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
